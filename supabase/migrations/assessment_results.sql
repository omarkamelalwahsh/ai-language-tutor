-- SQL Migration: Setup Assessment Results Table
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_analysis JSONB NOT NULL,
    final_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure exactly one "Final Analysis" per user
    CONSTRAINT unique_user_result UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own results
CREATE POLICY "Users can view own assessment results" 
ON public.assessment_results FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Allow Edge Function (service_role) or Authenticated (if needed)
CREATE POLICY "Authenticated users can upsert assessment results"
ON public.assessment_results FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
