-- =============================================================================
-- Migration: Fix RLS Update Policy & Secure Role Column
-- Description: The previous WITH CHECK condition on profiles_update_self 
--              prevented Team Admins (role=1) from updating their own 
--              last_seen_at, causing a 42501 error.
--              This migration fixes the RLS policy and adds a trigger 
--              to prevent unauthorized role escalation.
-- =============================================================================

-- 1. Fix the update policy so users can update their own rows regardless of role
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_update_self"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 2. Add a trigger to prevent users from elevating their own roles
-- Only SuperAdmins (role=2) or Security Definer functions can change roles.
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_update()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Allow if the current user is a SuperAdmin
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 2) THEN
            RETURN NEW;
        END IF;
        
        -- If we reach here, a non-SuperAdmin tried to change a role.
        -- We will just silently ignore the role change and keep the OLD role.
        -- This prevents errors from breaking the app if a rogue update happens,
        -- while still maintaining security.
        NEW.role = OLD.role;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_role_update ON public.profiles;

CREATE TRIGGER trg_prevent_unauthorized_role_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_unauthorized_role_update();
