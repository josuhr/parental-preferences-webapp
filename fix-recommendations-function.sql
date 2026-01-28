-- Fix get_recommendations_for_kid function to remove references to non-existent tables
-- Simplifies context_scores to not reference activity_contexts/recommendation_contexts tables

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
    
    -- Score 2: Parent influence (20% default weight) - USES HOUSEHOLD PREFERENCES
    parent_influence AS (
        SELECT 
            ka.id as activity_id,
            CASE 
                -- Average caregiver1 and caregiver2 if both set
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
        FROM public.kid_preferences kp
        WHERE kp.kid_id != p_kid_id
        GROUP BY kp.activity_id
    ),
    
    -- Score 4: Teacher observations (10% default weight)
    teacher_scores AS (
        SELECT 
            ka.id as activity_id,
            3.5 as score -- Placeholder - neutral score until teacher observations implemented
        FROM public.kid_activities ka
    ),
    
    -- Score 5: Context matching (10% default weight) - SIMPLIFIED
    context_scores AS (
        SELECT 
            ka.id as activity_id,
            3.0 as score -- Neutral score - context matching not yet implemented
        FROM public.kid_activities ka
    ),
    
    -- Score 6: Novelty boost (5% default weight)
    novelty_scores AS (
        SELECT 
            ka.id as activity_id,
            CASE 
                WHEN kp.id IS NULL THEN 4.0 -- Boost for untried activities
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
    
    -- Final weighted score calculation
    final_scores AS (
        SELECT 
            ka.id as activity_id,
            ka.name as activity_name,
            ka.description as activity_description,
            kac.name as category_name,
            (
                COALESCE(dp.score, 3.0) * v_rule.direct_preference_weight +
                COALESCE(pi.score, 3.0) * v_rule.parent_influence_weight +
                COALESCE(sks.score, 3.0) * v_rule.kid_similar_weight +
                COALESCE(ts.score, 3.5) * v_rule.teacher_observation_weight +
                COALESCE(cs.score, 3.0) * v_rule.context_match_weight +
                COALESCE(ns.score, 3.0) * v_rule.novelty_boost_weight -
                COALESCE(rp.penalty, 0.0) * v_rule.recency_penalty_weight
            ) as final_score,
            jsonb_build_object(
                'kid_preference_score', COALESCE(dp.score, 3.0),
                'parent_preference_score', COALESCE(pi.score, 3.0),
                'similar_kids_score', COALESCE(sks.score, 3.0),
                'novelty_score', COALESCE(ns.score, 3.0),
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
        -- Only recommend activities from universal categories
        WHERE kac.parent_id IS NULL
    )
    
    SELECT 
        fs.activity_id,
        fs.activity_name,
        fs.activity_description,
        fs.category_name,
        ROUND(fs.final_score::numeric, 2) as score,
        fs.explanation
    FROM final_scores fs
    ORDER BY fs.final_score DESC
    LIMIT p_limit;
END;
$$;
