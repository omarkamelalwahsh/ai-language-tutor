import pool from '../server/db.js';

const TARGET_USER_ID = 'ab399725-e048-451f-a40c-bee3c7d3f5cf';

async function resetUser() {
  console.log(`🧹 Resetting user profile for ${TARGET_USER_ID}...`);
  try {
    // 1. Delete granular data
    await pool.query('DELETE FROM user_error_analysis WHERE user_id = $1', [TARGET_USER_ID]);
    await pool.query('DELETE FROM user_error_profiles WHERE user_id = $1', [TARGET_USER_ID]);
    await pool.query('DELETE FROM assessment_responses WHERE user_id = $1', [TARGET_USER_ID]);
    await pool.query('DELETE FROM skill_states WHERE user_id = $1', [TARGET_USER_ID]);
    
    // 2. Reset profile to pristine state
    await pool.query(`
      UPDATE learner_profiles 
      SET 
        onboarding_complete = FALSE,
        overall_level = 'Pending',
        points = 0,
        streak = 0,
        pacing_score = NULL,
        accuracy_rate = NULL,
        self_correction_rate = NULL,
        confidence_style = NULL,
        learning_goal = NULL,
        goal_context = NULL,
        focus_skills = NULL,
        learning_topics = NULL
      WHERE id = $1
    `, [TARGET_USER_ID]);

    // 3. Re-initialize skill states (optional but keeps it "New")
    await pool.query(`
      INSERT INTO skill_states (user_id, skill, current_score, confidence)
      VALUES 
        ($1, 'listening', 0, 0),
        ($1, 'reading', 0, 0),
        ($1, 'writing', 0, 0),
        ($1, 'speaking', 0, 0),
        ($1, 'grammar', 0, 0),
        ($1, 'vocabulary', 0, 0)
      ON CONFLICT DO NOTHING
    `, [TARGET_USER_ID]);

    console.log('✅ User reset successfully. They are now considered a "NEW" user.');
  } catch (err) {
    console.error('❌ Reset failed:', err);
  } finally {
    await pool.end();
  }
}

resetUser();
