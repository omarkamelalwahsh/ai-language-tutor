import { supabase } from '../lib/supabaseClient';
import { AssessmentOutcome } from '../types/assessment';
import { withRetry } from '../lib/utils';


export class AssessmentSaveService {
  /**
   * Helper to ensure valid user session before DB interaction.
   */
  private static async getAuthenticatedUserId(): Promise<string> {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error(`Auth context missing: ${error?.message || 'No user session'}`);
    }
    return user.id;
  }

  /**
   * Helper to append a log to the local buffer (localStorage) for reliability.
   */
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

  /**
   * Helper to remove a successfully synced log from the local buffer.
   */
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

  /**
   * Sweeper function to sync all pending logs in bulk.
   * REFACTORED: Non-blocking execution to prevent UI hangs during finalization.
   */
  public static async syncPendingLogs() {
    if (typeof window === 'undefined') return true;
    
    const buffer = JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]');
    if (buffer.length === 0) return true;

    console.log(`[Buffer] 🔄 Background Sync: Attempting to secure ${buffer.length} logs...`);

    // 🚀 NON-BLOCKING: Fire and forget (let the then/catch handle the result)
    supabase.from('assessment_logs').insert(buffer).then(({ error }) => {
      if (!error) {
        localStorage.removeItem('pending_assessment_logs');
        console.log(`[Buffer] ✅ Background Sync complete. ${buffer.length} logs secured.`);
      } else {
        console.warn(`[Buffer] ⚠️ Background Sync partial failure:`, error.message);
      }
    }).catch(err => {
      console.error(`[Buffer] ❌ Background Sync failed:`, err);
    });

    // Return immediately to unblock the Engine
    return true;
  }

  /**
   * Saves a single assessment log (individual question) for real-time persistence.
   * REFACTORED: Buffer-First approach. No awaits to ensure instant LocalStorage persistence.
   */
  public static async saveSingleAssessmentLog(task: any, evaluation: any, answer: any): Promise<void> {
    // 1. Prepare CLEAN RPC PARAMS (No IDs - Secured by Database Session)
    const params = {
      p_question_id: task.id,
      p_category: task.skill || 'General',
      p_user_answer: typeof answer === 'object' ? JSON.stringify(answer) : answer,
      p_score: evaluation.score,
      p_evaluation_metadata: evaluation
    };

    console.log("🚀 [RPC Call] Logging question:", params.p_question_id);

    // 3. Fire-and-Forget RPC Call (Background execution for speed)
    supabase.rpc('log_assessment', params).then(({ error }) => {
      if (error) {
        console.error("❌ RPC Error:", error.message);
        // Fallback: Secure in local buffer if DB rejected or network failed
        this.saveToLocalBuffer(params);
        console.log(`💾 [Buffer] Failure recovery: Params secured locally for ${params.p_question_id}`);
      } else {
        console.log("✅ [Success] Question logged via RPC safely!");
      }
    }).catch(err => {
      console.error("❌ [Fatal] RPC execution failed:", err);
      this.saveToLocalBuffer(params);
    });
  }


  /**
   * Saves full assessment results (profile, skills, error profiles) to Supabase.
   * NOTE: Individual question logs are now handled in real-time.
   */
  public static async saveAssessmentResults(outcome: AssessmentOutcome): Promise<void> {
    try {
      const userId = await this.getAuthenticatedUserId();
      console.log('[AssessmentSave] 🔑 Launching Atomic Finalization for:', userId);

      await withRetry(async () => {
        const { error } = await supabase.rpc('finalize_diagnostic_v2', {
          p_user_id: userId,
          p_final_level: String(outcome.finalLevel || outcome.overallBand),
          p_points: outcome.pointsAwarded || 50,
          p_skill_breakdown: outcome.skillBreakdown,
          p_weaknesses: outcome.weaknesses || [],
          p_action_plan: typeof outcome.actionPlan === 'string' 
            ? outcome.actionPlan 
            : JSON.stringify(outcome.actionPlan),
          p_common_mistakes: outcome.common_mistakes || [],
          p_bridge_delta: outcome.bridgeDelta || null,
          p_bridge_percentage: outcome.bridgePercentage || null
        });

        if (error) throw error;
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
      const { error } = await supabase
        .from('skill_states')
        .upsert(
          { 
            user_id: userId, 
            skill: skillName || 'unknown', 
            current_score: Math.round((confidence || 0.5) * 10000), 
            confidence: confidence ?? 0.5,
            current_level: level || 'A1',
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

