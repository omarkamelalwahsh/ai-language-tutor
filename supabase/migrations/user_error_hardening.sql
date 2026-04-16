-- Hardening User Error Analysis System
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure user_error_profiles has the right structure
-- We use a separate ID for the profile to allow multiple assessment sessions
CREATE TABLE IF NOT EXISTS public.user_error_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_plan TEXT,
    weakness_areas JSONB DEFAULT '[]'::jsonb,
    full_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update user_error_analysis to link to profiles and include question_id
CREATE TABLE IF NOT EXISTS public.user_error_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.user_error_profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID, -- Protected link to question_bank_items
    category TEXT,
    is_correct BOOLEAN DEFAULT FALSE,
    ai_interpretation TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    deep_insight TEXT,
    question_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration for existing table structure if needed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_error_analysis' AND column_name='profile_id') THEN
        ALTER TABLE public.user_error_analysis ADD COLUMN profile_id UUID REFERENCES public.user_error_profiles(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_error_analysis' AND column_name='question_id') THEN
        ALTER TABLE public.user_error_analysis ADD COLUMN question_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_error_analysis' AND column_name='deep_insight') THEN
        ALTER TABLE public.user_error_analysis ADD COLUMN deep_insight TEXT;
    END IF;
END $$;

-- 3. RLS Activation
ALTER TABLE public.user_error_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_error_analysis ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Profiles (Using per-user access)
DROP POLICY IF EXISTS "Users can view own error profiles" ON public.user_error_profiles;
CREATE POLICY "Users can view own error profiles"
ON public.user_error_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own error profiles" ON public.user_error_profiles;
CREATE POLICY "Users can insert own error profiles"
ON public.user_error_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own error profiles" ON public.user_error_profiles;
CREATE POLICY "Users can update own error profiles"
ON public.user_error_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 5. Policies for Analysis (Using per-user access)
DROP POLICY IF EXISTS "Users can view own error analysis" ON public.user_error_analysis;
CREATE POLICY "Users can view own error analysis"
ON public.user_error_analysis FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own error analysis" ON public.user_error_analysis;
CREATE POLICY "Users can insert own error analysis"
ON public.user_error_analysis FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_error_analysis_profile ON public.user_error_analysis(profile_id);
CREATE INDEX IF NOT EXISTS idx_error_analysis_user ON public.user_error_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_error_profiles_user ON public.user_error_profiles(user_id);
