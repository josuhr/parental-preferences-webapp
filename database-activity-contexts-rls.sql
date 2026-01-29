-- RLS Policies for Activity Contexts Management
-- Run this in Supabase SQL editor to enable context management

-- Enable RLS on activity_contexts if not already enabled
ALTER TABLE public.activity_contexts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to view activity contexts" ON public.activity_contexts;
DROP POLICY IF EXISTS "Allow authenticated users to insert activity contexts" ON public.activity_contexts;
DROP POLICY IF EXISTS "Allow authenticated users to update activity contexts" ON public.activity_contexts;
DROP POLICY IF EXISTS "Allow authenticated users to delete activity contexts" ON public.activity_contexts;

-- Allow all authenticated users to view activity contexts
CREATE POLICY "Allow authenticated users to view activity contexts"
    ON public.activity_contexts
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all authenticated users to insert activity contexts
-- (In production, you might want to restrict this to admins)
CREATE POLICY "Allow authenticated users to insert activity contexts"
    ON public.activity_contexts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow all authenticated users to update activity contexts
CREATE POLICY "Allow authenticated users to update activity contexts"
    ON public.activity_contexts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow all authenticated users to delete activity contexts
CREATE POLICY "Allow authenticated users to delete activity contexts"
    ON public.activity_contexts
    FOR DELETE
    TO authenticated
    USING (true);

-- Also ensure recommendation_contexts has proper policies
ALTER TABLE public.recommendation_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to view recommendation contexts" ON public.recommendation_contexts;
DROP POLICY IF EXISTS "Allow authenticated users to insert recommendation contexts" ON public.recommendation_contexts;

-- Allow all authenticated users to view recommendation contexts
CREATE POLICY "Allow authenticated users to view recommendation contexts"
    ON public.recommendation_contexts
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all authenticated users to insert recommendation contexts
CREATE POLICY "Allow authenticated users to insert recommendation contexts"
    ON public.recommendation_contexts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_contexts TO authenticated;
GRANT SELECT, INSERT ON public.recommendation_contexts TO authenticated;
