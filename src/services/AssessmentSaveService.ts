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
   * Aligned with strict Supabase data formatting (UUID, Boolean casting).
   */
  public static async saveSingleAssessmentLog(logData: {
    category: string;
    is_correct: boolean;
    user_answer: string;
    correct_answer: string;
    suggested_band: string;
    error_tag?: string;
    brief_explanation?: string;
  }): Promise<void> {
    await withRetry(async () => {
      // 🔐 Fetch user directly from Auth for UUID integrity
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('UNAUTHORIZED_SAVE_ATTEMPT');

      const logEntry = {
        user_id: user.id,
        category: logData.category || 'general',
        is_correct: Boolean(logData.is_correct),
        user_answer: logData.user_answer,
        correct_answer: logData.correct_answer,
        suggested_band: logData.suggested_band,
        error_tag: logData.error_tag,
        brief_explanation: logData.brief_explanation,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_error_analysis')
        .insert([logEntry]);

      if (error) throw error;
      console.log('[AssessmentSave] 📝 Single log persisted successfully (UUID Verified).');
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


      // ── 2. skill_states (ATOMIC UPSERT) ──────────────────────────────────────
      const skillKeys = Object.keys(outcome.skillBreakdown) as (keyof typeof outcome.skillBreakdown)[];
      const skillStatesData = skillKeys.map((skill) => ({
        user_id: userId,
        skill,
        current_level: String(outcome.skillBreakdown[skill].band),
        confidence: outcome.skillBreakdown[skill].confidence,
        updated_at: new Date().toISOString(),
      }));

      await withRetry(async () => {
        const { error: skillUpsertError } = await supabase
          .from('skill_states')
          .upsert(skillStatesData, { onConflict: 'user_id, skill' });

        if (skillUpsertError) throw skillUpsertError;
        console.log('[AssessmentSave] ✅ skill_states synced:', skillStatesData.length, 'skills');
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
}

