-- ============================================================================
-- Fix Authentication: Restore proper RLS policies for users table
-- ============================================================================
-- Run this immediately to fix authentication issues
-- ============================================================================

-- First, let's see all current policies on users table
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users';

-- Drop the problematic SELECT policy we just created
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Recreate a proper SELECT policy that allows:
-- 1. Users to see their own profile (needed for auth)
-- 2. Admins to see all users
-- Make sure we don't conflict with any existing policies

-- Check if there's already a policy for users viewing their own profile
-- If not, create one
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Create separate admin view policy
CREATE POLICY "Admins can view all users"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ============================================================================
-- Verify the fix
-- ============================================================================
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;
