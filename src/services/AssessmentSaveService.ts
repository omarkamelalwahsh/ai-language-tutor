import { supabase } from '../lib/supabaseClient';
import { AssessmentOutcome } from '../types/assessment';
import { withRetry } from '../lib/utils';


export class AssessmentSaveService {
  /**
   * Helper to ensure valid user session before DB interaction.
   */
  private static async getAuthenticatedUserId(): Promise<string> {
    console.log("🟡 Fetching authenticated user session safely...");
    const { data: { session }, error } = await supabase.auth.getSession();
    let userId = session?.user?.id;
    
    if (error || !userId) {
      console.warn("⚠️ Validating fallback local storage since getSession failed...");
      userId = localStorage.getItem('auth_user_id') || undefined;
      if (!userId) {
        throw new Error(`Auth context missing: No user session found locally or remotely`);
      }
    }
    console.log("🟡 Auth user resolved:", userId);
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

    // 🛑 BLOCKING: Await the response completely
    try {
      const { error } = await supabase.from('assessment_logs').insert(buffer);
      if (!error) {
        localStorage.removeItem('pending_assessment_logs');
        console.log(`[Buffer] ✅ Background Sync complete. ${buffer.length} logs secured.`);
      } else {
        console.warn(`[Buffer] ⚠️ Background Sync partial failure:`, error.message);
      }
    } catch (err) {
      console.error(`[Buffer] ❌ Background Sync failed:`, err);
    }

    return true;
  }

  static async log_and_update_assessment(task: any, evaluation: any, answer: string) {
    try {
      console.log("🟡 Constructing RPC Payload for question ID:", task.id);
      
      const rpcPayload = {
        p_data: {
          p_question_id: task.id || task.external_id || 'unknown',
          p_question_text: task.prompt || task.text || task.question || 'Unknown',
          p_user_answer: typeof answer === 'object' ? JSON.stringify(answer) : String(answer),
          p_correct_answer: task.correct_answer || evaluation?.expected || '',
          p_is_correct: !!(evaluation?.is_correct ?? (Number(evaluation?.score || 0) >= 0.7)),
          p_category: task.skill || 'general',
          p_confidence: evaluation?.confidence || evaluation?.score || 0,
          p_score: Number(evaluation?.score) || 0,
          p_metadata: {
            ...evaluation,
            user_answer: answer
          }
        }
      };

      console.log("🟡 Executing supabase.rpc('log_and_update_assessment')...");
      const { data, error } = await supabase.rpc('log_and_update_assessment', rpcPayload);

      console.log("🟡 rpc promise resolved. Checking for errors...");

      if (error) {
        console.error("❌ RPC Error:", error);
        throw error;
      }

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

