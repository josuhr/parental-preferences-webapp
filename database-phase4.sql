-- Phase 4: Kid Preferences Tracking
-- This schema adds kid profiles and their activity preferences

-- ============================================================================
-- Kids Table
-- ============================================================================
-- Stores kid profiles created by parents

CREATE TABLE IF NOT EXISTS public.kids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    nickname TEXT,
    birth_date DATE,
    notes TEXT,
    avatar_emoji TEXT DEFAULT '👶',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Kid Activity Categories Table
-- ============================================================================
-- Activity categories specific to kids (can be different from parent categories)

CREATE TABLE IF NOT EXISTS public.kid_activity_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Kid Activities Table
-- ============================================================================
-- Activities that kids can have preferences for

CREATE TABLE IF NOT EXISTS public.kid_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.kid_activity_categories(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Kid Preferences Table
-- ============================================================================
-- Tracks which kids like which activities and how much

CREATE TABLE IF NOT EXISTS public.kid_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.kid_activities(id) ON DELETE CASCADE NOT NULL,
    preference_level TEXT CHECK (preference_level IN ('loves', 'likes', 'neutral', 'dislikes', 'refuses')) DEFAULT 'likes',
    notes TEXT,
    last_done DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kid_id, activity_id)
);

-- ============================================================================
-- Kid Insights Table (Optional - for tracking patterns)
-- ============================================================================
-- Stores insights about kid preferences (e.g., "Loves outdoor activities")

CREATE TABLE IF NOT EXISTS public.kid_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    insight_type TEXT NOT NULL, -- 'pattern', 'growth', 'recommendation', etc.
    title TEXT NOT NULL,
    description TEXT,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1), -- 0.0 to 1.0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.kids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_insights ENABLE ROW LEVEL SECURITY;

-- Kids Policies
-- Parents can only see and manage their own kids
CREATE POLICY "Parents can view own kids"
    ON public.kids FOR SELECT
    TO authenticated
    USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own kids"
    ON public.kids FOR INSERT
    TO authenticated
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own kids"
    ON public.kids FOR UPDATE
    TO authenticated
    USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete own kids"
    ON public.kids FOR DELETE
    TO authenticated
    USING (parent_id = auth.uid());

-- Kid Activity Categories Policies
CREATE POLICY "Parents can view own kid categories"
    ON public.kid_activity_categories FOR SELECT
    TO authenticated
    USING (parent_id = auth.uid());

CREATE POLICY "Parents can insert own kid categories"
    ON public.kid_activity_categories FOR INSERT
    TO authenticated
    WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can update own kid categories"
    ON public.kid_activity_categories FOR UPDATE
    TO authenticated
    USING (parent_id = auth.uid());

CREATE POLICY "Parents can delete own kid categories"
    ON public.kid_activity_categories FOR DELETE
    TO authenticated
    USING (parent_id = auth.uid());

-- Kid Activities Policies
CREATE POLICY "Parents can view own kid activities"
    ON public.kid_activities FOR SELECT
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.kid_activity_categories WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can insert own kid activities"
    ON public.kid_activities FOR INSERT
    TO authenticated
    WITH CHECK (
        category_id IN (
            SELECT id FROM public.kid_activity_categories WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can update own kid activities"
    ON public.kid_activities FOR UPDATE
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.kid_activity_categories WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can delete own kid activities"
    ON public.kid_activities FOR DELETE
    TO authenticated
    USING (
        category_id IN (
            SELECT id FROM public.kid_activity_categories WHERE parent_id = auth.uid()
        )
    );

-- Kid Preferences Policies
-- Parents can manage preferences for their own kids
CREATE POLICY "Parents can view preferences for own kids"
    ON public.kid_preferences FOR SELECT
    TO authenticated
    USING (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can insert preferences for own kids"
    ON public.kid_preferences FOR INSERT
    TO authenticated
    WITH CHECK (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can update preferences for own kids"
    ON public.kid_preferences FOR UPDATE
    TO authenticated
    USING (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can delete preferences for own kids"
    ON public.kid_preferences FOR DELETE
    TO authenticated
    USING (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

-- Kid Insights Policies
CREATE POLICY "Parents can view insights for own kids"
    ON public.kid_insights FOR SELECT
    TO authenticated
    USING (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

CREATE POLICY "System can insert insights"
    ON public.kid_insights FOR INSERT
    TO authenticated
    WITH CHECK (
        kid_id IN (
            SELECT id FROM public.kids WHERE parent_id = auth.uid()
        )
    );

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kids_parent_id 
    ON public.kids(parent_id);

CREATE INDEX IF NOT EXISTS idx_kids_is_active 
    ON public.kids(parent_id, is_active);

CREATE INDEX IF NOT EXISTS idx_kid_activity_categories_parent_id 
    ON public.kid_activity_categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_kid_activities_category_id 
    ON public.kid_activities(category_id);

CREATE INDEX IF NOT EXISTS idx_kid_preferences_kid_id 
    ON public.kid_preferences(kid_id);

CREATE INDEX IF NOT EXISTS idx_kid_preferences_activity_id 
    ON public.kid_preferences(activity_id);

CREATE INDEX IF NOT EXISTS idx_kid_preferences_unique 
    ON public.kid_preferences(kid_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_kid_insights_kid_id 
    ON public.kid_insights(kid_id);

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

-- Apply trigger to kids
CREATE TRIGGER update_kids_updated_at
    BEFORE UPDATE ON public.kids
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to kid_activity_categories
CREATE TRIGGER update_kid_activity_categories_updated_at
    BEFORE UPDATE ON public.kid_activity_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to kid_activities
CREATE TRIGGER update_kid_activities_updated_at
    BEFORE UPDATE ON public.kid_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to kid_preferences
CREATE TRIGGER update_kid_preferences_updated_at
    BEFORE UPDATE ON public.kid_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT ALL ON public.kids TO authenticated;
GRANT ALL ON public.kid_activity_categories TO authenticated;
GRANT ALL ON public.kid_activities TO authenticated;
GRANT ALL ON public.kid_preferences TO authenticated;
GRANT ALL ON public.kid_insights TO authenticated;

-- ============================================================================
-- Helper Views (Optional - for easier querying)
-- ============================================================================

-- View to see kids with their preference counts
CREATE OR REPLACE VIEW public.kids_with_stats AS
SELECT 
    k.id,
    k.parent_id,
    k.name,
    k.nickname,
    k.birth_date,
    k.avatar_emoji,
    k.is_active,
    k.created_at,
    EXTRACT(YEAR FROM AGE(k.birth_date)) AS age_years,
    COUNT(DISTINCT kp.id) AS total_preferences,
    COUNT(DISTINCT CASE WHEN kp.preference_level = 'loves' THEN kp.id END) AS loves_count,
    COUNT(DISTINCT CASE WHEN kp.preference_level = 'likes' THEN kp.id END) AS likes_count
FROM public.kids k
LEFT JOIN public.kid_preferences kp ON k.id = kp.kid_id
GROUP BY k.id, k.parent_id, k.name, k.nickname, k.birth_date, k.avatar_emoji, k.is_active, k.created_at;

-- Grant access to view
GRANT SELECT ON public.kids_with_stats TO authenticated;

-- RLS for view (inherits from kids table)
ALTER VIEW public.kids_with_stats SET (security_barrier = true);
