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

      const assessmentLog = {
        user_id: user.id,
        question_id: question.id,
        category: question.skill || question.category || 'general',
        user_answer: answer || '',
        correct_answer: question.correct_answer || (question.answer_key?.value) || '',
        score: evaluation.score !== undefined ? evaluation.score : 0, // Sending float directly for REAL column compatibility
        created_at: new Date().toISOString()
      };

      const { error: logError } = await supabase
        .from('assessment_logs')
        .insert([assessmentLog]);
      
      if (logError) {
        console.error("❌ [Database Error] Failed to save assessment log:", logError.message);
      } else {
        console.log(`✅ [Sync Success] Log persisted for: ${question.id}`);
      }

      // Bonus: Error Analysis (The "No-Error" Pattern)
      if (evaluation.score < 0.8) {
        const analysisEntry = {
          user_id: user.id,
          category: question.skill || question.category || 'general',
          user_answer: answer,
          suggested_band: evaluation.detected_level || evaluation.suggested_band,
          error_tag: evaluation.error_tag,
          brief_explanation: evaluation.feedback || evaluation.brief_explanation,
          error_rate: 1 - (evaluation.score || 0),
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
            skill: skillName, 
            current_score: Math.round(confidence * 10000), // Scaling float to Integer
            confidence: confidence,
            current_level: level,
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

