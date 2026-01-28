-- Phase 4 Update: Household Activities with Multi-Caregiver Preferences
-- Replace single-user parent preferences with household-based multi-caregiver system
-- Parents curate activities and set preferences for Caregiver1, Caregiver2, and Both

-- ============================================================================
-- Household Activities Table
-- ============================================================================
-- Links users to their curated subset of universal kid activities

CREATE TABLE IF NOT EXISTS public.household_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.kid_activities(id) ON DELETE CASCADE NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    UNIQUE(user_id, activity_id)
);

COMMENT ON TABLE public.household_activities IS 
    'User-curated subset of universal kid activities for their household';

COMMENT ON COLUMN public.household_activities.user_id IS 
    'Parent/guardian who manages this household';

COMMENT ON COLUMN public.household_activities.activity_id IS 
    'Reference to universal kid activity';

-- ============================================================================
-- Household Activity Preferences Table
-- ============================================================================
-- Stores preferences for Caregiver1, Caregiver2, and Both

CREATE TABLE IF NOT EXISTS public.household_activity_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_activity_id UUID REFERENCES public.household_activities(id) ON DELETE CASCADE NOT NULL,
    caregiver1_preference TEXT CHECK (caregiver1_preference IN ('drop_anything', 'sometimes', 'on_your_own')),
    caregiver2_preference TEXT CHECK (caregiver2_preference IN ('drop_anything', 'sometimes', 'on_your_own')),
    both_preference TEXT CHECK (both_preference IN ('drop_anything', 'sometimes', 'on_your_own')),
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(household_activity_id)
);

COMMENT ON TABLE public.household_activity_preferences IS 
    'Multi-caregiver preferences for household activities - supports Caregiver1, Caregiver2, and Both';

COMMENT ON COLUMN public.household_activity_preferences.caregiver1_preference IS 
    'Preference for caregiver1 (label from user_settings)';

COMMENT ON COLUMN public.household_activity_preferences.caregiver2_preference IS 
    'Preference for caregiver2 (label from user_settings)';

COMMENT ON COLUMN public.household_activity_preferences.both_preference IS 
    'Preference when both caregivers participate together';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.household_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_activity_preferences ENABLE ROW LEVEL SECURITY;

-- Household Activities Policies
CREATE POLICY "Users can view own household activities"
    ON public.household_activities FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own household activities"
    ON public.household_activities FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own household activities"
    ON public.household_activities FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own household activities"
    ON public.household_activities FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Household Activity Preferences Policies
