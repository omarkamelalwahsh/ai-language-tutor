CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- 1. Summary Hub (حذفنا الـ Unique للسماح بالتاريخ)
CREATE TABLE IF NOT EXISTS public.user_error_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_plan TEXT,
    weakness_areas JSONB DEFAULT '[]'::jsonb,
    full_report JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. Granular Analysis (ربطه بالبروفايل لضمان الدقة)
CREATE TABLE IF NOT EXISTS public.user_error_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.user_error_profiles(id) ON DELETE CASCADE,
    -- الربط هنا
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
-- إضافة Index للسرعة
CREATE INDEX IF NOT EXISTS idx_analysis_profile ON public.user_error_analysis(profile_id);