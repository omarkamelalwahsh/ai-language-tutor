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
  public static async saveSingleAssessmentLog(question: any, evaluation: any, answer: string): Promise<void> {
    // 1. Get userId instantly from LocalStorage (Production UUID check)
    const userId = localStorage.getItem('auth_user_id') || 'anonymous';
    
    // 2. Prepare CLEAN PAYLOAD (No 'id' field - let Supabase handle auto-generation)
    const safeScore = evaluation && evaluation.score !== undefined ? parseFloat(evaluation.score) : 0;
    const finalScore = isFinite(safeScore) ? Math.max(0, Math.min(1, safeScore)) : 0;

    const ak = question.answer_key;
    const expectedAnswer = typeof ak === 'string' 
      ? ak 
      : (ak?.value?.text || ak?.value || ak?.text || (typeof ak === 'object' && JSON.stringify(ak)) || 'No expected answer');

    const assessmentLog = {
      user_id: userId,
      question_id: String(question.external_id || question.id || 'N/A'),
      user_answer: typeof answer === 'object' ? JSON.stringify(answer) : String(answer || 'N/A'),
      score: finalScore ?? 0,
      confidence: evaluation?.confidence ?? 0.9, 
      category: String(question.skill || question.category || 'general'),
      question: String(question.prompt || (question as any).text || 'Missing Prompt'),
      answer: typeof expectedAnswer === 'object' ? JSON.stringify(expectedAnswer) : String(expectedAnswer || 'N/A'), 
      correct_answer: typeof question.answer_key === 'object' ? JSON.stringify(question.answer_key) : String(expectedAnswer || 'N/A'), 
      is_correct: Boolean(finalScore >= 0.5), 
      evaluation_metadata: typeof evaluation === 'object' ? JSON.stringify(evaluation) : String(evaluation || '{}'),
      created_at: new Date().toISOString()
    };

    console.log("📤 [Save Service] Attempting background insert for User:", userId, "Task:", assessmentLog.question_id);

    // 3. 🔒 BUFFER FIRST (Zero-Crash Protocol)
    // Secure the data in LocalStorage before any network activity
    this.saveToLocalBuffer(assessmentLog);
    console.log(`💾 [Buffer] Data secured for ${assessmentLog.question_id}. Pending in queue: ${JSON.parse(localStorage.getItem('pending_assessment_logs') || '[]').length}`);

    // 4. 🚀 SMART CUMULATIVE SYNC
    // This triggers a background bulk sync for ALL items in the buffer.
    this.syncPendingLogs();

    // 5. Handle Error Analysis (Non-blocking)
    if (finalScore < 0.8 && userId !== 'anonymous') {
      const analysisEntry = {
        user_id: userId,
        category: assessmentLog.category,
        user_answer: assessmentLog.user_answer,
        suggested_band: String(evaluation.detected_level || evaluation.suggested_band || 'A1'),
        error_tag: String(evaluation.error_tag || 'general'),
        brief_explanation: String(evaluation.feedback || evaluation.brief_explanation || 'Assessment evaluation entry'),
        error_rate: 1 - finalScore,
        created_at: assessmentLog.created_at
      };
      supabase.from('user_error_analysis').insert([analysisEntry]).then(({ error }) => {
        if (error) console.warn('[AssessmentSave] Analysis insert failed:', error.message);
      });
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

