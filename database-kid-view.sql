-- Database migration for Kid View feature
-- Adds illustration support and kid activity selections

-- Add illustration_url column to kid_activities if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'kid_activities'
        AND column_name = 'illustration_url'
    ) THEN
        ALTER TABLE public.kid_activities
        ADD COLUMN illustration_url TEXT;

        COMMENT ON COLUMN public.kid_activities.illustration_url IS
            'URL to AI-generated kid-friendly illustration for this activity';
    END IF;
END $$;

-- Create table for kid's "I want to do this" selections
CREATE TABLE IF NOT EXISTS public.kid_activity_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_id UUID NOT NULL REFERENCES public.kids(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.kid_activities(id) ON DELETE CASCADE,
    selected_at TIMESTAMPTZ DEFAULT NOW(),
    -- Optional: track when the selection expires (e.g., daily reset)
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each kid can only select an activity once
    UNIQUE(kid_id, activity_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kid_activity_selections_kid
    ON public.kid_activity_selections(kid_id);
CREATE INDEX IF NOT EXISTS idx_kid_activity_selections_activity
    ON public.kid_activity_selections(activity_id);

-- Enable RLS
ALTER TABLE public.kid_activity_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Parents can manage their kids' selections
CREATE POLICY "Parents can view their kids selections"
    ON public.kid_activity_selections FOR SELECT
    USING (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can insert their kids selections"
    ON public.kid_activity_selections FOR INSERT
    WITH CHECK (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can delete their kids selections"
    ON public.kid_activity_selections FOR DELETE
    USING (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON public.kid_activity_selections TO authenticated;
