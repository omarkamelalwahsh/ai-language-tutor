-- 1. تفعيل الـ Extension لضمان عمل الـ UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. إنشاء الجدول (بدون Constraint الـ Unique على اليوزر)
CREATE TABLE IF NOT EXISTS public.assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_analysis JSONB NOT NULL,
    final_level TEXT NOT NULL, -- خليناها NOT NULL لضمان جودة البيانات
    accuracy_rate FLOAT DEFAULT 0, -- إضافة حقول مساعدة للـ Dashboard
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. تفعيل الـ RLS
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

-- 4. سياسة القراءة (يقرأ حاجته بس)
CREATE POLICY "Users can view own assessment results" 
ON public.assessment_results FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 5. سياسة الكتابة (إضافة نتايج جديدة)
CREATE POLICY "Users can insert own assessment results"
ON public.assessment_results FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 6. إضافة Index لتسريع جلب أحدث نتيجة (Performance Optimization)
CREATE INDEX IF NOT EXISTS idx_assessment_results_user_date 
ON public.assessment_results (user_id, created_at DESC);