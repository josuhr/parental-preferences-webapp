-- ============================================================================
-- Admin RLS Fix: Allow admins to manage users
-- ============================================================================
-- This script updates RLS policies on the users table to allow admins to
-- update other users' profiles (role, user_types, is_active, etc.)
-- ============================================================================

-- First, let's see what policies exist on the users table
-- Run this query to check:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'users';

-- Drop existing update policies on users table
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Create policy: Admins can update any user
-- Admins are identified by role = 'admin' in the users table
CREATE POLICY "Admins can update all users"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Also ensure admins can view all users (they probably already can, but let's be sure)
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

CREATE POLICY "Admins can view all users"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ============================================================================
-- Verification query - run this to confirm policies are set correctly
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY policyname;
