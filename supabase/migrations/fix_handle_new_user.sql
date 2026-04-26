-- =============================================================================
-- Migration: Fix handle_new_user SECURITY DEFINER
-- Description: Makes the handle_new_user trigger function SECURITY DEFINER 
--              so it can bypass RLS when inserting into profiles.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
