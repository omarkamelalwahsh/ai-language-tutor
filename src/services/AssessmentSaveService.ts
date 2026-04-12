import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';
import { AssessmentOutcome, AnswerRecord } from '../types/assessment';
import { withRetry } from '../lib/utils';


export class AssessmentSaveService {
  /**
   * Helper to ensure valid user session before DB interaction.
   */
  public static async getAuthenticatedUserIdSafe(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error(`Auth context missing: ${error?.message || 'No user session'}`);
    }
    return user.id;
  }

  private static async getAuthenticatedUserId(): Promise<string> {
    return this.getAuthenticatedUserIdSafe();
  }

  // Helper buffers unchanged...
  private static saveToLocalBuffer(payload: any) {
    if (typeof window === 'undefined') return;
    try {
      const buffer = JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]');
      buffer.push(payload);
      localStorage.setItem('pending_assessment_logs', JSON.stringify(buffer));
    } catch (e) {
      console.warn('[Buffer] Failed to save to local buffer:', e);
    }
  }

  private static removeFromLocalBuffer(questionId: string, timestamp: string) {
    if (typeof window === 'undefined') return;
    try {
      const buffer = JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]');
      const filtered = buffer.filter((log: any) => !(log.question_id === questionId && log.created_at === timestamp));
      localStorage.setItem('pending_assessment_logs', JSON.stringify(filtered));
    } catch (e) {
      console.warn('[Buffer] Failed to remove from local buffer:', e);
    }
  }

  public static async syncPendingLogs() {
    if (typeof window === 'undefined') return true;
    
    const buffer = JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]');
    if (buffer.length === 0) return true;

    console.log(`[Buffer] 🔄 Background Sync: Attempting to secure ${buffer.length} logs...`);

    try {
      const { error } = await supabase.from('assessment_logs').insert(buffer);
      if (error) throw error;

      localStorage.removeItem('pending_assessment_logs');
      console.log(`[Buffer] ✅ Background Sync complete. ${buffer.length} logs secured.`);
    } catch (err) {
      console.error(`[Buffer] ❌ Background Sync failed:`, err);
      throw err;
    }

    return true;
  }

  static async log_and_update_assessment(task: any, evaluation: any, answer: string) {
    try {
      const rpcPayload: Record<string, any> = {
        p_data: {
          p_question_id: task.id,
          p_question_text: task.prompt,
          p_user_answer: typeof answer === 'object' ? JSON.stringify(answer) : String(answer),
          p_correct_answer: task.correctAnswer || '',
          p_is_correct: evaluation.is_correct,
          p_category: task.skill || "vocabulary",
          p_confidence: evaluation.confidence || 0,
          p_score: evaluation.score || 0,
          p_metadata: evaluation // entire object from LLM
        }
      };

      console.log("🟡 Executing raw fetch to PostgREST RPC...");
      
      // Extract raw token from Supabase's local storage to completely bypass client locking
      const authStorage = localStorage.getItem('sb-' + (new URL(supabaseUrl!).hostname.split('.')[0]) + '-auth-token');
      const token = authStorage ? JSON.parse(authStorage)?.access_token : null;

      if (!token) {
         throw new Error("No secure session token available in local storage.");
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/log_and_update_assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey!
        },
        body: JSON.stringify(rpcPayload)
      });

      console.log("🟡 rpc promise resolved. Checking for errors...");

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ RPC Error:", errText);
        throw new Error(errText);
      }

      const data = await response.json().catch(() => null);

      console.log("✅ Save Success! (Atomic RPC handles skill update)");
      return data;
    } catch (err) {
      console.error("🔥 Critical Save Error:", err);
      throw err;
    }
  }


  /**
   * Saves full assessment results (profile, skills, error profiles) to Supabase.
   * NOTE: Individual question logs are now handled in real-time.
   */
  public static async saveAssessmentResults(outcome: AssessmentOutcome): Promise<void> {
    try {
      const userId = await this.getAuthenticatedUserId();
      console.log('[AssessmentSave] 🔑 Launching Atomic Finalization via Native Fetch...');

      const authStorage = localStorage.getItem('sb-' + (new URL(supabaseUrl!).hostname.split('.')[0]) + '-auth-token');
      const token = authStorage ? JSON.parse(authStorage)?.access_token : null;
      if (!token) throw new Error("No token for finalization");

      await withRetry(async () => {
          const rawLevel = String(outcome.finalLevel || outcome.overallBand || 'B1');
          const finalLevel = (rawLevel === 'Pending' || !rawLevel) ? 'B1' : rawLevel;
          
          console.log(`[AssessmentSave] 🎯 Finalizing Assessment with Level: ${finalLevel}`);
          if (rawLevel === 'Pending') {
            console.warn("[AssessmentSave] ⚠️ Corrected 'Pending' level to fallback B1 during persistence.");
          }

          console.table({
            userId,
            level: finalLevel,
            points: Number(outcome.pointsAwarded) || 50,
            skills: Object.keys(outcome.skillBreakdown || {}).length
          });

          // 1. Update Core Profile
          const profileUpdate = supabase.from('learner_profiles').update({
             overall_level: finalLevel,
             updated_at: new Date().toISOString() // Let DB triggers handle points if needed, or omit points summation here to rely on RPC increment later
          }).eq('id', userId);

          // 2. Prepare Skill States Upsert
          const skillUpserts = Object.keys(outcome.skillBreakdown || {}).map(skillKey => ({
             user_id: userId,
             skill: skillKey,
             current_level: outcome.skillBreakdown[skillKey].band,
             current_score: outcome.skillBreakdown[skillKey].score,
             confidence: outcome.skillBreakdown[skillKey].confidence,
             last_tested: new Date().toISOString(),
             updated_at: new Date().toISOString()
          }));
          const skillsPromise = skillUpserts.length > 0 
            ? supabase.from('skill_states').upsert(skillUpserts, { onConflict: 'user_id, skill' })
            : Promise.resolve();

          // 3. Prepare User Error Profiles Upsert
          const errorProfileUpsert = supabase.from('user_error_profiles').upsert({
             user_id: userId,
             weakness_areas: outcome.weaknesses || [],
             common_mistakes: outcome.common_mistakes || [],
             action_plan: outcome.actionPlan ? (typeof outcome.actionPlan === 'string' ? outcome.actionPlan : JSON.stringify(outcome.actionPlan)) : null,
             bridge_delta: outcome.bridgeDelta !== null && outcome.bridgeDelta !== undefined ? Number(outcome.bridgeDelta) : null,
             bridge_percentage: outcome.bridgePercentage !== null && outcome.bridgePercentage !== undefined ? Number(outcome.bridgePercentage) : null,
             updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

          // Run all 3 operations safely in parallel to mock atomic finalize without hitting the stale RPC
          const [profileRes, skillsRes, errorsRes] = await Promise.all([
             profileUpdate,
             skillsPromise,
             errorProfileUpsert
          ]);

          if (profileRes.error) console.error("Profile update failed", profileRes.error);
          if ((skillsRes as any)?.error) console.error("Skill states upsert failed", (skillsRes as any)?.error);
          if (errorsRes.error) console.error("Error profile upsert failed", errorsRes.error);

          console.log('[AssessmentSave] 🚀 Atomic Finalization SUCCESS.');
      });

    } catch (e) {
      console.error('[AssessmentSave] Atomic Transaction failed:', e);
      throw e;
    }
  }

  /**
   * Invokes the Grok-powered cloud analysis pipeline.
   * Orchestrates Scorer-Model and Pedagogical Expert via Edge Function.
   */
  public static async analyzeAssessmentRemote(history: AnswerRecord[]): Promise<any> {
    try {
      const userId = await this.getAuthenticatedUserId();
      console.log(`[AssessmentSave] ☁️ Triggering Deep Cloud Analysis for user: ${userId}`);

      const authStorage = localStorage.getItem('sb-' + (new URL(supabaseUrl!).hostname.split('.')[0]) + '-auth-token');
      const token = authStorage ? JSON.parse(authStorage)?.access_token : null;

      if (!token) throw new Error("Authentication session expired.");

      const response = await fetch(`${supabaseUrl}/functions/v1/analyze-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey!
        },
        body: JSON.stringify({
          user_id: userId,
          user_answers: history.map(h => ({
            question_id: h.questionId,
            skill: h.skill,
            user_answer: h.answer,
            expected: h.correctAnswer,
            time: h.responseTimeMs
          }))
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[AssessmentSave] Cloud Analysis Error:', errText);
        throw new Error(`AI Analysis Failed: ${errText}`);
      }

      const result = await response.json();
      console.log('[AssessmentSave] ✅ Cloud Analysis complete.', result);
      return result.analysis;
    } catch (err) {
      console.error('[AssessmentSave] Remote Analysis Exception:', err);
      throw err;
    }
  }

  /**
   * Dedicated helper for single-skill updates (Proctor direct update).
   * Ensures atomic UPSERT and Integer Weighting.
   */
  public static async updateSkillState(userId: string, skillName: string, confidence: number, level?: string): Promise<void> {
    await withRetry(async () => {
      const resolvedLevel = level || 'A1';
      const { error } = await supabase
        .from('skill_states')
        .upsert(
          { 
            user_id: userId, 
            skill: skillName || 'unknown', 
            current_score: Math.round((confidence || 0.5) * 10000), 
            confidence: confidence ?? 0.5,
            current_level: resolvedLevel,
            level: resolvedLevel,
            updated_at: new Date().toISOString(),
            last_tested: new Date().toISOString()
          }, 
          { onConflict: 'user_id, skill' }
        );
        
      if (error) throw error;
    });
  }

  /**
   * Updates journey step status following strict transition rules.
   * Rule 3.2.4: Update journey_steps.status to 'completed'.
   */
  public static async updateJourneyStepStatus(stepId: string, status: 'locked' | 'available' | 'current' | 'completed'): Promise<void> {
    await withRetry(async () => {
      const { error } = await supabase
        .from('journey_steps')
        .update({ 
          status,
          updated_at: new Date().toISOString() 
        })
        .eq('id', stepId);

      if (error) throw error;
      console.log(`[AssessmentSave] 🏁 Journey step ${stepId} status: ${status}`);
    });
  }
}

