-- Phase 4 Update: Parent Preferences for Kid Activities
-- Allow parents to set their preferences on universal kid activities
-- This enables the "Parent Influence" factor in the recommendation engine

-- ============================================================================
-- Parent Kid Activity Preferences Table
-- ============================================================================
-- Stores parent preference levels for kid activities
-- "Drop anything", "Sometimes", "On your own"

CREATE TABLE IF NOT EXISTS public.parent_kid_activity_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.kid_activities(id) ON DELETE CASCADE NOT NULL,
    preference_level TEXT CHECK (preference_level IN ('drop_anything', 'sometimes', 'on_your_own')) NOT NULL,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, activity_id)
);

COMMENT ON TABLE public.parent_kid_activity_preferences IS 
    'Parent preferences for universal kid activities - used in recommendation Parent Influence scoring';

COMMENT ON COLUMN public.parent_kid_activity_preferences.preference_level IS 
    'drop_anything: Parent will drop anything to do this, sometimes: Parent enjoys this activity, on_your_own: Kid should do this independently';

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE public.parent_kid_activity_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view own kid activity preferences"
    ON public.parent_kid_activity_preferences FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can insert their own preferences
CREATE POLICY "Users can insert own kid activity preferences"
    ON public.parent_kid_activity_preferences FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "Users can update own kid activity preferences"
    ON public.parent_kid_activity_preferences FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Users can delete their own preferences
CREATE POLICY "Users can delete own kid activity preferences"
    ON public.parent_kid_activity_preferences FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_parent_kid_prefs_user 
    ON public.parent_kid_activity_preferences(user_id);

CREATE INDEX idx_parent_kid_prefs_activity 
    ON public.parent_kid_activity_preferences(activity_id);

-- ============================================================================
-- Update Recommendation Function
-- ============================================================================

-- Drop existing function variants (specify all possible signatures)
DROP FUNCTION IF EXISTS get_recommendations_for_kid(p_kid_id UUID, p_context TEXT, p_limit INTEGER);
DROP FUNCTION IF EXISTS get_recommendations_for_kid(UUID, TEXT, INTEGER);

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
    
    -- Score 2: Parent influence (20% default weight) - NOW USES NEW TABLE
    parent_influence AS (
        SELECT 
            ka.id as activity_id,
            CASE pkap.preference_level
                WHEN 'drop_anything' THEN 5.0
                WHEN 'sometimes' THEN 3.5
                WHEN 'on_your_own' THEN 2.0
                ELSE 3.0
            END as score
        FROM public.kid_activities ka
        LEFT JOIN public.parent_kid_activity_preferences pkap 
            ON pkap.user_id = v_parent_id AND pkap.activity_id = ka.id
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
            3.5 as score -- Placeholder - would use teacher observation data
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
                WHEN kp.id IS NULL THEN 4.0 -- Never tried
                ELSE 3.0
            END as score
        FROM public.kid_activities ka
        LEFT JOIN public.kid_preferences kp ON kp.activity_id = ka.id AND kp.kid_id = p_kid_id
    ),
    
    -- Score 7: Recency penalty (15% default weight) - subtract from final
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
    
    -- Combine all scores with weights
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
        WHERE kac.parent_id IS NULL -- Only universal activities
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
    'Generate personalized activity recommendations for a kid using multi-factor scoring with parent kid activity preferences';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Parent kid activity preferences table created successfully!';
    RAISE NOTICE 'Parents can now set preferences: drop_anything, sometimes, on_your_own';
    RAISE NOTICE 'Recommendation function updated to use new parent preferences';
END $$;
