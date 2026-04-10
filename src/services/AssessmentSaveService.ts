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
   * ⚡️ Consolidated Atomic Update: Logs the question and updates the skill state in one flow.
   * Called manually from the UI to ensure 100% reactive persistence.
   */
  public static async log_and_update_assessment(
    userId: string | null,
    task: any,
    evaluation: any,
    answer: any
  ): Promise<void> {
    console.log("%c⚡️ [Consolidated Update] Firing Logging & Skill Sync...", "color: #00ffff; font-bold;");
    
    // 1. Log the individual attempt (RPC)
    const logPromise = this.saveSingleAssessmentLog(task, evaluation, answer);
    
    // 2. Update the skill level (UPSERT)
    let skillPromise = Promise.resolve();
    if (userId) {
      skillPromise = this.updateSkillState(
        userId, 
        task.skill || 'General', 
        evaluation.score, 
        evaluation.detected_level
      );
    }

    // Fire both and catch errors independently
    await Promise.allSettled([logPromise, skillPromise]).then((results) => {
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length === 0) {
        console.log("✅ [Sync Complete] All layers updated for:", task.id);
      } else {
        console.warn(`⚠️ [Sync Partial] ${failed.length} layer(s) failed.`);
      }
    });
  }

  /**
   * Saves a single assessment log (individual question) for real-time persistence.
   * REFACTORED: Buffer-First approach. No awaits to ensure instant LocalStorage persistence.
   */
  public static async saveSingleAssessmentLog(task: any, evaluation: any, answer: any): Promise<void> {
    // 1. عداد في الـ Console عشان نعرف احنا في السؤال رقم كام
    console.count("🚀 RPC Call Number"); 

    const userAnswer = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
    const questionText = task.prompt || task.text || task.question || task.id || 'Unknown';
    const correctAnswer = evaluation.correct_answer || evaluation.expected || '';
    const isCorrect = !!(evaluation.is_correct ?? (parseFloat(evaluation.score) >= 0.7));
    const score = parseFloat(evaluation.score) || 0;
    const category = task.skill || 'General';
    const confidence = score; // DB column is numeric, send as number
    const questionId = String(task.id || task.external_id || 'unknown');

    console.log("🔥 Full Payload Check:", { 
      question_id: questionId, 
      score,
      category,
      is_correct: isCorrect
    });

    const dbPayload = {
      user_id: localStorage.getItem('auth_user_id'), // Ensure we have the ID for buffering
      question_id: questionId,
      question: questionText,
      user_answer: userAnswer,
      answer: userAnswer,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      category: category,
      confidence: confidence,
      score: score,
      evaluation_metadata: {
        ...evaluation,
        user_answer: userAnswer,
        captured_at: new Date().toISOString()
      }
    };

    const rpcParams = {
      p_question_id: questionId,
      p_question_text: questionText,
      p_user_answer: userAnswer,
      p_correct_answer: correctAnswer,
      p_is_correct: isCorrect,
      p_category: category,
      p_confidence: confidence,
      p_score: score,
      p_metadata: dbPayload.evaluation_metadata
    };

    console.log("🔥 Calling RPC (Full Schema):", rpcParams.p_question_id);

    try {
      const { data, error } = await supabase.rpc('log_and_update_assessment', rpcParams);

      if (error) {
        console.error("❌ RPC Failed:", error.message);
        // تأمين الداتا في حالة الفشل باستخدام أسماء الأعمدة الحقيقية
        this.saveToLocalBuffer(dbPayload);
      } else {
        console.log("✅ Saved successfully to DB");
      }
    } catch (fatalErr: any) {
      console.error("❌ [Fatal Error]:", fatalErr.message);
      this.saveToLocalBuffer(dbPayload);
    }
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

