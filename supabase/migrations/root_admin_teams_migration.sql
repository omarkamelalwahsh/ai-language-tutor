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

-- Grant access to roles
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT ON public.teams TO anon;

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

    -- last_seen_at tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Index for fast team member lookups
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);

-- =============================================================================
-- 3. TEAM INVITES SYSTEM
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_invites (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token       TEXT NOT NULL UNIQUE,
    team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    role        INT NOT NULL DEFAULT 1,
    created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    used_at     TIMESTAMPTZ,
    used_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    note        TEXT
);

-- Enable RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- SuperAdmin (role=2): full access
DROP POLICY IF EXISTS "SuperAdmin full access on team_invites" ON public.team_invites;
CREATE POLICY "SuperAdmin full access on team_invites"
ON public.team_invites FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2)
);

-- Grant access to roles
GRANT ALL ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;
GRANT SELECT ON public.team_invites TO anon;

-- Public Peek RPC (Security Definer to bypass RLS for token lookup)
CREATE OR REPLACE FUNCTION public.peek_team_invite(p_token TEXT)
RETURNS TABLE (
    team_name TEXT,
    is_used BOOLEAN,
    is_expired BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.team_name,
        (i.used_at IS NOT NULL) as is_used,
        (i.expires_at IS NOT NULL AND i.expires_at < NOW()) as is_expired
    FROM public.team_invites i
    JOIN public.teams t ON t.id = i.team_id
    WHERE i.token = p_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.peek_team_invite(TEXT) TO anon, authenticated;

-- Consume Invite RPC
CREATE OR REPLACE FUNCTION public.consume_team_invite(p_token TEXT)
RETURNS TABLE (
    team_id UUID,
    team_name TEXT,
    role INT
) AS $$
DECLARE
    v_invite_id UUID;
    v_team_id UUID;
    v_role INT;
BEGIN
    -- 1. Validate invite
    SELECT i.id, i.team_id, i.role INTO v_invite_id, v_team_id, v_role
    FROM public.team_invites i
    WHERE i.token = p_token
      AND i.used_at IS NULL
      AND (i.expires_at IS NULL OR i.expires_at > NOW());

    IF v_invite_id IS NULL THEN
        RAISE EXCEPTION 'INVITE_INVALID_OR_USED';
    END IF;

    -- 2. Update user profile
    UPDATE public.profiles
    SET 
        role = v_role,
        team_id = v_team_id,
        updated_at = NOW()
    WHERE id = auth.uid();

    -- 3. Mark invite as used
    UPDATE public.team_invites
    SET 
        used_at = NOW(),
        used_by = auth.uid()
    WHERE id = v_invite_id;

    -- 4. Return info
    RETURN QUERY
    SELECT t.id, t.team_name, v_role
    FROM public.teams t
    WHERE t.id = v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.consume_team_invite(TEXT) TO authenticated;

-- =============================================================================
-- 4. ROOT ADMIN IMMORTALITY — TRIGGERS
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
            RAISE EXCEPTION 'IMMORTAL_GUARD: Cannot modify root admin role.'
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
