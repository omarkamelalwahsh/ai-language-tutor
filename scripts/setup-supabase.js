import pool from '../server/db.js';

async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Supabase Database Setup...');
    await client.query('BEGIN');

    // 1. Users table
    console.log('Creating [users] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Learner Profiles
    console.log('Creating [learner_profiles] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS learner_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        overall_band VARCHAR(10) DEFAULT 'A1',
        total_time_spent INTEGER DEFAULT 0,
        assessments_completed INTEGER DEFAULT 0,
        onboarding_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Skill States
    console.log('Creating [skill_states] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS skill_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        skill VARCHAR(50) NOT NULL,
        current_level VARCHAR(10) DEFAULT 'A1',
        confidence REAL DEFAULT 0.5,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, skill)
      );
    `);

    // 4. Question Bank Items (Already migrated, but ensuring table exists)
    console.log('Checking [question_bank_items] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS question_bank_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(100) UNIQUE,
        skill VARCHAR(50),
        task_type VARCHAR(100),
        target_cefr VARCHAR(10),
        difficulty REAL DEFAULT 0.5,
        prompt TEXT,
        stimulus TEXT,
        answer_key JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Assessment Responses
    console.log('Creating [assessment_responses] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS assessment_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assessment_id UUID,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        question_id UUID REFERENCES question_bank_items(id),
        user_answer TEXT,
        score REAL,
        explanation JSONB,
        skill VARCHAR(50),
        question_level VARCHAR(10),
        answer_level VARCHAR(10),
        is_correct BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('✅ All tables initialized on Supabase Cloud!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database Setup Failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase();
