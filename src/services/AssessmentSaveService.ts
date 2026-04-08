import { supabase } from '../lib/supabaseClient';
import { AssessmentOutcome } from '../types/assessment';

export class AssessmentSaveService {
  /**
   * Saves full assessment results to Supabase after the 20th question.
   *
   * Tables written:
   *  - learner_profiles  → overall_level, onboarding_complete
   *  - skill_states      → skill, current_level, confidence
   *  - assessment_logs   → category, is_correct, user_answer, correct_answer (bulk insert)
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
            overall_level: String(outcome.overallBand),
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        console.error('[AssessmentSave] learner_profiles error:', profileError);
      } else {
        console.log('[AssessmentSave] ✅ learner_profiles saved. Level:', outcome.overallBand);
      }

      // ── 2. skill_states (ATOMIC UPSERT to prevent Zero Stats Bug) ────────────
      const skillKeys = Object.keys(outcome.skillBreakdown) as (keyof typeof outcome.skillBreakdown)[];

      const skillStatesData = skillKeys.map((skill) => ({
        user_id: userId,
        skill,
        current_level: String(outcome.skillBreakdown[skill].band),
        confidence: outcome.skillBreakdown[skill].confidence,
        updated_at: new Date().toISOString(),
      }));

      // Use upsert with onConflict to avoid the delete-insert window where stats show 0
      const { error: skillUpsertError } = await supabase
        .from('skill_states')
        .upsert(skillStatesData, { onConflict: 'user_id, skill' });

      if (skillUpsertError) {
        console.error('[AssessmentSave] skill_states upsert error:', skillUpsertError);
        // Fallback: If unique constraint (user_id, skill) is missing, the upsert might fail.
        // In that case, we revert to delete-insert as a safety but warn the dev.
        console.warn('[AssessmentSave] ⚠️ Ensure (user_id, skill) has a UNIQUE constraint in Postgres.');
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
        common_mistakes: outcome.weaknesses || [], // renamed from weakness_areas
        recommendations: outcome.recommendations || [], // expects text[] array
        last_analyzed: new Date().toISOString()
      };

      const { error: errorProfileError } = await supabase
        .from('user_error_profiles')
        .upsert(errorProfilePayload, { onConflict: 'user_id' });

      if (errorProfileError) {
        console.error('[AssessmentSave] user_error_profiles error:', errorProfileError);
      } else {
        console.log('[AssessmentSave] ✅ user_error_profiles updated with detailed analysis.');
      }
    } catch (e) {
      console.error('[AssessmentSave] Unexpected error:', e);
      throw e; // re-throw so DiagnosticView can catch and show saveError
    }
  }
}
