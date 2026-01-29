-- ============================================================================
-- Fix: Allow Teachers to Read Kid Data (Preferences)
-- ============================================================================
-- Teachers with approved access via kid_access_permissions need to be able to
-- view the kid's preferences.
-- 
-- NOTE: Categories and Activities already have universal access policies from
-- database-phase4-universal-activities.sql that allow ALL authenticated users
-- to view universal categories (parent_id IS NULL) and their activities.
-- 
-- This fix focuses on kid_preferences which still needs teacher access.
-- ============================================================================

-- ============================================================================
-- Step 1: Drop ALL existing SELECT policies on kid_preferences
-- ============================================================================
-- We need a clean slate to avoid conflicts between multiple policies

DROP POLICY IF EXISTS "Parents can view preferences for own kids" ON public.kid_preferences;
DROP POLICY IF EXISTS "Teachers can view preferences for accessible kids" ON public.kid_preferences;
DROP POLICY IF EXISTS "Users can view kid preferences" ON public.kid_preferences;

-- ============================================================================
-- Step 2: Create a single unified policy for kid_preferences
-- ============================================================================
-- This policy allows BOTH parents AND teachers to view preferences

CREATE POLICY "Users can view kid preferences"
    ON public.kid_preferences FOR SELECT
    TO authenticated
    USING (
        -- Parents can view preferences for their own kids
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
        OR
        -- Teachers can view preferences for kids they have approved access to
        kid_id IN (
            SELECT kid_id FROM public.kid_access_permissions
            WHERE teacher_id = auth.uid() AND status = 'approved'
        )
    );

-- ============================================================================
-- Step 3: Ensure kids table allows teacher access
-- ============================================================================
-- Teachers need to be able to read kid info (name, avatar, etc.)

DROP POLICY IF EXISTS "Parents can view own kids" ON public.kids;
DROP POLICY IF EXISTS "Teachers can view accessible kids" ON public.kids;
DROP POLICY IF EXISTS "Users can view accessible kids" ON public.kids;

CREATE POLICY "Users can view accessible kids"
    ON public.kids FOR SELECT
    TO authenticated
    USING (
        -- Parents can view their own kids
        parent_id = auth.uid()
        OR
        -- Teachers can view kids they have approved access to
        id IN (
            SELECT kid_id FROM public.kid_access_permissions
            WHERE teacher_id = auth.uid() AND status = 'approved'
        )
    );

-- ============================================================================
-- Verification: Check the new policies
-- ============================================================================

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('kids', 'kid_activity_categories', 'kid_activities', 'kid_preferences')
AND cmd = 'SELECT'
ORDER BY tablename, policyname;