CREATE POLICY "Users can view preferences for own household activities"
    ON public.household_activity_preferences FOR SELECT
    TO authenticated
    USING (
        household_activity_id IN (
            SELECT id FROM public.household_activities WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert preferences for own household activities"
    ON public.household_activity_preferences FOR INSERT
    TO authenticated
    WITH CHECK (
        household_activity_id IN (
            SELECT id FROM public.household_activities WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update preferences for own household activities"
    ON public.household_activity_preferences FOR UPDATE
    TO authenticated
    USING (
        household_activity_id IN (
            SELECT id FROM public.household_activities WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete preferences for own household activities"
    ON public.household_activity_preferences FOR DELETE
    TO authenticated
    USING (
        household_activity_id IN (
            SELECT id FROM public.household_activities WHERE user_id = auth.uid()
        )
    );

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_household_activities_user 
    ON public.household_activities(user_id);

CREATE INDEX idx_household_activities_activity 
    ON public.household_activities(activity_id);

CREATE INDEX idx_household_activity_prefs_household 
    ON public.household_activity_preferences(household_activity_id);

-- ============================================================================
-- Data Migration
-- ============================================================================
-- Migrate existing parent_kid_activity_preferences to new structure

DO $$
DECLARE
    migrated_count INTEGER := 0;
BEGIN
    -- For each existing parent preference, create household activity and preference
    INSERT INTO public.household_activities (user_id, activity_id, added_at)
    SELECT DISTINCT user_id, activity_id, updated_at
    FROM public.parent_kid_activity_preferences
    ON CONFLICT (user_id, activity_id) DO NOTHING;
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % activities to household_activities', migrated_count;
    
    -- Create preferences with caregiver1_preference set to old preference
    INSERT INTO public.household_activity_preferences (
        household_activity_id, 
        caregiver1_preference,
        updated_at
    )
    SELECT 
        ha.id,
        pkap.preference_level,
        pkap.updated_at
    FROM public.parent_kid_activity_preferences pkap
    JOIN public.household_activities ha 
        ON ha.user_id = pkap.user_id AND ha.activity_id = pkap.activity_id
    ON CONFLICT (household_activity_id) DO NOTHING;
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % preferences to household_activity_preferences', migrated_count;
    
    RAISE NOTICE 'Migration complete! Old data preserved in parent_kid_activity_preferences (marked deprecated)';
END $$;

-- Mark old table as deprecated
COMMENT ON TABLE public.parent_kid_activity_preferences IS 
    'DEPRECATED: Use household_activities and household_activity_preferences instead. Kept for backup.';

-- ============================================================================
-- Update Recommendation Function
-- ============================================================================

-- Drop existing function
DO $$ 
BEGIN
    EXECUTE 'DROP FUNCTION IF EXISTS get_recommendations_for_kid CASCADE';
EXCEPTION
    WHEN undefined_function THEN
        NULL;
END $$;

-- Create updated function using household preferences
CREATE OR REPLACE FUNCTION get_recommendations_for_kid(
    p_kid_id UUID,
    p_context TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    activity_id UUID,
    activity_name TEXT,
    activity_description TEXT,
    category_name TEXT,
    score DECIMAL,
    explanation JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_id UUID;
    v_rule RECORD;
BEGIN
    -- Get the parent ID for this kid
    SELECT parent_id INTO v_parent_id FROM public.kids WHERE id = p_kid_id;
    
    IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Kid not found or has no parent';
    END IF;
    
    -- Get the recommendation rules for this user (or use defaults)
    SELECT * INTO v_rule FROM public.recommendation_rules WHERE user_id = v_parent_id;
    
    IF v_rule IS NULL THEN
        -- Use default weights
        v_rule := ROW(
            NULL, v_parent_id,
            0.40, -- direct_preference_weight
            0.20, -- parent_influence_weight
            0.20, -- kid_similar_weight
            0.10, -- teacher_observation_weight
            0.10, -- context_match_weight
            0.05, -- novelty_boost_weight
            0.15, -- recency_penalty_weight
            NOW(), NOW()
        )::public.recommendation_rules;
    END IF;
    
    RETURN QUERY
    WITH 
    -- Score 1: Direct kid preference match (40% default weight)
    direct_prefs AS (
        SELECT 
            ka.id as activity_id,
            CASE kp.preference_level
                WHEN 'loves' THEN 5.0
                WHEN 'likes' THEN 4.0
                WHEN 'neutral' THEN 3.0
                WHEN 'dislikes' THEN 2.0
                WHEN 'refuses' THEN 1.0
                ELSE 3.0
            END as score
        FROM public.kid_activities ka
        LEFT JOIN public.kid_preferences kp ON kp.activity_id = ka.id AND kp.kid_id = p_kid_id
    ),
    
    -- Score 2: Parent influence (20% default weight) - NOW USES HOUSEHOLD PREFERENCES
    parent_influence AS (
        SELECT 
            ka.id as activity_id,
            CASE 
                -- Average all three preferences if all are set
                WHEN hap.caregiver1_preference IS NOT NULL 
                     AND hap.caregiver2_preference IS NOT NULL 
                     AND hap.both_preference IS NOT NULL THEN
                    (
                        CASE hap.caregiver1_preference
                            WHEN 'drop_anything' THEN 5.0
                            WHEN 'sometimes' THEN 3.5
                            WHEN 'on_your_own' THEN 2.0
                        END +
                        CASE hap.caregiver2_preference
                            WHEN 'drop_anything' THEN 5.0
                            WHEN 'sometimes' THEN 3.5
                            WHEN 'on_your_own' THEN 2.0
                        END +
                        CASE hap.both_preference
                            WHEN 'drop_anything' THEN 5.0
                            WHEN 'sometimes' THEN 3.5
                            WHEN 'on_your_own' THEN 2.0
                        END
                    ) / 3.0
                -- Use both_preference if only that is set
                WHEN hap.both_preference IS NOT NULL THEN
                    CASE hap.both_preference
                        WHEN 'drop_anything' THEN 5.0
                        WHEN 'sometimes' THEN 3.5
                        WHEN 'on_your_own' THEN 2.0
                    END
                -- Use average of caregiver1 and caregiver2 if both set
                WHEN hap.caregiver1_preference IS NOT NULL AND hap.caregiver2_preference IS NOT NULL THEN
                    (
                        CASE hap.caregiver1_preference
                            WHEN 'drop_anything' THEN 5.0
                            WHEN 'sometimes' THEN 3.5
                            WHEN 'on_your_own' THEN 2.0
                        END +
                        CASE hap.caregiver2_preference
                            WHEN 'drop_anything' THEN 5.0
                            WHEN 'sometimes' THEN 3.5
                            WHEN 'on_your_own' THEN 2.0
                        END
                    ) / 2.0
                -- Use caregiver1 if only that is set
                WHEN hap.caregiver1_preference IS NOT NULL THEN
                    CASE hap.caregiver1_preference
                        WHEN 'drop_anything' THEN 5.0
                        WHEN 'sometimes' THEN 3.5
                        WHEN 'on_your_own' THEN 2.0
                    END
                -- Use caregiver2 if only that is set
                WHEN hap.caregiver2_preference IS NOT NULL THEN
                    CASE hap.caregiver2_preference
                        WHEN 'drop_anything' THEN 5.0
                        WHEN 'sometimes' THEN 3.5
                        WHEN 'on_your_own' THEN 2.0
                    END
                -- No household preference set, use neutral
                ELSE 3.0
            END as score
        FROM public.kid_activities ka
        LEFT JOIN public.household_activities ha 
            ON ha.activity_id = ka.id AND ha.user_id = v_parent_id
        LEFT JOIN public.household_activity_preferences hap 
            ON hap.household_activity_id = ha.id
    ),
    
    -- Score 3: Similar kids' preferences (20% default weight)
    similar_kids_scores AS (
        SELECT 
            kp.activity_id,
            AVG(CASE kp.preference_level
                WHEN 'loves' THEN 5.0
                WHEN 'likes' THEN 4.0
                WHEN 'neutral' THEN 3.0
                WHEN 'dislikes' THEN 2.0
                WHEN 'refuses' THEN 1.0
                ELSE 3.0
            END) as score
        FROM public.kid_similarity_cache ksc
        JOIN public.kid_preferences kp ON kp.kid_id = ksc.similar_kid_id
        WHERE ksc.kid_id = p_kid_id
          AND ksc.similarity_score > 0.3
        GROUP BY kp.activity_id
    ),
    
    -- Score 4: Teacher observations (10% default weight)
    teacher_scores AS (
        SELECT 
            ka.id as activity_id,
            3.5 as score -- Placeholder
        FROM public.kid_activities ka
    ),
    
    -- Score 5: Context matching (10% default weight)
    context_scores AS (
        SELECT 
            ka.id as activity_id,
            CASE 
                WHEN p_context IS NULL THEN 3.0
                WHEN EXISTS (
                    SELECT 1 FROM public.activity_contexts ac
                    JOIN public.recommendation_contexts rc ON rc.id = ac.context_id
                    WHERE ac.activity_id = ka.id AND rc.context_key = p_context
                ) THEN 5.0
                ELSE 2.0
            END as score
        FROM public.kid_activities ka
    ),
    
    -- Score 6: Novelty boost (5% default weight)
    novelty_scores AS (
        SELECT 
            ka.id as activity_id,
            CASE 
                WHEN kp.id IS NULL THEN 4.0
                ELSE 3.0
            END as score
        FROM public.kid_activities ka
        LEFT JOIN public.kid_preferences kp ON kp.activity_id = ka.id AND kp.kid_id = p_kid_id
    ),
    
    -- Score 7: Recency penalty (15% default weight)
    recency_penalty AS (
        SELECT 
            rh.activity_id,
            CASE 
                WHEN MAX(rh.created_at) > NOW() - INTERVAL '7 days' THEN 2.0
                WHEN MAX(rh.created_at) > NOW() - INTERVAL '30 days' THEN 1.0
                ELSE 0.0
            END as penalty
        FROM public.recommendation_history rh
        WHERE rh.kid_id = p_kid_id
        GROUP BY rh.activity_id
    ),
    
    -- Combine all scores
    final_scores AS (
        SELECT 
            ka.id as activity_id,
            ka.name as activity_name,
            ka.description as activity_description,
            kac.name as category_name,
            (
                (COALESCE(dp.score, 3.0) * v_rule.direct_preference_weight) +
                (COALESCE(pi.score, 3.0) * v_rule.parent_influence_weight) +
                (COALESCE(sks.score, 3.0) * v_rule.kid_similar_weight) +
                (COALESCE(ts.score, 3.0) * v_rule.teacher_observation_weight) +
                (COALESCE(cs.score, 3.0) * v_rule.context_match_weight) +
                (COALESCE(ns.score, 3.0) * v_rule.novelty_boost_weight) -
                (COALESCE(rp.penalty, 0.0) * v_rule.recency_penalty_weight)
            ) as final_score,
            jsonb_build_object(
                'direct_preference', COALESCE(dp.score, 3.0),
                'parent_influence', COALESCE(pi.score, 3.0),
                'similar_kids', COALESCE(sks.score, 3.0),
                'teacher_observation', COALESCE(ts.score, 3.0),
                'context_match', COALESCE(cs.score, 3.0),
                'novelty', COALESCE(ns.score, 3.0),
                'recency_penalty', COALESCE(rp.penalty, 0.0)
            ) as explanation
        FROM public.kid_activities ka
        JOIN public.kid_activity_categories kac ON kac.id = ka.category_id
        LEFT JOIN direct_prefs dp ON dp.activity_id = ka.id
        LEFT JOIN parent_influence pi ON pi.activity_id = ka.id
        LEFT JOIN similar_kids_scores sks ON sks.activity_id = ka.id
        LEFT JOIN teacher_scores ts ON ts.activity_id = ka.id
        LEFT JOIN context_scores cs ON cs.activity_id = ka.id
        LEFT JOIN novelty_scores ns ON ns.activity_id = ka.id
        LEFT JOIN recency_penalty rp ON rp.activity_id = ka.id
        WHERE kac.parent_id IS NULL
    )
    
    SELECT 
        fs.activity_id,
        fs.activity_name,
        fs.activity_description,
        fs.category_name,
        fs.final_score::DECIMAL(5,2) as score,
        fs.explanation
    FROM final_scores fs
    ORDER BY fs.final_score DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_recommendations_for_kid IS 
    'Generate personalized activity recommendations using household multi-caregiver preferences';

-- ============================================================================
-- Completion Log
-- ============================================================================

DO $$
DECLARE
    household_count INTEGER;
    prefs_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO household_count FROM public.household_activities;
    SELECT COUNT(*) INTO prefs_count FROM public.household_activity_preferences;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Household Multi-Caregiver Preferences Setup Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - household_activities (% activities)', household_count;
    RAISE NOTICE '  - household_activity_preferences (% preferences)', prefs_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '  - Curated household activity lists';
    RAISE NOTICE '  - 3 caregiver preferences per activity';
    RAISE NOTICE '  - Updated recommendation function';
    RAISE NOTICE '  - Data migrated from old system';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Update preferences-manager UI';
    RAISE NOTICE '  2. Create kids activity view';
    RAISE NOTICE '  3. Test with real data';
END $$;
