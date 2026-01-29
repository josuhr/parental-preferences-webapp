-- ============================================================================
-- Admin Dashboard: User Types Migration
-- ============================================================================
-- This migration changes user_type from a single TEXT value to a TEXT[] array
-- to allow users to have multiple types (e.g., both 'parent' and 'teacher')
-- ============================================================================

-- Step 1: Rename the column to user_types and change type to TEXT[]
-- First, drop the existing check constraint
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_user_type_check;

-- Rename the column
ALTER TABLE public.users 
RENAME COLUMN user_type TO user_types;

-- Change the column type from TEXT to TEXT[]
-- Wrap existing values in an array
ALTER TABLE public.users 
ALTER COLUMN user_types TYPE TEXT[] 
USING CASE 
    WHEN user_types IS NULL THEN ARRAY['parent']::TEXT[]
    ELSE ARRAY[user_types]::TEXT[]
END;

-- Set default value for new users
ALTER TABLE public.users
ALTER COLUMN user_types SET DEFAULT ARRAY['parent']::TEXT[];

-- Add new constraint to validate array values
-- Each element must be one of: 'parent', 'teacher', 'admin'
ALTER TABLE public.users
ADD CONSTRAINT users_user_types_check 
CHECK (user_types <@ ARRAY['parent', 'teacher', 'admin']::TEXT[]);

-- ============================================================================
-- Step 2: Create helper function to check if user has a specific type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_type(p_user_id UUID, p_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = p_user_id 
        AND p_type = ANY(user_types)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.user_has_type(UUID, TEXT) TO authenticated;

-- ============================================================================
-- Step 3: Update any existing queries/views that reference user_type
-- ============================================================================

-- Update the teacher access policies to use the new column name
-- (These are idempotent - safe to run multiple times)

-- Teachers with 'teacher' in their user_types array can access teacher dashboard
DROP POLICY IF EXISTS "Teachers can access teacher dashboard" ON public.user_app_access;

-- ============================================================================
-- Step 4: Verification query
-- ============================================================================
-- Run this to verify the migration:

SELECT 
    id,
    email,
    display_name,
    role,
    user_types,
    'parent' = ANY(user_types) as is_parent,
    'teacher' = ANY(user_types) as is_teacher,
    'admin' = ANY(user_types) as is_admin_type
FROM public.users
ORDER BY created_at DESC
LIMIT 10;
