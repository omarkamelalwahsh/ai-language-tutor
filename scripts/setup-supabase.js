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

    // 2. Learner Profiles (The Brain of the Adaptive System)
    console.log('Creating [learner_profiles] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS learner_profiles (
        id UUID PRIMARY KEY, -- Maps directly to auth.users.id
        full_name TEXT,
        overall_level TEXT DEFAULT 'B1',
        onboarding_complete BOOLEAN DEFAULT FALSE,
        points INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        pacing_score INTEGER DEFAULT 75,
        confidence_style TEXT DEFAULT 'Calculated',
        self_correction_rate INTEGER DEFAULT 82,
        accuracy_rate INTEGER DEFAULT 82,
        has_completed_assessment BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure schema is up to date if table already existed
    await client.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='learner_profiles' AND column_name='overall_band') THEN
          ALTER TABLE learner_profiles RENAME COLUMN overall_band TO overall_level;
        END IF;
      END $$;
      
      ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS pacing_score INTEGER DEFAULT 75;
      ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS confidence_style TEXT DEFAULT 'Calculated';
      ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS self_correction_rate INTEGER DEFAULT 82;
      ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS accuracy_rate INTEGER DEFAULT 82;
      ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS has_completed_assessment BOOLEAN DEFAULT FALSE;
      ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);

    // 3. Skill States (proficiency decomposition)
    console.log('Creating [skill_states] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS skill_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES learner_profiles(id) ON DELETE CASCADE,
        skill VARCHAR(50) NOT NULL,
        current_level TEXT,
        current_score INTEGER,
        confidence NUMERIC,
        level TEXT,
        last_tested TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
        user_id UUID REFERENCES learner_profiles(id) ON DELETE CASCADE,
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

    // 6. Automation Triggers (The "Savior" Logic)
    console.log('Creating [handle_new_user] trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.learner_profiles (id, full_name, overall_level)
        VALUES (new.id, new.raw_user_meta_data->>'full_name', 'A1');

        -- Initialize Skill States
        INSERT INTO public.skill_states (user_id, skill)
        VALUES 
          (new.id, 'listening'),
          (new.id, 'reading'),
          (new.id, 'writing'),
          (new.id, 'speaking'),
          (new.id, 'grammar'),
          (new.id, 'vocabulary');

        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Check if trigger exists before creating
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
          CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
        END IF;
      END $$;

      -- 7. Points & Streak RPC (Incremental Stability)
      CREATE OR REPLACE FUNCTION public.increment_learner_points(target_user uuid, points_to_add int)
      RETURNS void AS $$
      BEGIN
        UPDATE public.learner_profiles
        SET 
          points = COALESCE(points, 0) + points_to_add,
          updated_at = NOW()
        WHERE id = target_user;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
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
