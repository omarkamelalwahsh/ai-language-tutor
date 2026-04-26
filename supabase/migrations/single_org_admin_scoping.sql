-- =============================================================================
-- Migration: Single-Org Admin Scoping, Team Invites & Audit Log
-- Description:
--   1. Adds last_seen_at to profiles (powers Tier 1 "last active" brief)
--   2. team_invites table + consume_team_invite() RPC for Root Admin invite links
--   3. audit_logs table + role/team change trigger + deep-dive write hook
--   4. Team-scoped RLS for Team Admins on profiles, teams, user_error_analysis
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. PROFILES: last_seen_at column
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='last_seen_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles(last_seen_at DESC);


-- =============================================================================
-- 2. TEAM_INVITES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT UNIQUE NOT NULL,
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role        SMALLINT NOT NULL DEFAULT 1 CHECK (role = 1),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  used_at     TIMESTAMPTZ,
  used_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note        TEXT
);

CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON public.team_invites(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_unused ON public.team_invites(used_at) WHERE used_at IS NULL;

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin full access on team_invites" ON public.team_invites;
CREATE POLICY "SuperAdmin full access on team_invites"
ON public.team_invites FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2));


-- =============================================================================
-- 3. AUDIT_LOGS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email  TEXT,
  actor_role   SMALLINT,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    UUID,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id     ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id    ON public.audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin can read audit_logs" ON public.audit_logs;
CREATE POLICY "SuperAdmin can read audit_logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2));

-- Authenticated users may only insert rows where they are the actor.
DROP POLICY IF EXISTS "Authenticated can insert own audit" ON public.audit_logs;
CREATE POLICY "Authenticated can insert own audit"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());


-- =============================================================================
-- 4. PROFILES RLS: self / Team Admin (own team) / SuperAdmin (all)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "SuperAdmin can read all profiles" ON public.profiles;
CREATE POLICY "SuperAdmin can read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 2));

-- Team Admin can read profiles where the row's team_id matches the caller's team_id.
DROP POLICY IF EXISTS "Team Admin reads own team profiles" ON public.profiles;
CREATE POLICY "Team Admin reads own team profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  team_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role = 1
      AND me.team_id IS NOT NULL
      AND me.team_id = public.profiles.team_id
  )
);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "SuperAdmin can update any profile" ON public.profiles;
CREATE POLICY "SuperAdmin can update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 2))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 2));

DROP POLICY IF EXISTS "SuperAdmin can delete any profile" ON public.profiles;
CREATE POLICY "SuperAdmin can delete any profile"
ON public.profiles FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 2));


-- =============================================================================
-- 5. TEAMS RLS: replace blanket Admin SELECT with team-scoped read
-- =============================================================================
DROP POLICY IF EXISTS "Admin read access on teams" ON public.teams;

DROP POLICY IF EXISTS "Team Admin reads own team" ON public.teams;
CREATE POLICY "Team Admin reads own team"
ON public.teams FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role = 1
      AND me.team_id = public.teams.id
  )
);


-- =============================================================================
-- 6. USER_ERROR_ANALYSIS RLS — powers Tier 2 deep-dive (team-scoped)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='user_error_analysis'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_error_analysis ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Self read on user_error_analysis" ON public.user_error_analysis';
    EXECUTE 'CREATE POLICY "Self read on user_error_analysis"
             ON public.user_error_analysis FOR SELECT TO authenticated
             USING (user_id = auth.uid())';

    EXECUTE 'DROP POLICY IF EXISTS "SuperAdmin read on user_error_analysis" ON public.user_error_analysis';
    EXECUTE 'CREATE POLICY "SuperAdmin read on user_error_analysis"
             ON public.user_error_analysis FOR SELECT TO authenticated
             USING (EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 2))';

    EXECUTE 'DROP POLICY IF EXISTS "Team Admin read on user_error_analysis" ON public.user_error_analysis';
    EXECUTE 'CREATE POLICY "Team Admin read on user_error_analysis"
             ON public.user_error_analysis FOR SELECT TO authenticated
             USING (EXISTS (
               SELECT 1
               FROM public.profiles me
               JOIN public.profiles target ON target.id = public.user_error_analysis.user_id
               WHERE me.id = auth.uid()
                 AND me.role = 1
                 AND me.team_id IS NOT NULL
                 AND target.team_id = me.team_id
             ))';
  END IF;
END $$;


-- =============================================================================
-- 7. INVITE CONSUMPTION — SECURITY DEFINER RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.consume_team_invite(p_token TEXT)
RETURNS TABLE (team_id UUID, team_name TEXT, role SMALLINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite    public.team_invites%ROWTYPE;
  v_user_id   UUID := auth.uid();
  v_team_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'INVITE_UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_invite FROM public.team_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;

  IF v_invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE_ALREADY_USED';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;

  -- Apply Team Admin role + team assignment to the caller.
  UPDATE public.profiles
  SET role       = v_invite.role,
      team_id    = v_invite.team_id,
      updated_at = NOW()
  WHERE id = v_user_id;

  UPDATE public.team_invites
  SET used_at = NOW(), used_by = v_user_id
  WHERE id = v_invite.id;

  SELECT t.team_name INTO v_team_name FROM public.teams t WHERE t.id = v_invite.team_id;

  INSERT INTO public.audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, metadata)
  SELECT p.id, p.email, p.role, 'invite_consumed', 'team', v_invite.team_id,
         jsonb_build_object('invite_id', v_invite.id, 'team_name', v_team_name)
  FROM public.profiles p WHERE p.id = v_user_id;

  RETURN QUERY SELECT v_invite.team_id, v_team_name, v_invite.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_team_invite(TEXT) TO authenticated;


-- Read-only invite preview so the signup page can show "you've been invited to X".
CREATE OR REPLACE FUNCTION public.peek_team_invite(p_token TEXT)
RETURNS TABLE (team_name TEXT, is_used BOOLEAN, is_expired BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.team_name,
         (i.used_at IS NOT NULL) AS is_used,
         (i.expires_at IS NOT NULL AND i.expires_at < NOW()) AS is_expired
  FROM public.team_invites i
  JOIN public.teams t ON t.id = i.team_id
  WHERE i.token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.peek_team_invite(TEXT) TO anon, authenticated;


-- =============================================================================
-- 8. ROLE / TEAM CHANGE AUDIT TRIGGER on profiles
-- =============================================================================
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := COALESCE(auth.uid(), NEW.id);
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, metadata)
    SELECT p.id, p.email, p.role, 'role_change', 'profile', NEW.id,
           jsonb_build_object('from', OLD.role, 'to', NEW.role, 'target_email', NEW.email)
    FROM public.profiles p WHERE p.id = v_actor_id;
  END IF;

  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    INSERT INTO public.audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, metadata)
    SELECT p.id, p.email, p.role, 'team_change', 'profile', NEW.id,
           jsonb_build_object('from', OLD.team_id, 'to', NEW.team_id, 'target_email', NEW.email)
    FROM public.profiles p WHERE p.id = v_actor_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.profiles;
CREATE TRIGGER trg_audit_role_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_role_change();
