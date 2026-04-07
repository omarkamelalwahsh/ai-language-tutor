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

      // ── 2. skill_states ──────────────────────────────────────────────────────
      const skillKeys = Object.keys(outcome.skillBreakdown) as (keyof typeof outcome.skillBreakdown)[];

      const skillStatesData = skillKeys.map((skill) => ({
        user_id: userId,
        skill,
        current_level: String(outcome.skillBreakdown[skill].band),
        confidence: outcome.skillBreakdown[skill].confidence,
        updated_at: new Date().toISOString(),
      }));

      // Delete stale rows first, then re-insert fresh ones
      const { error: deleteSkillError } = await supabase
        .from('skill_states')
        .delete()
        .eq('user_id', userId);

      if (deleteSkillError) {
        console.warn('[AssessmentSave] skill_states delete warning:', deleteSkillError);
      }

      const { error: skillInsertError } = await supabase
        .from('skill_states')
        .insert(skillStatesData);

      if (skillInsertError) {
        console.error('[AssessmentSave] skill_states insert error:', skillInsertError);
      } else {
        console.log('[AssessmentSave] ✅ skill_states saved:', skillStatesData.length, 'skills');
      }

      // ── 3. assessment_logs  (single bulk insert) ─────────────────────────────
      if (outcome.answerHistory && outcome.answerHistory.length > 0) {
        const logsData = outcome.answerHistory.map((record) => ({
          user_id: userId,
          category: record.skill,          // mapped from AnswerRecord.skill
          is_correct: record.correct,
          user_answer: record.answer ?? '',
          correct_answer: record.correctAnswer ?? '',
          created_at: new Date().toISOString(),
        }));

        const { error: logsError } = await supabase
          .from('assessment_logs')
          .insert(logsData);

        if (logsError) {
          console.error('[AssessmentSave] assessment_logs bulk insert error:', logsError);
        } else {
          console.log('[AssessmentSave] ✅ assessment_logs saved:', logsData.length, 'entries');
        }
      } else {
        console.warn('[AssessmentSave] No answer history to save – assessment_logs skipped.');
      }

      // ── 4. user_error_profiles ───────────────────────────────────────────────
      if (outcome.weaknesses && outcome.weaknesses.length > 0) {
        const errorsData = outcome.weaknesses.map((w) => ({
          user_id: userId,
          skill: 'General', // Heuristic: map specific skill if available in outcome
          context: w,
          created_at: new Date().toISOString()
        }));

        await supabase.from('user_error_profiles').insert(errorsData);
        console.log('[AssessmentSave] ✅ user_error_profiles updated.');
      }
    } catch (e) {
      console.error('[AssessmentSave] Unexpected error:', e);
      throw e; // re-throw so DiagnosticView can catch and show saveError
    }
  }
}
