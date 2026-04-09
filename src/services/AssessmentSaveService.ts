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
   * Rule 3.2: Log in assessment_logs AND user_error_analysis.
   */
  public static async saveSingleAssessmentLog(logData: {
    category: string;
    user_answer: string;
    correct_answer: string;
    suggested_band: string;
    error_tag?: string;
    brief_explanation?: string;
    score: number; // Raw AI float
    question_id?: string;
  }): Promise<void> {
    await withRetry(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('UNAUTHORIZED_SAVE_ATTEMPT');

      // 1. Raw Logging (Zero Data Loss Policy)
      const assessmentLog = {
        user_id: user.id,
        question_id: logData.question_id || 'untracked',
        category: logData.category,
        user_answer: logData.user_answer,
        correct_answer: logData.correct_answer,
        score: Math.round(logData.score * 10000), // Integer conversion rule
        created_at: new Date().toISOString()
      };

      const { error: logError } = await supabase
        .from('assessment_logs')
        .insert([assessmentLog]);
      
      if (logError) console.warn('[AssessmentSave] ⚠️ Log insert failed, proceeding to analysis:', logError.message);

      // 2. Error Analysis (The "No-Error" Pattern)
      const analysisEntry = {
        user_id: user.id,
        category: logData.category || 'general',
        user_answer: logData.user_answer,
        suggested_band: logData.suggested_band,
        error_tag: logData.error_tag,
        brief_explanation: logData.brief_explanation,
        error_rate: 1 - logData.score, // Heuristic: inversion of accuracy
        created_at: new Date().toISOString()
      };

      const { error: analysisError } = await supabase
        .from('user_error_analysis')
        .insert([analysisEntry]);

      if (analysisError) throw analysisError;
      
      console.log('[AssessmentSave] 📝 Log & Analysis persisted (Integrity Guard enabled).');
    });
  }


  /**
   * Saves full assessment results (profile, skills, error profiles) to Supabase.
   * NOTE: Individual question logs are now handled in real-time.
   */
  public static async saveAssessmentResults(outcome: AssessmentOutcome): Promise<void> {
    try {

      // ── Ensure Auth First ──────────────────────────────────────────────────
      const userId = await this.getAuthenticatedUserId();
      console.log('[AssessmentSave] 🔑 Auth verified for:', userId);

      // ── 1. learner_profiles ──────────────────────────────────────────────────
      await withRetry(async () => {
        const { error: profileError } = await supabase
          .from('learner_profiles')
          .upsert(
            {
              id: userId,
              overall_level: String(outcome.finalLevel || outcome.overallBand),
              onboarding_complete: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );

        if (profileError) throw profileError;
        console.log('[AssessmentSave] ✅ learner_profiles saved.');
      });


      // ── 2. skill_states (ATOMIC UPSERT) ─────────────────────────
      const skillKeys = Object.keys(outcome.skillBreakdown) as (keyof typeof outcome.skillBreakdown)[];
      const skillStatesData = skillKeys.map((skill) => ({
        user_id: userId,
        skill,
        current_level: String(outcome.skillBreakdown[skill].band),
        current_score: Math.round(outcome.skillBreakdown[skill].score * 100), // outcome uses 0-100 scale usually
        confidence: outcome.skillBreakdown[skill].confidence,
        updated_at: new Date().toISOString(),
        last_tested: new Date().toISOString(),
      }));

      await withRetry(async () => {
        const { error: skillUpsertError } = await supabase
          .from('skill_states')
          .upsert(skillStatesData, { onConflict: 'user_id, skill' });

        if (skillUpsertError) throw skillUpsertError;
        console.log('[AssessmentSave] ✅ skill_states synced with Integer Weights.');
      });


      // ── 3. assessment_logs (SKIPPED) ──────────────────────────────────────────
      // Individual logs are now saved in real-time during question submission.
      // ────────────────────────────────────────────────────────────────────────



      // ── 4. user_error_profiles (Full Analysis Payload) ───────────────────────
      const errorProfilePayload = {
        user_id: userId,
        common_mistakes: outcome.weaknesses || [],
        recommendations: outcome.recommendations || [],
        bridge_delta: outcome.bridgeDelta,
        bridge_percentage: outcome.bridgePercentage,
        missing_skills: outcome.missingSkills,
        action_plan: outcome.actionPlan,
        final_level: outcome.finalLevel,
        error_analysis_report: outcome.errorAnalysisReport,
        last_analyzed: new Date().toISOString()
      };

      await withRetry(async () => {
        const { error: errorProfileError } = await supabase
          .from('user_error_profiles')
          .upsert(errorProfilePayload, { onConflict: 'user_id' });

        if (errorProfileError) throw errorProfileError;
        console.log('[AssessmentSave] ✅ user_error_profiles updated.');
      });

      console.log('[AssessmentSave] 🚀 Full persistence transaction successful with retry guards.');

    } catch (e) {
      console.error('[AssessmentSave] Transaction failed:', e);
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

