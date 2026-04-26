-- =============================================================================
-- Migration: Root Admin Protection + Teams Schema
-- Description: Creates the teams table, adds team columns to profiles,
--              and installs PostgreSQL triggers to make the root admin immortal.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. TEAMS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name  TEXT NOT NULL,
    admin_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- SuperAdmin (role=2): full CRUD
DROP POLICY IF EXISTS "SuperAdmin full access on teams" ON public.teams;
CREATE POLICY "SuperAdmin full access on teams"
ON public.teams FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2)
);

-- Admin (role=1): read-only
DROP POLICY IF EXISTS "Admin read access on teams" ON public.teams;
CREATE POLICY "Admin read access on teams"
ON public.teams FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role >= 1)
);

-- =============================================================================
-- 2. PROFILES TABLE ADDITIONS
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_team_leader'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_team_leader BOOLEAN DEFAULT FALSE;
    END IF;

    -- team_id may already exist from prior schema; add if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'team_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Index for fast team member lookups
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);

-- =============================================================================
-- 3. ROOT ADMIN IMMORTALITY — TRIGGERS
-- =============================================================================

-- 3a. Prevent DELETE on root admin
CREATE OR REPLACE FUNCTION protect_root_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.email = 'omaralwahsh8719@gmail.com' THEN
        RAISE EXCEPTION 'IMMORTAL_GUARD: Cannot delete root admin account (%).',
            OLD.email
            USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_root_admin_delete ON public.profiles;
CREATE TRIGGER trg_protect_root_admin_delete
    BEFORE DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_root_admin_delete();

-- 3b. Prevent role change on root admin
CREATE OR REPLACE FUNCTION protect_root_admin_role_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.email = 'omaralwahsh8719@gmail.com' THEN
        -- Allow normal field updates (name, avatar, etc.) but block role changes
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'IMMORTAL_GUARD: Cannot modify root admin role.',
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_root_admin_role_update ON public.profiles;
CREATE TRIGGER trg_protect_root_admin_role_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_root_admin_role_update();

-- =============================================================================
-- 4. ENSURE ROOT ADMIN IS ALWAYS ROLE 2
-- =============================================================================
-- Safety net: if the root admin somehow got demoted, fix it
UPDATE public.profiles
SET role = 2
WHERE email = 'omaralwahsh8719@gmail.com' AND role != 2;
