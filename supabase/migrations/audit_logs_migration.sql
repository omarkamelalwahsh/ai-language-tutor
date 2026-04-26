-- =============================================================================
-- Migration: Tier 2 Audit Logs
-- Description: Creates the audit_logs table to track when a Team Admin
--              accesses deep data of a Member (Tier 2 visibility).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action         TEXT NOT NULL,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SuperAdmin (role=2): read all logs
DROP POLICY IF EXISTS "SuperAdmin read access on audit_logs" ON public.audit_logs;
CREATE POLICY "SuperAdmin read access on audit_logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2)
);

-- Team Admin (role=1): read only their own actions
DROP POLICY IF EXISTS "TeamAdmin read access on audit_logs" ON public.audit_logs;
CREATE POLICY "TeamAdmin read access on audit_logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  admin_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 1)
);

-- Any Admin/SuperAdmin can INSERT logs
DROP POLICY IF EXISTS "Admin insert access on audit_logs" ON public.audit_logs;
CREATE POLICY "Admin insert access on audit_logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (
  admin_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role >= 1)
);

-- Grant access to roles
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
