import pool from './server/db.js';
async function check() {
  try {
    const res = await pool.query(`
      SELECT column_name, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'learner_profiles' 
      AND column_name = 'onboarding_complete'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
