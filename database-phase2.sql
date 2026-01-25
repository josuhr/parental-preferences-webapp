-- Phase 2: Built-in Preferences Manager
-- This schema adds native preference management to replace Google Sheets dependency

-- ============================================================================
-- Activity Categories Table
-- ============================================================================
-- Stores user-defined categories for organizing activities (e.g., "Indoor Activities", "Outdoor Activities")

CREATE TABLE IF NOT EXISTS public.activity_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT, -- Emoji or icon identifier
    sort_order INTEGER DEFAULT 0, -- For custom ordering
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Activities Table
-- ============================================================================
-- Stores individual activities within categories

CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.activity_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0, -- For custom ordering within category
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Parent Preferences Table
-- ============================================================================
-- Stores preference levels for each activity (who likes to do it)

CREATE TABLE IF NOT EXISTS public.parent_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    preference_level TEXT CHECK (preference_level IN ('both', 'mom', 'dad', 'neither')),
    notes TEXT, -- Optional notes about this preference
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id, user_id) -- One preference per user per activity
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_preferences ENABLE ROW LEVEL SECURITY;

-- Activity Categories Policies
-- Users can only see and manage their own categories
CREATE POLICY "Users can view own categories"
    ON public.activity_categories FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories"
    ON public.activity_categories FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
    ON public.activity_categories FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
    ON public.activity_categories FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Activities Policies
-- Users can only manage activities in their own categories
CREATE POLICY "Users can view own activities"
    ON public.activities FOR SELECT
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.activity_categories WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own activities"
    ON public.activities FOR INSERT
    TO authenticated
    WITH CHECK (
        category_id IN (
            SELECT id FROM public.activity_categories WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own activities"
    ON public.activities FOR UPDATE
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.activity_categories WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own activities"
    ON public.activities FOR DELETE
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.activity_categories WHERE user_id = auth.uid()
        )
    );

-- Parent Preferences Policies
-- Users can only manage their own preferences
CREATE POLICY "Users can view own preferences"
    ON public.parent_preferences FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
    ON public.parent_preferences FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
    ON public.parent_preferences FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences"
    ON public.parent_preferences FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_activity_categories_user_id 
    ON public.activity_categories(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_categories_sort_order 
    ON public.activity_categories(user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_activities_category_id 
    ON public.activities(category_id);

CREATE INDEX IF NOT EXISTS idx_activities_sort_order 
    ON public.activities(category_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_parent_preferences_user_id 
    ON public.parent_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_parent_preferences_activity_id 
    ON public.parent_preferences(activity_id);

CREATE INDEX IF NOT EXISTS idx_parent_preferences_unique 
    ON public.parent_preferences(activity_id, user_id);

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to activity_categories
CREATE TRIGGER update_activity_categories_updated_at
    BEFORE UPDATE ON public.activity_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to activities
CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON public.activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to parent_preferences
CREATE TRIGGER update_parent_preferences_updated_at
    BEFORE UPDATE ON public.parent_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT ALL ON public.activity_categories TO authenticated;
GRANT ALL ON public.activities TO authenticated;
GRANT ALL ON public.parent_preferences TO authenticated;

-- ============================================================================
-- Sample Data (Optional - for testing)
-- ============================================================================

-- You can uncomment this section to insert sample data for a test user
-- Replace 'YOUR_USER_ID' with an actual user ID from your users table

/*
-- Sample categories
INSERT INTO public.activity_categories (user_id, name, icon, sort_order) VALUES
    ('YOUR_USER_ID', 'Indoor Activities', '🏠', 1),
    ('YOUR_USER_ID', 'Outdoor Activities', '🌳', 2),
    ('YOUR_USER_ID', 'Creative Activities', '🎨', 3)
ON CONFLICT DO NOTHING;

-- Sample activities
INSERT INTO public.activities (category_id, name, sort_order)
SELECT id, 'Reading Books', 1 FROM public.activity_categories WHERE name = 'Indoor Activities'
UNION ALL
SELECT id, 'Board Games', 2 FROM public.activity_categories WHERE name = 'Indoor Activities'
UNION ALL
SELECT id, 'Park Visits', 1 FROM public.activity_categories WHERE name = 'Outdoor Activities'
UNION ALL
SELECT id, 'Drawing', 1 FROM public.activity_categories WHERE name = 'Creative Activities';

-- Sample preferences
INSERT INTO public.parent_preferences (activity_id, user_id, preference_level)
SELECT id, 'YOUR_USER_ID', 'both' FROM public.activities WHERE name = 'Reading Books';
*/
