-- ============================================================================
-- Fix: Allow Teachers to Read Kid Data (Categories, Activities, Preferences)
-- ============================================================================
-- Teachers with approved access via kid_access_permissions need to be able to
-- view the kid's activity categories, activities, and preferences.
-- 
-- The original RLS policies only allowed parents to view this data.
-- ============================================================================

-- ============================================================================
-- Step 1: Update kids table policy (if not already done)
-- ============================================================================

-- Drop existing policy if it exists and recreate with teacher access
DROP POLICY IF EXISTS "Parents can view own kids" ON public.kids;
DROP POLICY IF EXISTS "Teachers can view accessible kids" ON public.kids;

CREATE POLICY "Users can view accessible kids"
    ON public.kids FOR SELECT
    TO authenticated
    USING (
        -- Parents can view their own kids
        parent_id = auth.uid()
        OR
        -- Teachers can view kids they have approved access to
        id IN (
            SELECT kid_id 
            FROM public.kid_access_permissions 
            WHERE teacher_id = auth.uid() 
            AND status = 'approved'
        )
    );

-- ============================================================================
-- Step 2: Update kid_activity_categories policy
-- ============================================================================
-- Categories are owned by parents, but teachers need to view them to see
-- what activities exist for kids they have access to.

DROP POLICY IF EXISTS "Parents can view own kid categories" ON public.kid_activity_categories;
DROP POLICY IF EXISTS "Teachers can view categories for accessible kids" ON public.kid_activity_categories;

CREATE POLICY "Users can view kid categories"
    ON public.kid_activity_categories FOR SELECT
    TO authenticated
    USING (
        -- Parents can view their own categories
        parent_id = auth.uid()
        -- Universal categories (parent_id IS NULL) are viewable by all
        OR parent_id IS NULL
        OR
        -- Teachers can view categories for kids they have access to
        parent_id IN (
            SELECT k.parent_id 
            FROM public.kids k
            JOIN public.kid_access_permissions kap ON k.id = kap.kid_id
            WHERE kap.teacher_id = auth.uid() 
            AND kap.status = 'approved'
        )
    );

-- ============================================================================
-- Step 3: Update kid_activities policy
-- ============================================================================
-- Activities belong to categories. Teachers need to view activities in 
-- categories belonging to parents whose kids they have access to.

DROP POLICY IF EXISTS "Parents can view own kid activities" ON public.kid_activities;
DROP POLICY IF EXISTS "Teachers can view activities for accessible kids" ON public.kid_activities;

CREATE POLICY "Users can view kid activities"
    ON public.kid_activities FOR SELECT
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.kid_activity_categories 
            WHERE 
                -- Parent's own categories
                parent_id = auth.uid()
                -- Universal categories
                OR parent_id IS NULL
                -- Categories for kids teacher has access to
                OR parent_id IN (
                    SELECT k.parent_id 
                    FROM public.kids k
                    JOIN public.kid_access_permissions kap ON k.id = kap.kid_id
                    WHERE kap.teacher_id = auth.uid() 
                    AND kap.status = 'approved'
                )
        )
    );

-- ============================================================================
-- Step 4: Update kid_preferences policy
-- ============================================================================
-- Preferences are linked to kids. Teachers need to view preferences for
-- kids they have approved access to.

DROP POLICY IF EXISTS "Parents can view preferences for own kids" ON public.kid_preferences;
DROP POLICY IF EXISTS "Teachers can view preferences for accessible kids" ON public.kid_preferences;

CREATE POLICY "Users can view kid preferences"
    ON public.kid_preferences FOR SELECT
    TO authenticated
    USING (
        kid_id IN (
            SELECT id FROM public.kids 
            WHERE 
                -- Parent's own kids
                parent_id = auth.uid()
                OR
                -- Kids teacher has approved access to
                id IN (
                    SELECT kid_id 
                    FROM public.kid_access_permissions 
                    WHERE teacher_id = auth.uid() 
                    AND status = 'approved'
                )
        )
    );

-- ============================================================================
-- Verification: Check the new policies
-- ============================================================================
-- Run this to verify the policies were created correctly:

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('kids', 'kid_activity_categories', 'kid_activities', 'kid_preferences')
AND cmd = 'SELECT'
ORDER BY tablename, policyname;
