import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabaseClient';
import { AssessmentOutcome } from '../types/assessment';
import { withRetry } from '../lib/utils';


export class AssessmentSaveService {
  /**
   * Helper to ensure valid user session before DB interaction.
   */
  private static async getAuthenticatedUserId(): Promise<string> {
    const authStorage = localStorage.getItem('sb-' + (new URL(supabaseUrl!).hostname.split('.')[0]) + '-auth-token');
    const userJson = authStorage ? JSON.parse(authStorage)?.user : null;
    let userId = userJson?.id || localStorage.getItem('auth_user_id');
    
    if (!userId) {
      throw new Error(`Auth context missing: No user session found locally or remotely`);
    }
    return userId;
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
      const authStorage = localStorage.getItem('sb-' + (new URL(supabaseUrl!).hostname.split('.')[0]) + '-auth-token');
      const token = authStorage ? JSON.parse(authStorage)?.access_token : null;

      if (!token) throw new Error("No token for sync");

      const response = await fetch(`${supabaseUrl}/rest/v1/assessment_logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey!,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(buffer)
      });

      if (response.ok) {
        localStorage.removeItem('pending_assessment_logs');
        console.log(`[Buffer] ✅ Background Sync complete. ${buffer.length} logs secured.`);
      } else {
        console.warn(`[Buffer] ⚠️ Background Sync partial failure:`, await response.text());
      }
    } catch (err) {
      console.error(`[Buffer] ❌ Background Sync failed:`, err);
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
          const finalLevel = String(outcome.finalLevel || outcome.overallBand || 'B1');
          
          console.log(`[AssessmentSave] 🎯 Finalizing Assessment with Level: ${finalLevel}`);
          if (finalLevel === 'Pending') {
            console.warn("[AssessmentSave] ⚠️ Caution: Sending 'Pending' as final level. This shouldn't happen after completion.");
          }

          const payload = {
            p_user_id: userId,
            p_final_level: finalLevel,
            p_points: Number(outcome.pointsAwarded) || 50,
            p_skill_breakdown: outcome.skillBreakdown || {},
            p_weaknesses: outcome.weaknesses || [],
            p_action_plan: outcome.actionPlan 
               ? (typeof outcome.actionPlan === 'string' ? outcome.actionPlan : JSON.stringify(outcome.actionPlan)) 
               : null,
            p_common_mistakes: outcome.common_mistakes || [],
            p_bridge_delta: outcome.bridgeDelta !== null && outcome.bridgeDelta !== undefined ? Number(outcome.bridgeDelta) : null,
            p_bridge_percentage: outcome.bridgePercentage !== null && outcome.bridgePercentage !== undefined ? Number(outcome.bridgePercentage) : null
          };

          console.table({
            userId: payload.p_user_id,
            level: payload.p_final_level,
            points: payload.p_points,
            skills: Object.keys(payload.p_skill_breakdown).length
          });

         const response = await fetch(`${supabaseUrl}/rest/v1/rpc/finalize_diagnostic_v2`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': supabaseAnonKey!
            },
            body: JSON.stringify(payload)
         });

         if (!response.ok) throw new Error(await response.text());
        console.log('[AssessmentSave] 🚀 Atomic Finalization SUCCESS.');
      });

    } catch (e) {
      console.error('[AssessmentSave] Atomic Transaction failed:', e);
      throw e;
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

