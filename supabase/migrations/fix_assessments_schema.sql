-- SQL Migration: Aligns assessments and assessment_responses with the new Python Backend
-- Run this in your Supabase SQL Editor

-- 1. Hardening 'assessments' table
DO $$ 
BEGIN 
    -- Add evaluation_metadata if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessments' AND column_name='evaluation_metadata') THEN
        ALTER TABLE public.assessments ADD COLUMN evaluation_metadata JSONB;
    END IF;

    -- Add current_index if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessments' AND column_name='current_index') THEN
        ALTER TABLE public.assessments ADD COLUMN current_index INTEGER DEFAULT 0;
    END IF;

    -- Add updated_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessments' AND column_name='updated_at') THEN
        ALTER TABLE public.assessments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Ensure 'status' is correct
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessments' AND column_name='status') THEN
        ALTER TABLE public.assessments ADD COLUMN status TEXT DEFAULT 'in_progress';
    END IF;
END $$;

-- 2. Ensure 'assessment_responses' table structure matches
CREATE TABLE IF NOT EXISTS public.assessment_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID,
    user_answer TEXT,
    is_correct BOOLEAN,
    score FLOAT,
    answer_level TEXT,
    raw_evaluation JSONB,
    skill TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS and add policies for security
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own assessments" ON public.assessments;
CREATE POLICY "Users can manage own assessments" ON public.assessments
    FOR ALL TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own assessment_responses" ON public.assessment_responses;
CREATE POLICY "Users can manage own assessment_responses" ON public.assessment_responses
    FOR ALL TO authenticated USING (auth.uid() = user_id);
