-- ============================================================================
-- EMERGENCY AUTH FIX
-- ============================================================================
-- Run this to restore authentication functionality
-- ============================================================================

-- Step 1: See ALL current policies on users table
SELECT 'CURRENT POLICIES:' as info;
SELECT policyname, cmd, permissive, roles, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- Step 2: Check if RLS is enabled
SELECT 'RLS STATUS:' as info;
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'users';

-- Step 3: TEMPORARILY DISABLE RLS to restore access (for emergency recovery)
-- Uncomment this line if you need to restore access immediately:
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 4: Drop ALL existing policies on users table and start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to read own data" ON public.users;
DROP POLICY IF EXISTS "Allow users to update own data" ON public.users;

-- Step 5: Create fresh, simple policies

-- SELECT: Every authenticated user can read their own row
CREATE POLICY "Users can view own profile"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- SELECT: Admins can read ALL rows (uses security definer function to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN user_role = 'admin';
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admins can view all users"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- UPDATE: Users can update their own row
CREATE POLICY "Users can update own profile"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- UPDATE: Admins can update any row
CREATE POLICY "Admins can update all users"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- INSERT: Authenticated users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Step 6: Make sure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 7: Verify
SELECT 'NEW POLICIES:' as info;
SELECT policyname, cmd, permissive
FROM pg_policies 
WHERE tablename = 'users'
ORDER BY cmd, policyname;
