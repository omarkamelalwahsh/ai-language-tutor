-- SQL Migration: Refined Assessment Storage (3-Table Strategy)
-- Run this in the Supabase SQL Editor

-- 1. Summary & JSON Hub (Section 1-4)
CREATE TABLE IF NOT EXISTS public.user_error_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_plan TEXT,
    weakness_areas JSONB DEFAULT '[]'::jsonb,
    full_report JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_error_profile UNIQUE (user_id)
);

-- 2. Granular Analysis (Section 5 - Question by Question)
CREATE TABLE IF NOT EXISTS public.user_error_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    is_correct BOOLEAN,
    ai_interpretation TEXT,
    deep_insight TEXT,
    question_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_error_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_error_analysis ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
CREATE POLICY "Users can view own error profiles" ON public.user_error_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can manage own error profiles" ON public.user_error_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for Analysis
CREATE POLICY "Users can view own error analysis" ON public.user_error_analysis FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert own error analysis" ON public.user_error_analysis FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Explicitly allow service_role (Edge Functions)
CREATE POLICY "Service role can manage everything" ON public.user_error_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage analysis" ON public.user_error_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
