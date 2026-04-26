-- =============================================================================
-- Migration: Fix Team Invites RLS
-- Description: Adds RLS policies to allow Team Admins (role=1) to INSERT
--              and SELECT invites for their own team.
-- =============================================================================

-- Policy: Team Admins can read invites for their team
DROP POLICY IF EXISTS "TeamAdmin read access on team_invites" ON public.team_invites;
CREATE POLICY "TeamAdmin read access on team_invites"
ON public.team_invites FOR SELECT
TO authenticated
USING (
  team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid() AND role = 1)
);

-- Policy: Team Admins can insert invites for their team (MUST be role 0)
DROP POLICY IF EXISTS "TeamAdmin insert access on team_invites" ON public.team_invites;
CREATE POLICY "TeamAdmin insert access on team_invites"
ON public.team_invites FOR INSERT
TO authenticated
WITH CHECK (
  -- Ensure the user is a Team Admin for this specific team
  team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid() AND role = 1)
  -- Ensure they can only generate standard member (role=0) invites
  AND role = 0
  -- Ensure they are recording themselves as the creator
  AND created_by = auth.uid()
);
