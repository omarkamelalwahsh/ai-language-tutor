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
   * Saves a single assessment log (individual question) for real-time persistence.
   * Signature updated to (question, evaluation, answer) for absolute data integrity.
   */
  public static async saveSingleAssessmentLog(question: any, evaluation: any, answer: string): Promise<void> {
    await withRetry(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const safeScore = evaluation && evaluation.score !== undefined ? parseFloat(evaluation.score) : 0;
      let finalScore = isFinite(safeScore) ? Math.max(0, Math.min(1, safeScore)) : 0;

      // 🛠️ Smart Expected Answer Extraction: Fixes [object Object] issue
      const ak = question.answer_key;
      const expectedAnswer = typeof ak === 'string' 
        ? ak 
        : (ak?.value?.text || ak?.value || ak?.text || (typeof ak === 'object' && JSON.stringify(ak)) || 'No expected answer');

      // ⚡ HYBRID SCORING LOGIC (The "Smart Move"): Absolute accuracy for MCQs
      const isMCQ = (question.type === 'mcq' || question.response_mode === 'mcq' || (question.options && question.options.length > 0));
      if (isMCQ && answer && expectedAnswer !== 'No expected answer') {
        const u = answer.trim().toLowerCase();
        const e = expectedAnswer.trim().toLowerCase();
        
        // 🎯 Robust Match: Direct match OR Prefix Match (e.g. user types "A" and key is "A) Option")
        const isMatch = (u === e) || 
                       (u.length === 1 && (e.startsWith(u + ")") || e.startsWith(u + "."))) ||
                       (e.length === 1 && (u.startsWith(e + ")") || u.startsWith(e + ".")));

        if (isMatch) {
          console.log(`[HybridScoring] 🎯 MCQ MATCH detected. Overriding score to 1.0 for: ${question.id}`);
          finalScore = 1.0;
        }
      }

      const assessmentLog = {
        // 🆕 NEW COLUMNS
        user_id: user.id,
        question_id: String(question.external_id || question.id || 'unknown'),
        user_answer: String(answer || ''),
        score: finalScore ?? 0,
        confidence: evaluation?.confidence ?? 0.9, 
        
        // 🏛️ LEGACY COLUMNS (Full Saturation - No NULLs)
        category: String(question.skill || question.category || 'general'),
        question: String(question.prompt || (question as any).text || 'Missing Prompt'),
        answer: String(expectedAnswer || 'No expected answer'), 
        correct_answer: String(expectedAnswer || 'No expected answer'), // 👈 Added for 100% Saturation
        is_correct: Boolean(finalScore >= 0.5), 
        
        created_at: new Date().toISOString()
      };

      // 🚀 FINAL SATURATION EXECUTION
      const { error: logError } = await supabase
        .from('assessment_logs')
        .insert([assessmentLog]);
      
      if (logError) {
        console.error("❌ [Database Error] Failed to save saturated assessment log:", logError.message);
      } else {
        console.log(`✅ [Mission Success] Perfect data saturation for: ${assessmentLog.question_id} (Score: ${finalScore})`);
      }

      // Bonus: Error Analysis (The "No-Error" Pattern)
      if (safeScore < 0.8) {
        const analysisEntry = {
          user_id: user.id,
          category: assessmentLog.category,
          user_answer: assessmentLog.user_answer,
          suggested_band: evaluation.detected_level || evaluation.suggested_band,
          error_tag: evaluation.error_tag,
          brief_explanation: evaluation.feedback || evaluation.brief_explanation,
          error_rate: 1 - safeScore,
          created_at: new Date().toISOString()
        };

        const { error: analysisError } = await supabase
          .from('user_error_analysis')
          .insert([analysisEntry]);

        if (analysisError) console.warn('[AssessmentSave] Analysis insert failed:', analysisError.message);
      }
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

