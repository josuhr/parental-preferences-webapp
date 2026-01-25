-- Fix RLS for Teacher Invitation Acceptance
-- Allows teacher account creation during invitation acceptance

-- The issue: Teachers accepting invitations aren't authenticated yet,
-- but need to create their user profile. The current policy requires
-- authentication (id = auth.uid()), which fails during signup.

-- Solution: Add a policy that allows insertion if:
-- 1. The user is the one being created (id matches), AND
-- 2. They have auth_method = 'teacher_invite'

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can create their own profile during signup" ON public.users;

-- Create a more permissive policy for authenticated users
CREATE POLICY "Authenticated users can create their own profile"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- CRITICAL: Add policy for teacher invitation acceptance
-- This allows the initial user record creation during Supabase Auth signup
-- Supabase creates the auth user first, then immediately tries to insert the profile
-- At this point, the user IS authenticated (in auth.users) but not yet in public.users

CREATE POLICY "Allow user profile creation during signup"
    ON public.users FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        -- Must be creating their own profile
        id = auth.uid() OR
        -- Or, for teacher invites, allow if this is a new signup
        (auth_method = 'teacher_invite' AND id IS NOT NULL)
    );

-- Alternative simpler approach - allow any authenticated user to insert their own record
-- This is safe because they can only insert with their own auth.uid()
DROP POLICY IF EXISTS "Allow user profile creation during signup" ON public.users;

CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

-- IMPORTANT: This policy works for both authenticated and anon because:
-- - During Supabase signup, the user becomes authenticated immediately
-- - The auth.uid() function returns their ID
-- - They can only insert a record with their own ID
-- - This is secure and allows the signup flow to complete
