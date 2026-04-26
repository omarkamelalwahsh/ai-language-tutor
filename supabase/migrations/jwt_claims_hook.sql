-- =============================================================================
-- Migration: Custom JWT Claims Hook for team_id
-- Description: Prepares the function required to inject team_id directly into 
--              the JWT claims for faster RLS policies as requested.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
  DECLARE
    claims jsonb;
    user_team_id uuid;
    user_role int;
  BEGIN
    -- Fetch the user's team_id and role from public.profiles
    SELECT team_id, role INTO user_team_id, user_role 
    FROM public.profiles 
    WHERE id = (event->>'user_id')::uuid;

    claims := event->'claims';

    IF user_team_id IS NOT NULL THEN
      -- Inject the team_id into the app_metadata inside the JWT
      claims := jsonb_set(claims, '{app_metadata, team_id}', to_jsonb(user_team_id));
    END IF;
    
    IF user_role IS NOT NULL THEN
      -- Inject role into app_metadata as well
      claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
    END IF;

    -- Return the modified event
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
