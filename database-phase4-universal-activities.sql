-- Phase 4 Update: Universal Kid Activities
-- This migration converts kid activities from user-specific to universally shared
-- All users will see the same activity library, while maintaining ability to add custom activities

-- ============================================================================
-- SCHEMA CHANGES
-- ============================================================================

-- Make parent_id nullable to support universal activities
-- NULL = universal activity (visible to all users)
-- Non-NULL = custom activity (visible only to that user, for future feature)
ALTER TABLE public.kid_activity_categories 
    ALTER COLUMN parent_id DROP NOT NULL;

COMMENT ON COLUMN public.kid_activity_categories.parent_id IS 
    'NULL for universal activities visible to all users. Non-NULL for user-specific custom activities.';

-- ============================================================================
-- RLS POLICY UPDATES
-- ============================================================================

-- Drop existing restrictive policies on kid_activity_categories
DROP POLICY IF EXISTS "Parents can view own kid categories" ON public.kid_activity_categories;
DROP POLICY IF EXISTS "Parents can insert own kid categories" ON public.kid_activity_categories;
DROP POLICY IF EXISTS "Parents can update own kid categories" ON public.kid_activity_categories;
DROP POLICY IF EXISTS "Parents can delete own kid categories" ON public.kid_activity_categories;

-- Drop existing restrictive policies on kid_activities
DROP POLICY IF EXISTS "Parents can view own kid activities" ON public.kid_activities;
DROP POLICY IF EXISTS "Parents can insert own kid activities" ON public.kid_activities;
DROP POLICY IF EXISTS "Parents can update own kid activities" ON public.kid_activities;
DROP POLICY IF EXISTS "Parents can delete own kid activities" ON public.kid_activities;

-- ============================================================================
-- NEW RLS POLICIES - Kid Activity Categories
-- ============================================================================

-- All authenticated users can view universal categories OR their own custom categories
CREATE POLICY "Users can view universal and own categories"
    ON public.kid_activity_categories FOR SELECT
    TO authenticated
    USING (parent_id IS NULL OR parent_id = auth.uid());

-- Users can only insert custom categories (not universal ones)
CREATE POLICY "Users can insert own custom categories"
    ON public.kid_activity_categories FOR INSERT
    TO authenticated
    WITH CHECK (parent_id = auth.uid());

-- Users can only update their own custom categories (not universal ones)
CREATE POLICY "Users can update own custom categories"
    ON public.kid_activity_categories FOR UPDATE
    TO authenticated
    USING (parent_id = auth.uid());

-- Users can only delete their own custom categories (not universal ones)
CREATE POLICY "Users can delete own custom categories"
    ON public.kid_activity_categories FOR DELETE
    TO authenticated
    USING (parent_id = auth.uid());

-- ============================================================================
-- NEW RLS POLICIES - Kid Activities
-- ============================================================================

-- All authenticated users can view activities in universal categories OR their own custom categories
CREATE POLICY "Users can view universal and own activities"
    ON public.kid_activities FOR SELECT
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.kid_activity_categories 
            WHERE parent_id IS NULL OR parent_id = auth.uid()
        )
    );

-- Users can only insert activities into their own custom categories
CREATE POLICY "Users can insert activities into own categories"
    ON public.kid_activities FOR INSERT
    TO authenticated
    WITH CHECK (
        category_id IN (
            SELECT id FROM public.kid_activity_categories 
            WHERE parent_id = auth.uid()
        )
    );

-- Users can only update activities in their own custom categories
CREATE POLICY "Users can update activities in own categories"
    ON public.kid_activities FOR UPDATE
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.kid_activity_categories 
            WHERE parent_id = auth.uid()
        )
    );

-- Users can only delete activities in their own custom categories
CREATE POLICY "Users can delete activities in own categories"
    ON public.kid_activities FOR DELETE
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.kid_activity_categories 
            WHERE parent_id = auth.uid()
        )
    );

-- ============================================================================
-- DATA MIGRATION
-- ============================================================================

-- Convert all existing user-specific categories to universal categories
-- This makes all current activities available to all users
UPDATE public.kid_activity_categories
SET parent_id = NULL
WHERE parent_id IS NOT NULL;

-- Log the migration
DO $$
DECLARE
    category_count INTEGER;
    activity_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO category_count FROM public.kid_activity_categories WHERE parent_id IS NULL;
    SELECT COUNT(*) INTO activity_count FROM public.kid_activities;
    
    RAISE NOTICE 'Universal Activities Migration Complete!';
    RAISE NOTICE '  - % universal categories', category_count;
    RAISE NOTICE '  - % universal activities', activity_count;
    RAISE NOTICE 'All users can now see these activities.';
END $$;

-- ============================================================================
-- INDEXES (Optimized for universal + custom queries)
-- ============================================================================

-- Index for filtering universal vs custom categories
CREATE INDEX IF NOT EXISTS idx_kid_activity_categories_parent_id 
    ON public.kid_activity_categories(parent_id);

-- Existing indexes from phase4.sql should still work efficiently
