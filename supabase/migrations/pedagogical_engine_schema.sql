-- Phase 1: Database Schema Design (Memory)

-- Task 1.1: Skill Matrix (user_proficiency)
CREATE TABLE IF NOT EXISTS public.user_proficiency (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    reading_level TEXT DEFAULT 'A1',
    listening_level TEXT DEFAULT 'A1',
    writing_level TEXT DEFAULT 'A1',
    speaking_level TEXT DEFAULT 'A1',
    reading_xp INTEGER DEFAULT 0,
    listening_xp INTEGER DEFAULT 0,
    writing_xp INTEGER DEFAULT 0,
    speaking_xp INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Task 1.2: Error Ledger (error_profiles)
CREATE TABLE IF NOT EXISTS public.error_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    error_ledger JSONB DEFAULT '{}'::jsonb, -- Stores { "grammar_rule": { "count": 2, "last_failed": "..." } }
    chronic_errors JSONB DEFAULT '[]'::jsonb, -- Stores list of flagged rules
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task 1.3: Journey Map (journey_progress)
CREATE TABLE IF NOT EXISTS public.journey_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    is_locked BOOLEAN DEFAULT TRUE,
    score FLOAT DEFAULT 0.0,
    status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed'
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, node_id)
);

-- Enable RLS
ALTER TABLE public.user_proficiency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own proficiency" ON public.user_proficiency FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own proficiency" ON public.user_proficiency FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own error profiles" ON public.error_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own error profiles" ON public.error_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own journey progress" ON public.journey_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own journey progress" ON public.journey_progress FOR UPDATE USING (auth.uid() = user_id);
