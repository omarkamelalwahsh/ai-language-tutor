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
        overall_level TEXT DEFAULT 'Pending',
        onboarding_complete BOOLEAN DEFAULT FALSE,
        learning_goal TEXT,
        goal_context TEXT,
        focus_skills JSONB,
        learning_topics JSONB,
        session_intensity TEXT,
        native_language TEXT,
        target_language TEXT,
        points INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        pacing_score INTEGER DEFAULT NULL,
        confidence_style TEXT DEFAULT NULL,
        self_correction_rate INTEGER DEFAULT NULL,
        accuracy_rate INTEGER DEFAULT NULL,
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
      
      ALTER TABLE learner_profiles ALTER COLUMN overall_level SET DEFAULT 'Pending';
      ALTER TABLE learner_profiles ALTER COLUMN pacing_score SET DEFAULT NULL;
      ALTER TABLE learner_profiles ALTER COLUMN confidence_style SET DEFAULT NULL;
      ALTER TABLE learner_profiles ALTER COLUMN self_correction_rate SET DEFAULT NULL;
      ALTER TABLE learner_profiles ALTER COLUMN accuracy_rate SET DEFAULT NULL;
      ALTER TABLE learner_profiles ALTER COLUMN onboarding_complete SET DEFAULT FALSE;
      -- Add missing columns if they don't exist
      DO $$ BEGIN
        ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS learning_goal TEXT;
        ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS goal_context TEXT;
        ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS focus_skills JSONB;
        ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS learning_topics JSONB;
        ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS session_intensity TEXT;
        ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS native_language TEXT;
        ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS target_language TEXT;
      EXCEPTION
        WHEN duplicate_column THEN NULL;
      END $$;
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

    // 6. User Error Analysis (The "Why" Layer)
    console.log('Creating [user_error_analysis] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_error_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES learner_profiles(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        total_questions INTEGER DEFAULT 0,
        mistakes_count INTEGER DEFAULT 0,
        error_rate NUMERIC DEFAULT 0,
        brief_explanation TEXT,
        error_tag TEXT,
        suggested_band TEXT,
        correct_answer TEXT,
        is_correct BOOLEAN,
        user_answer TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 7. User Error Profiles (The Dashboard Insights)
    console.log('Creating [user_error_profiles] table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_error_profiles (
        user_id UUID PRIMARY KEY REFERENCES learner_profiles(id) ON DELETE CASCADE,
        weakness_areas TEXT[], -- PostgreSQL ARRAY type
        common_mistakes TEXT[],
        action_plan TEXT,
        bridge_delta DOUBLE PRECISION,
        bridge_percentage DOUBLE PRECISION,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 6. Automation Triggers (The "Savior" Logic)
    console.log('Creating [handle_new_user] trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.learner_profiles (id, full_name, overall_level, onboarding_complete)
        VALUES (new.id, new.raw_user_meta_data->>'full_name', 'Pending', FALSE);

        -- Initialize Skill States with nulls
        INSERT INTO public.skill_states (user_id, skill, current_score, confidence)
        VALUES 
          (new.id, 'listening', 0, 0),
          (new.id, 'reading', 0, 0),
          (new.id, 'writing', 0, 0),
          (new.id, 'speaking', 0, 0),
          (new.id, 'grammar', 0, 0),
          (new.id, 'vocabulary', 0, 0);

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

      -- 8. Points & Streak RPC (Incremental Stability)
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

      -- 9. Skill Confidence Incremental RPC
      CREATE OR REPLACE FUNCTION public.increment_skill_confidence(target_user uuid, target_skill text, delta float8)
      RETURNS void AS $$
      BEGIN
        UPDATE public.skill_states
        SET 
          confidence = GREATEST(0.0, LEAST(1.0, COALESCE(confidence, 0.5) + delta)),
          last_tested = NOW(),
          updated_at = NOW()
        WHERE user_id = target_user AND (skill = target_skill OR skill = LOWER(target_skill));
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- 10. Atomic Evaluation Bundle (The Senior Standard)
      CREATE OR REPLACE FUNCTION public.process_evaluation_bundle(
        p_user_id uuid,
        p_points int,
        p_skill text,
        p_delta float8,
        p_predicted_level text
      )
      RETURNS void AS $$
      BEGIN
        -- 1. Update Points & Global Level
        UPDATE public.learner_profiles
        SET 
          points = COALESCE(points, 0) + p_points,
          overall_level = COALESCE(p_predicted_level, overall_level),
          updated_at = NOW()
        WHERE id = p_user_id;

        -- 2. Update Skill State
        UPDATE public.skill_states
        SET 
          confidence = GREATEST(0.0, LEAST(1.0, COALESCE(confidence, 0.5) + p_delta)),
          last_tested = NOW(),
          updated_at = NOW()
        WHERE user_id = p_user_id AND (skill = p_skill OR skill = LOWER(p_skill));
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      -- 11. Full Diagnostic Finalizer (Atomic Guarantee)
      CREATE OR REPLACE FUNCTION public.finalize_diagnostic_v2(
        p_user_id uuid,
        p_final_level text,
        p_points int,
        p_skill_breakdown jsonb,
        p_weaknesses text[],
        p_action_plan text,
        p_common_mistakes text[],
        p_bridge_delta text DEFAULT NULL,
        p_bridge_percentage float8 DEFAULT NULL
      )
      RETURNS void AS $$
      DECLARE
        skill_key text;
        skill_val jsonb;
      BEGIN
        -- 1. Update Profile (The Core Unlock)
        UPDATE public.learner_profiles
        SET 
          overall_level = p_final_level,
          points = COALESCE(points, 0) + p_points,
          updated_at = NOW()
        WHERE id = p_user_id;

        -- 2. Upsert Skill States
        FOR skill_key, skill_val IN SELECT * FROM jsonb_each(p_skill_breakdown)
        LOOP
          INSERT INTO public.skill_states (user_id, skill, current_level, current_score, confidence, last_tested, updated_at)
          VALUES (
            p_user_id, 
            skill_key, 
            skill_val->>'band', 
            (skill_val->>'score')::int, 
            (skill_val->>'confidence')::float8,
            NOW(),
            NOW()
          )
          ON CONFLICT (user_id, skill) DO UPDATE
          SET
            current_level = EXCLUDED.current_level,
            current_score = EXCLUDED.current_score,
            confidence = EXCLUDED.confidence,
            last_tested = EXCLUDED.last_tested,
            updated_at = EXCLUDED.updated_at;
        END LOOP;

        -- 3. Upsert Error Profile (Dashboard Insights)
        INSERT INTO public.user_error_profiles (
          user_id, 
          weakness_areas, 
          common_mistakes, 
          action_plan, 
          bridge_delta, 
          bridge_percentage, 
          updated_at
        )
        VALUES (
          p_user_id, 
          p_weaknesses, 
          p_common_mistakes, 
          p_action_plan, 
          p_bridge_delta, 
          p_bridge_percentage, 
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
          weakness_areas = EXCLUDED.weakness_areas,
          common_mistakes = EXCLUDED.common_mistakes,
          action_plan = EXCLUDED.action_plan,
          bridge_delta = EXCLUDED.bridge_delta,
          bridge_percentage = EXCLUDED.bridge_percentage,
          updated_at = EXCLUDED.updated_at;

        -- 4. Final Unlock (The sequence ensures charts are ready before dashboard loads)
        UPDATE public.learner_profiles 
        SET onboarding_complete = TRUE 
        WHERE id = p_user_id;

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
