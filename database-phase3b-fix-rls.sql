-- Fix for Email/Password Signup - Ensure RLS allows user creation
-- Run this AFTER database-phase3b-auth.sql

-- ============================================================================
-- Fix RLS Policy for User Self-Registration
-- ============================================================================

-- Drop existing insert policy if it exists (might be too restrictive)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

-- Create a permissive policy that allows users to create their own profile
-- This is safe because the user can only insert with their own auth.uid()
CREATE POLICY "Users can create their own profile during signup"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- Also ensure users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================================
-- Fix Existing Email Users Without Profile
-- ============================================================================

-- For users who already signed up but don't have a profile, 
-- we need to create it manually. This query finds them:

-- SELECT auth.users.id, auth.users.email, auth.users.raw_user_meta_data
-- FROM auth.users
-- LEFT JOIN public.users ON auth.users.id = public.users.id
-- WHERE public.users.id IS NULL
--   AND auth.users.email IS NOT NULL;

-- If you have orphaned auth users, you can manually create profiles:
-- Replace with your actual user ID and details from the query above

-- Example (commented out - replace with actual values):
-- INSERT INTO public.users (id, email, display_name, auth_method, email_verified, role, user_type)
-- VALUES (
--     'b31823f8-774c-4d14-81b7-ce42a285fcbf',  -- User ID from error
--     'josh.suhr@mac.com',                      -- Email
--     'Josh',                                   -- Display name
--     'email',                                  -- Auth method
--     true,                                     -- Email verified (if they verified)
--     'user',                                   -- Role
--     'parent'                                  -- User type
-- );
