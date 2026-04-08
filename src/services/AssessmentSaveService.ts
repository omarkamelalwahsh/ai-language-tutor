import { supabase } from '../lib/supabaseClient';
import { AssessmentOutcome } from '../types/assessment';

export class AssessmentSaveService {
  /**
   * Saves full assessment results to Supabase after the 20th question.
   */
  public static async saveAssessmentResults(outcome: AssessmentOutcome): Promise<void> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error('[AssessmentSave] Auth error – cannot save:', authError);
        return;
      }

      const userId = user.id;

      // ── 1. learner_profiles ──────────────────────────────────────────────────
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

      if (profileError) {
        console.error('[AssessmentSave] learner_profiles error:', profileError);
      } else {
        console.log('[AssessmentSave] ✅ learner_profiles saved. Level:', outcome.finalLevel || outcome.overallBand);
      }

      // ── 2. skill_states (ATOMIC UPSERT) ──────────────────────────────────────
      const skillKeys = Object.keys(outcome.skillBreakdown) as (keyof typeof outcome.skillBreakdown)[];

      const skillStatesData = skillKeys.map((skill) => ({
        user_id: userId,
        skill,
        current_level: String(outcome.skillBreakdown[skill].band),
        confidence: outcome.skillBreakdown[skill].confidence,
        updated_at: new Date().toISOString(),
      }));

      const { error: skillUpsertError } = await supabase
        .from('skill_states')
        .upsert(skillStatesData, { onConflict: 'user_id, skill' });

      if (skillUpsertError) {
        console.error('[AssessmentSave] skill_states upsert error:', skillUpsertError);
      } else {
        console.log('[AssessmentSave] ✅ skill_states synced:', skillStatesData.length, 'skills');
      }

      // ── 3. assessment_logs (Bulk Insert) ─────────────────────────────────────
      if (outcome.answerHistory && outcome.answerHistory.length > 0) {
        const logsData = outcome.answerHistory.map((record) => ({
          user_id: userId,
          category: record.skill,
          is_correct: record.correct,
          user_answer: record.answer ?? '',
          correct_answer: record.correctAnswer ?? '',
          error_tag: record.errorTag, // Preserving Model A details
          brief_explanation: record.briefExplanation,
          created_at: new Date().toISOString(),
        }));

        const { error: logsError } = await supabase
          .from('assessment_logs')
          .insert(logsData);

        if (logsError) {
          console.error('[AssessmentSave] assessment_logs error:', logsError);
        } else {
          console.log('[AssessmentSave] ✅ assessment_logs saved:', logsData.length, 'entries');
        }
      }

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

      const { error: errorProfileError } = await supabase
        .from('user_error_profiles')
        .upsert(errorProfilePayload, { onConflict: 'user_id' });

      if (errorProfileError) {
        console.error('[AssessmentSave] user_error_profiles error:', errorProfileError);
      } else {
        console.log('[AssessmentSave] ✅ user_error_profiles updated with detailed Model B analysis.');
      }
    } catch (e) {
      console.error('[AssessmentSave] Unexpected error:', e);
      throw e;
    }
  }
}
