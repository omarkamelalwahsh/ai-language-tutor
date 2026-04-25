"""admin_rbac_schema

Initializes the Administration / RBAC schema:
  * profiles  (extends auth.users)
  * teams
  * tasks
  * handle_new_user() trigger on auth.users
  * current_user_role() / current_user_team() SECURITY DEFINER helpers
  * Row Level Security policies (Student / Admin / SuperAdmin)
  * pgvector extension for RAG embeddings
  * Realtime publication for profiles + tasks

Revision ID: 38dcafcb01e1
Revises: 64bc769aad78
Create Date: 2026-04-25

"""
from typing import Sequence, Union

from alembic import op


revision: str = "38dcafcb01e1"
down_revision: Union[str, Sequence[str], None] = "64bc769aad78"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        r"""
-- ============================================================================
-- 0.  Extensions  (RAG / UUID support)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1.  task_status enum
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed');
    END IF;
END
$$;

-- ============================================================================
-- 2.  profiles  (extends auth.users; one row per Supabase user)
--     role: 0 = Student, 1 = Admin, 2 = SuperAdmin
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    email       TEXT,
    role        SMALLINT NOT NULL DEFAULT 0 CHECK (role IN (0, 1, 2)),
    team_id     UUID,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role    ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);

-- ============================================================================
-- 3.  teams
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name   TEXT NOT NULL UNIQUE,
    admin_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Back-link profiles.team_id -> teams.id (added after teams exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_team_id_fkey'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_team_id_fkey
            FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- ============================================================================
-- 4.  tasks
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    description  TEXT,
    assigned_to  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status       public.task_status NOT NULL DEFAULT 'pending',
    deadline     TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by  ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks(status);

-- ============================================================================
-- 5.  Auto-create profile on signup  (Task 2)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        0  -- default Student
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6.  RLS helpers  (SECURITY DEFINER -> bypasses RLS, prevents recursion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS SMALLINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_team()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT team_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_team() TO authenticated, service_role;

-- ============================================================================
-- 7.  Row Level Security  (Task 4)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks    ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (service_role still bypasses; postgres role is exempt by default)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.teams    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tasks    FORCE ROW LEVEL SECURITY;

-- Drop any prior copies (idempotent re-run safety)
DROP POLICY IF EXISTS profiles_select_self          ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self          ON public.profiles;
DROP POLICY IF EXISTS profiles_select_admin_team    ON public.profiles;
DROP POLICY IF EXISTS profiles_all_superadmin       ON public.profiles;
DROP POLICY IF EXISTS teams_select_member           ON public.teams;
DROP POLICY IF EXISTS teams_select_admin            ON public.teams;
DROP POLICY IF EXISTS teams_all_superadmin          ON public.teams;
DROP POLICY IF EXISTS tasks_admin_select_assigned   ON public.tasks;
DROP POLICY IF EXISTS tasks_admin_update_assigned   ON public.tasks;
DROP POLICY IF EXISTS tasks_all_superadmin          ON public.tasks;

-- ---- profiles ----
-- Student: read own row only
CREATE POLICY profiles_select_self ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Student: update own row (role/team_id changes still gated by superadmin policy via UPDATE elsewhere)
CREATE POLICY profiles_update_self ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = 0);

-- Admin: read profiles of students in their team
CREATE POLICY profiles_select_admin_team ON public.profiles
    FOR SELECT TO authenticated
    USING (
        public.current_user_role() = 1
        AND team_id IS NOT NULL
        AND team_id = public.current_user_team()
    );

-- SuperAdmin: full access
CREATE POLICY profiles_all_superadmin ON public.profiles
    FOR ALL TO authenticated
    USING (public.current_user_role() = 2)
    WITH CHECK (public.current_user_role() = 2);

-- ---- teams ----
CREATE POLICY teams_select_member ON public.teams
    FOR SELECT TO authenticated
    USING (id = public.current_user_team());

CREATE POLICY teams_select_admin ON public.teams
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 1 AND admin_id = auth.uid());

CREATE POLICY teams_all_superadmin ON public.teams
    FOR ALL TO authenticated
    USING (public.current_user_role() = 2)
    WITH CHECK (public.current_user_role() = 2);

-- ---- tasks ----
-- Admin: read tasks assigned to them
CREATE POLICY tasks_admin_select_assigned ON public.tasks
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 1 AND assigned_to = auth.uid());

-- Admin: update tasks assigned to them (status transitions)
CREATE POLICY tasks_admin_update_assigned ON public.tasks
    FOR UPDATE TO authenticated
    USING (public.current_user_role() = 1 AND assigned_to = auth.uid())
    WITH CHECK (public.current_user_role() = 1 AND assigned_to = auth.uid());

-- SuperAdmin: full access
CREATE POLICY tasks_all_superadmin ON public.tasks
    FOR ALL TO authenticated
    USING (public.current_user_role() = 2)
    WITH CHECK (public.current_user_role() = 2);

-- ============================================================================
-- 8.  Grants  (Supabase-style: explicit table grants for the API roles)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams    TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks    TO authenticated, service_role;

-- ============================================================================
-- 9.  Realtime publication  (Task 3)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
END
$$;

-- ============================================================================
-- 10. Backfill profiles for users that signed up before the trigger existed
-- ============================================================================
INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id,
       u.email,
       COALESCE(u.raw_user_meta_data->>'full_name', u.email),
       0
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute(
        r"""
-- Drop trigger first (depends on function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Realtime: remove tables (ignore errors if missing)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.tasks;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
    END IF;
END
$$;

DROP TABLE IF EXISTS public.tasks    CASCADE;
DROP TABLE IF EXISTS public.teams    CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.task_status;

DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_user_team();

-- Note: we do NOT drop the pgvector extension on downgrade; it may be
-- depended on by other features.
        """
    )
