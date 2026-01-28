-- Update RLS policy to allow authenticated users to add universal activities
-- This allows users to contribute to the shared activity library

DROP POLICY IF EXISTS "Users can insert activities into own categories" ON public.kid_activities;

CREATE POLICY "Users can insert activities into universal or own categories"
    ON public.kid_activities FOR INSERT
    TO authenticated
    WITH CHECK (
        category_id IN (
            SELECT id FROM public.kid_activity_categories 
            WHERE parent_id IS NULL OR parent_id = auth.uid()
        )
    );
