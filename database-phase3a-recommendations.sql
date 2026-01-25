-- Phase 3A: Recommendations Engine
-- This schema adds intelligent activity recommendations based on preferences, 
-- similar kids, parent preferences, teacher observations, and context

-- ============================================================================
-- Recommendation Contexts Table
-- ============================================================================
-- Stores context information for contextual recommendations
-- (e.g., indoor activities for rainy days, high-energy activities for morning)

CREATE TABLE IF NOT EXISTS public.recommendation_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    context_type TEXT CHECK (context_type IN (
        'time_of_day',      -- morning, afternoon, evening
        'weather',          -- sunny, rainy, snowy
        'energy_level',     -- high, medium, low
        'group_size',       -- solo, small_group, large_group
        'location',         -- indoor, outdoor, travel
        'duration',         -- quick, medium, extended
        'season'            -- spring, summer, fall, winter
    )),
    attributes JSONB DEFAULT '{}'::jsonb,  -- Flexible context-specific attributes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Activity Context Mapping Table
-- ============================================================================
-- Links activities to contexts where they work well

CREATE TABLE IF NOT EXISTS public.activity_contexts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES public.kid_activities(id) ON DELETE CASCADE NOT NULL,
    context_id UUID REFERENCES public.recommendation_contexts(id) ON DELETE CASCADE NOT NULL,
    fit_score DECIMAL(3,2) CHECK (fit_score >= 0 AND fit_score <= 1) DEFAULT 0.8,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id, context_id)
);

-- ============================================================================
-- Activity Similarity Table
-- ============================================================================
-- Pre-computed similarity scores between activities
-- Used for "kids who liked X also liked Y" recommendations

CREATE TABLE IF NOT EXISTS public.activity_similarity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id_1 UUID REFERENCES public.kid_activities(id) ON DELETE CASCADE NOT NULL,
    activity_id_2 UUID REFERENCES public.kid_activities(id) ON DELETE CASCADE NOT NULL,
    similarity_score DECIMAL(3,2) CHECK (similarity_score >= 0 AND similarity_score <= 1) NOT NULL,
    similarity_reasons JSONB DEFAULT '[]'::jsonb,  -- Array of reasons (e.g., ["same_category", "similar_age"])
    co_occurrence_count INTEGER DEFAULT 0,  -- How many kids like both
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(activity_id_1, activity_id_2),
    CHECK (activity_id_1 < activity_id_2)  -- Ensure we don't store duplicates in reverse order
);

-- ============================================================================
-- Kid Similarity Cache Table
-- ============================================================================
-- Pre-computed similarity scores between kids based on preference patterns
-- Updated via batch job (nightly)

CREATE TABLE IF NOT EXISTS public.kid_similarity_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    similar_kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    similarity_score DECIMAL(3,2) CHECK (similarity_score >= 0 AND similarity_score <= 1) NOT NULL,
    common_preferences_count INTEGER DEFAULT 0,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kid_id, similar_kid_id),
    CHECK (kid_id != similar_kid_id)  -- Can't be similar to yourself
);

-- ============================================================================
-- Recommendation Rules Table
-- ============================================================================
-- Configurable scoring logic for recommendations
-- Users can customize weights per family

CREATE TABLE IF NOT EXISTS public.recommendation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    rule_type TEXT CHECK (rule_type IN (
        'preference_match',      -- Direct kid preference
        'parent_influence',      -- Parent's preference for activity
        'similar_kids',          -- What similar kids like
        'teacher_endorsement',   -- Teacher observations
        'context_match',         -- Context-appropriate activities
        'novelty_boost',         -- Promote trying new things
        'recency_penalty'        -- Reduce recently done activities
    )) NOT NULL,
    weight DECIMAL(3,2) CHECK (weight >= 0 AND weight <= 1) DEFAULT 0.5,
    is_enabled BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, rule_type)
);

-- ============================================================================
-- Recommendation History Table
-- ============================================================================
-- Tracks what was recommended to whom and what actions were taken
-- Provides feedback loop for improving recommendations

CREATE TABLE IF NOT EXISTS public.recommendation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.kid_activities(id) ON DELETE CASCADE NOT NULL,
    recommendation_score DECIMAL(5,2) NOT NULL,  -- 0.00 to 100.00
    explanation JSONB DEFAULT '{}'::jsonb,  -- Why it was recommended
    context_snapshot JSONB DEFAULT '{}'::jsonb,  -- Context at time of recommendation
    user_action TEXT CHECK (user_action IN (
        'shown',          -- Just displayed
        'selected',       -- User clicked/selected it
        'dismissed',      -- User said "not interested"
        'saved',          -- User saved for later
        'completed'       -- User marked as done
    )) DEFAULT 'shown',
    action_timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.recommendation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_similarity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_similarity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_history ENABLE ROW LEVEL SECURITY;

-- Recommendation Contexts (public read, admin write)
CREATE POLICY "Anyone can view contexts"
    ON public.recommendation_contexts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage contexts"
    ON public.recommendation_contexts FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- Activity Contexts (parents can view for their activities)
CREATE POLICY "Parents can view activity contexts for own activities"
    ON public.activity_contexts FOR SELECT
    TO authenticated
    USING (
        activity_id IN (
            SELECT ka.id 
            FROM public.kid_activities ka
            JOIN public.kid_activity_categories kac ON ka.category_id = kac.id
            WHERE kac.parent_id = auth.uid()
        )
    );

CREATE POLICY "Parents can manage activity contexts for own activities"
    ON public.activity_contexts FOR ALL
    TO authenticated
    USING (
        activity_id IN (
            SELECT ka.id 
            FROM public.kid_activities ka
            JOIN public.kid_activity_categories kac ON ka.category_id = kac.id
            WHERE kac.parent_id = auth.uid()
        )
    );

-- Activity Similarity (parents can view for their activities)
CREATE POLICY "Parents can view activity similarity for own activities"
    ON public.activity_similarity FOR SELECT
    TO authenticated
    USING (
        activity_id_1 IN (
            SELECT ka.id 
            FROM public.kid_activities ka
            JOIN public.kid_activity_categories kac ON ka.category_id = kac.id
            WHERE kac.parent_id = auth.uid()
        )
        OR activity_id_2 IN (
            SELECT ka.id 
            FROM public.kid_activities ka
            JOIN public.kid_activity_categories kac ON ka.category_id = kac.id
            WHERE kac.parent_id = auth.uid()
        )
    );

-- Kid Similarity Cache (parents can view for their kids)
CREATE POLICY "Parents can view kid similarity for own kids"
    ON public.kid_similarity_cache FOR SELECT
    TO authenticated
    USING (
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid())
    );

-- Recommendation Rules (users manage their own rules)
CREATE POLICY "Users can view own recommendation rules"
    ON public.recommendation_rules FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own recommendation rules"
    ON public.recommendation_rules FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own recommendation rules"
    ON public.recommendation_rules FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own recommendation rules"
    ON public.recommendation_rules FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Recommendation History (parents can view for their kids)
CREATE POLICY "Parents can view recommendation history for own kids"
    ON public.recommendation_history FOR SELECT
    TO authenticated
    USING (
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid())
    );

CREATE POLICY "Parents can insert recommendation history for own kids"
    ON public.recommendation_history FOR INSERT
    TO authenticated
    WITH CHECK (
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid())
    );

CREATE POLICY "Parents can update recommendation history for own kids"
    ON public.recommendation_history FOR UPDATE
    TO authenticated
    USING (
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid())
    );

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Recommendation contexts
CREATE INDEX IF NOT EXISTS idx_recommendation_contexts_type 
    ON public.recommendation_contexts(context_type);

-- Activity contexts
CREATE INDEX IF NOT EXISTS idx_activity_contexts_activity_id 
    ON public.activity_contexts(activity_id);

CREATE INDEX IF NOT EXISTS idx_activity_contexts_context_id 
    ON public.activity_contexts(context_id);

CREATE INDEX IF NOT EXISTS idx_activity_contexts_fit_score 
    ON public.activity_contexts(activity_id, fit_score DESC);

-- Activity similarity
CREATE INDEX IF NOT EXISTS idx_activity_similarity_activity1 
    ON public.activity_similarity(activity_id_1, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_activity_similarity_activity2 
    ON public.activity_similarity(activity_id_2, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_activity_similarity_score 
    ON public.activity_similarity(similarity_score DESC);

-- Kid similarity cache
CREATE INDEX IF NOT EXISTS idx_kid_similarity_kid_id 
    ON public.kid_similarity_cache(kid_id, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_kid_similarity_score 
    ON public.kid_similarity_cache(similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_kid_similarity_computed 
    ON public.kid_similarity_cache(computed_at);

-- Recommendation rules
CREATE INDEX IF NOT EXISTS idx_recommendation_rules_user_id 
    ON public.recommendation_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_rules_type 
    ON public.recommendation_rules(user_id, rule_type);

-- Recommendation history
CREATE INDEX IF NOT EXISTS idx_recommendation_history_kid_id 
    ON public.recommendation_history(kid_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_history_activity_id 
    ON public.recommendation_history(activity_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_history_action 
    ON public.recommendation_history(kid_id, user_action, created_at DESC);

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

CREATE TRIGGER update_recommendation_contexts_updated_at
    BEFORE UPDATE ON public.recommendation_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommendation_rules_updated_at
    BEFORE UPDATE ON public.recommendation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT ALL ON public.recommendation_contexts TO authenticated;
GRANT ALL ON public.activity_contexts TO authenticated;
GRANT ALL ON public.activity_similarity TO authenticated;
GRANT ALL ON public.kid_similarity_cache TO authenticated;
GRANT ALL ON public.recommendation_rules TO authenticated;
GRANT ALL ON public.recommendation_history TO authenticated;

-- ============================================================================
-- Default Recommendation Contexts
-- ============================================================================
-- Insert common contexts that users can reference

INSERT INTO public.recommendation_contexts (name, description, context_type, attributes) VALUES
    ('Morning Energy', 'High-energy activities perfect for morning time', 'time_of_day', '{"time_range": "6:00-11:00", "energy": "high"}'::jsonb),
    ('Afternoon Calm', 'Moderate activities for afternoon', 'time_of_day', '{"time_range": "12:00-16:00", "energy": "medium"}'::jsonb),
    ('Evening Wind-Down', 'Calm activities before bedtime', 'time_of_day', '{"time_range": "17:00-20:00", "energy": "low"}'::jsonb),
    ('Rainy Day', 'Indoor activities for rainy weather', 'weather', '{"conditions": "rainy", "location": "indoor"}'::jsonb),
    ('Sunny Day', 'Outdoor activities for nice weather', 'weather', '{"conditions": "sunny", "location": "outdoor"}'::jsonb),
    ('High Energy', 'Activities requiring lots of energy', 'energy_level', '{"energy": "high", "physical": true}'::jsonb),
    ('Low Energy', 'Calm, quiet activities', 'energy_level', '{"energy": "low", "physical": false}'::jsonb),
    ('Solo Play', 'Activities kids can do alone', 'group_size', '{"participants": 1}'::jsonb),
    ('Small Group', 'Activities for 2-4 kids', 'group_size', '{"participants": "2-4"}'::jsonb),
    ('Large Group', 'Activities for 5+ kids', 'group_size', '{"participants": "5+"}'::jsonb),
    ('Quick Activity', 'Activities under 15 minutes', 'duration', '{"minutes": 15}'::jsonb),
    ('Extended Activity', 'Activities 30+ minutes', 'duration', '{"minutes": 30}'::jsonb),
    ('Indoor', 'Activities best done inside', 'location', '{"location": "indoor"}'::jsonb),
    ('Outdoor', 'Activities best done outside', 'location', '{"location": "outdoor"}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Helper Function: Initialize Default Recommendation Rules for User
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_recommendation_rules(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Insert default rule weights for a new user
    INSERT INTO public.recommendation_rules (user_id, rule_type, weight, is_enabled) VALUES
        (p_user_id, 'preference_match', 0.40, true),      -- 40% weight to direct preferences
        (p_user_id, 'parent_influence', 0.20, true),      -- 20% weight to parent preferences
        (p_user_id, 'similar_kids', 0.20, true),          -- 20% weight to similar kids
        (p_user_id, 'teacher_endorsement', 0.10, true),   -- 10% weight to teacher observations
        (p_user_id, 'context_match', 0.10, true),         -- 10% weight to context
        (p_user_id, 'novelty_boost', 0.05, true),         -- 5% boost for new activities
        (p_user_id, 'recency_penalty', 0.15, true)        -- 15% penalty for recent activities
    ON CONFLICT (user_id, rule_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatically create default rules for existing users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM public.users LOOP
        PERFORM initialize_recommendation_rules(user_record.id);
    END LOOP;
END $$;

-- Trigger to create default rules for new users
CREATE OR REPLACE FUNCTION handle_new_user_recommendation_rules()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_recommendation_rules(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created_recommendation_rules
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user_recommendation_rules();

-- ============================================================================
-- Similarity Algorithm Functions
-- ============================================================================

-- Function: Compute cosine similarity between two preference vectors
CREATE OR REPLACE FUNCTION compute_cosine_similarity(
    p_kid_id_1 UUID,
    p_kid_id_2 UUID
)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    v_similarity DECIMAL(3,2);
    v_dot_product DECIMAL;
    v_magnitude_1 DECIMAL;
    v_magnitude_2 DECIMAL;
BEGIN
    -- Build preference vectors and compute cosine similarity
    -- Preference levels: loves=1.0, likes=0.8, neutral=0.5, dislikes=0.2, refuses=0.0
    
    WITH kid1_vector AS (
        SELECT 
            activity_id,
            CASE preference_level
                WHEN 'loves' THEN 1.0
                WHEN 'likes' THEN 0.8
                WHEN 'neutral' THEN 0.5
                WHEN 'dislikes' THEN 0.2
                WHEN 'refuses' THEN 0.0
                ELSE 0.5
            END AS score
        FROM public.kid_preferences
        WHERE kid_id = p_kid_id_1
    ),
    kid2_vector AS (
        SELECT 
            activity_id,
            CASE preference_level
                WHEN 'loves' THEN 1.0
                WHEN 'likes' THEN 0.8
                WHEN 'neutral' THEN 0.5
                WHEN 'dislikes' THEN 0.2
                WHEN 'refuses' THEN 0.0
                ELSE 0.5
            END AS score
        FROM public.kid_preferences
        WHERE kid_id = p_kid_id_2
    ),
    common_activities AS (
        SELECT 
            k1.activity_id,
            k1.score AS score1,
            k2.score AS score2
        FROM kid1_vector k1
        INNER JOIN kid2_vector k2 ON k1.activity_id = k2.activity_id
    )
    SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 0.0
            WHEN SQRT(SUM(score1 * score1)) = 0 OR SQRT(SUM(score2 * score2)) = 0 THEN 0.0
            ELSE 
                ROUND(
                    (SUM(score1 * score2) / 
                    (SQRT(SUM(score1 * score1)) * SQRT(SUM(score2 * score2))))::numeric,
                    2
                )
        END
    INTO v_similarity
    FROM common_activities;
    
    RETURN COALESCE(v_similarity, 0.0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Compute all kid similarities and update cache
CREATE OR REPLACE FUNCTION compute_all_kid_similarities()
RETURNS TABLE (
    processed_count INTEGER,
    similarity_pairs INTEGER,
    execution_time_ms BIGINT
) AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_processed INTEGER := 0;
    v_pairs INTEGER := 0;
    kid1_record RECORD;
    kid2_record RECORD;
    v_similarity DECIMAL(3,2);
    v_common_count INTEGER;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Clear old cache data (older than 7 days)
    DELETE FROM public.kid_similarity_cache 
    WHERE computed_at < NOW() - INTERVAL '7 days';
    
    -- Compute similarities for all kid pairs
    FOR kid1_record IN 
        SELECT DISTINCT k.id, k.parent_id
        FROM public.kids k
        WHERE k.is_active = true
        ORDER BY k.id
    LOOP
        v_processed := v_processed + 1;
        
        FOR kid2_record IN 
            SELECT DISTINCT k.id, k.parent_id
            FROM public.kids k
            WHERE k.is_active = true 
            AND k.id > kid1_record.id  -- Only process each pair once
            ORDER BY k.id
        LOOP
            -- Compute similarity
            v_similarity := compute_cosine_similarity(kid1_record.id, kid2_record.id);
            
            -- Count common preferences
            SELECT COUNT(DISTINCT kp1.activity_id)
            INTO v_common_count
            FROM public.kid_preferences kp1
            INNER JOIN public.kid_preferences kp2 
                ON kp1.activity_id = kp2.activity_id
            WHERE kp1.kid_id = kid1_record.id 
            AND kp2.kid_id = kid2_record.id
            AND kp1.preference_level IN ('loves', 'likes')
            AND kp2.preference_level IN ('loves', 'likes');
            
            -- Only store if similarity is meaningful (> 0.1)
            IF v_similarity > 0.1 THEN
                -- Store both directions for easier querying
                INSERT INTO public.kid_similarity_cache 
                    (kid_id, similar_kid_id, similarity_score, common_preferences_count, computed_at)
                VALUES 
                    (kid1_record.id, kid2_record.id, v_similarity, v_common_count, NOW())
                ON CONFLICT (kid_id, similar_kid_id) 
                DO UPDATE SET 
                    similarity_score = EXCLUDED.similarity_score,
                    common_preferences_count = EXCLUDED.common_preferences_count,
                    computed_at = NOW();
                
                INSERT INTO public.kid_similarity_cache 
                    (kid_id, similar_kid_id, similarity_score, common_preferences_count, computed_at)
                VALUES 
                    (kid2_record.id, kid1_record.id, v_similarity, v_common_count, NOW())
                ON CONFLICT (kid_id, similar_kid_id) 
                DO UPDATE SET 
                    similarity_score = EXCLUDED.similarity_score,
                    common_preferences_count = EXCLUDED.common_preferences_count,
                    computed_at = NOW();
                
                v_pairs := v_pairs + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    v_end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
        v_processed,
        v_pairs,
        EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Compute activity similarities based on co-occurrence
CREATE OR REPLACE FUNCTION compute_activity_similarities()
RETURNS TABLE (
    processed_count INTEGER,
    similarity_pairs INTEGER,
    execution_time_ms BIGINT
) AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_processed INTEGER := 0;
    v_pairs INTEGER := 0;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Clear old similarity data
    DELETE FROM public.activity_similarity 
    WHERE computed_at < NOW() - INTERVAL '7 days';
    
    -- Compute activity similarities based on co-occurrence
    -- Activities are similar if many kids like both of them
    INSERT INTO public.activity_similarity 
        (activity_id_1, activity_id_2, similarity_score, co_occurrence_count, similarity_reasons, computed_at)
    SELECT 
        LEAST(kp1.activity_id, kp2.activity_id) AS activity_id_1,
        GREATEST(kp1.activity_id, kp2.activity_id) AS activity_id_2,
        ROUND(
            (COUNT(DISTINCT kp1.kid_id)::DECIMAL / 
            NULLIF(
                (SELECT COUNT(DISTINCT kid_id) 
                 FROM public.kid_preferences 
                 WHERE activity_id IN (kp1.activity_id, kp2.activity_id)
                 AND preference_level IN ('loves', 'likes')),
                0
            ))::numeric,
            2
        ) AS similarity_score,
        COUNT(DISTINCT kp1.kid_id) AS co_occurrence_count,
        jsonb_build_array('co_liked') AS similarity_reasons,
        NOW() AS computed_at
    FROM public.kid_preferences kp1
    INNER JOIN public.kid_preferences kp2 
        ON kp1.kid_id = kp2.kid_id 
        AND kp1.activity_id < kp2.activity_id
    WHERE kp1.preference_level IN ('loves', 'likes')
    AND kp2.preference_level IN ('loves', 'likes')
    GROUP BY kp1.activity_id, kp2.activity_id
    HAVING COUNT(DISTINCT kp1.kid_id) >= 2  -- At least 2 kids must like both
    ON CONFLICT (activity_id_1, activity_id_2) 
    DO UPDATE SET 
        similarity_score = EXCLUDED.similarity_score,
        co_occurrence_count = EXCLUDED.co_occurrence_count,
        computed_at = NOW();
    
    GET DIAGNOSTICS v_pairs = ROW_COUNT;
    
    v_end_time := clock_timestamp();
    
    RETURN QUERY SELECT 
        v_processed,
        v_pairs,
        EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get similar kids for a given kid
CREATE OR REPLACE FUNCTION get_similar_kids(
    p_kid_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    similar_kid_id UUID,
    similar_kid_name TEXT,
    similarity_score DECIMAL(3,2),
    common_preferences_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ksc.similar_kid_id,
        k.name,
        ksc.similarity_score,
        ksc.common_preferences_count
    FROM public.kid_similarity_cache ksc
    INNER JOIN public.kids k ON ksc.similar_kid_id = k.id
    WHERE ksc.kid_id = p_kid_id
    AND k.is_active = true
    ORDER BY ksc.similarity_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Get similar activities for a given activity
CREATE OR REPLACE FUNCTION get_similar_activities(
    p_activity_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    similar_activity_id UUID,
    similar_activity_name TEXT,
    similarity_score DECIMAL(3,2),
    co_occurrence_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN acs.activity_id_1 = p_activity_id THEN acs.activity_id_2
            ELSE acs.activity_id_1
        END AS similar_activity_id,
        ka.name,
        acs.similarity_score,
        acs.co_occurrence_count
    FROM public.activity_similarity acs
    INNER JOIN public.kid_activities ka 
        ON ka.id = CASE 
            WHEN acs.activity_id_1 = p_activity_id THEN acs.activity_id_2
            ELSE acs.activity_id_1
        END
    WHERE acs.activity_id_1 = p_activity_id 
    OR acs.activity_id_2 = p_activity_id
    ORDER BY acs.similarity_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- Recommendation Algorithm Functions
-- ============================================================================

-- Function: Get recommendations for a kid with scoring and explanations
CREATE OR REPLACE FUNCTION get_recommendations_for_kid(
    p_kid_id UUID,
    p_context_json JSONB DEFAULT '{}'::jsonb,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    activity_id UUID,
    activity_name TEXT,
    activity_description TEXT,
    recommendation_score DECIMAL(5,2),
    confidence INTEGER,
    explanation JSONB
) AS $$
DECLARE
    v_parent_id UUID;
    v_user_rules RECORD;
BEGIN
    -- Get parent_id for the kid
    SELECT parent_id INTO v_parent_id
    FROM public.kids
    WHERE id = p_kid_id;
    
    IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Kid not found or parent_id is null';
    END IF;
    
    -- Get user's recommendation rule weights
    SELECT 
        COALESCE(MAX(CASE WHEN rule_type = 'preference_match' THEN weight END), 0.40) AS preference_weight,
        COALESCE(MAX(CASE WHEN rule_type = 'parent_influence' THEN weight END), 0.20) AS parent_weight,
        COALESCE(MAX(CASE WHEN rule_type = 'similar_kids' THEN weight END), 0.20) AS similar_kids_weight,
        COALESCE(MAX(CASE WHEN rule_type = 'teacher_endorsement' THEN weight END), 0.10) AS teacher_weight,
        COALESCE(MAX(CASE WHEN rule_type = 'context_match' THEN weight END), 0.10) AS context_weight,
        COALESCE(MAX(CASE WHEN rule_type = 'novelty_boost' THEN weight END), 0.05) AS novelty_weight,
        COALESCE(MAX(CASE WHEN rule_type = 'recency_penalty' THEN weight END), 0.15) AS recency_weight
    INTO v_user_rules
    FROM public.recommendation_rules
    WHERE user_id = v_parent_id AND is_enabled = true;
    
    RETURN QUERY
    WITH 
    -- Get all available activities
    all_activities AS (
        SELECT 
            ka.id,
            ka.name,
            ka.description,
            ka.category_id
        FROM public.kid_activities ka
        INNER JOIN public.kid_activity_categories kac ON ka.category_id = kac.id
        WHERE kac.parent_id = v_parent_id
    ),
    
    -- Score 1: Direct preference match (40% default weight)
    preference_scores AS (
        SELECT 
            aa.id AS activity_id,
            CASE kp.preference_level
                WHEN 'loves' THEN 1.0
                WHEN 'likes' THEN 0.8
                WHEN 'neutral' THEN 0.5
                WHEN 'dislikes' THEN 0.2
                WHEN 'refuses' THEN 0.0
                ELSE 0.5  -- Unknown = neutral
            END * v_user_rules.preference_weight AS score,
            jsonb_build_object(
                'type', 'direct_preference',
                'level', COALESCE(kp.preference_level, 'unknown')
            ) AS reason
        FROM all_activities aa
        LEFT JOIN public.kid_preferences kp 
            ON kp.kid_id = p_kid_id AND kp.activity_id = aa.id
    ),
    
    -- Score 2: Parent preference influence (20% default weight)
    parent_scores AS (
        SELECT 
            aa.id AS activity_id,
            CASE pp.preference_level
                WHEN 'both' THEN 0.8
                WHEN 'mom' THEN 0.5
                WHEN 'dad' THEN 0.5
                WHEN 'neither' THEN 0.0
                ELSE 0.3  -- Unknown = slight preference
            END * v_user_rules.parent_weight AS score,
            jsonb_build_object(
                'type', 'parent_preference',
                'level', COALESCE(pp.preference_level, 'unknown')
            ) AS reason
        FROM all_activities aa
        LEFT JOIN public.activities a ON a.name = aa.name  -- Match by name (loose coupling)
        LEFT JOIN public.parent_preferences pp 
            ON pp.user_id = v_parent_id AND pp.activity_id = a.id
    ),
    
    -- Score 3: Similar kids' preferences (20% default weight)
    similar_kids_scores AS (
        SELECT 
            aa.id AS activity_id,
            COALESCE(
                AVG(
                    CASE kp.preference_level
                        WHEN 'loves' THEN 1.0
                        WHEN 'likes' THEN 0.8
                        ELSE 0.5
                    END * ksc.similarity_score
                ),
                0.0
            ) * v_user_rules.similar_kids_weight AS score,
            jsonb_build_object(
                'type', 'similar_kids',
                'count', COUNT(DISTINCT ksc.similar_kid_id)
            ) AS reason
        FROM all_activities aa
        LEFT JOIN public.kid_similarity_cache ksc ON ksc.kid_id = p_kid_id
        LEFT JOIN public.kid_preferences kp 
            ON kp.kid_id = ksc.similar_kid_id 
            AND kp.activity_id = aa.id
            AND kp.preference_level IN ('loves', 'likes')
        GROUP BY aa.id
    ),
    
    -- Score 4: Teacher observations (10% default weight)
    teacher_scores AS (
        SELECT 
            aa.id AS activity_id,
            CASE 
                WHEN COUNT(CASE WHEN to2.observation_type = 'preference' THEN 1 END) > 0 THEN 0.9
                WHEN COUNT(CASE WHEN to2.observation_type = 'success' THEN 1 END) > 0 THEN 0.7
                WHEN COUNT(*) > 0 THEN 0.5
                ELSE 0.0
            END * v_user_rules.teacher_weight AS score,
            jsonb_build_object(
                'type', 'teacher_observation',
                'count', COUNT(*)
            ) AS reason
        FROM all_activities aa
        LEFT JOIN public.teacher_observations to2 
            ON to2.kid_id = p_kid_id 
            AND to2.activity_id = aa.id
            AND to2.is_visible_to_parent = true
        GROUP BY aa.id
    ),
    
    -- Score 5: Context match (10% default weight)
    context_scores AS (
        SELECT 
            aa.id AS activity_id,
            COALESCE(AVG(ac.fit_score), 0.0) * v_user_rules.context_weight AS score,
            jsonb_build_object(
                'type', 'context_match',
                'matched', COUNT(ac.id) > 0
            ) AS reason
        FROM all_activities aa
        LEFT JOIN public.activity_contexts ac ON ac.activity_id = aa.id
        LEFT JOIN public.recommendation_contexts rc ON rc.id = ac.context_id
        WHERE p_context_json = '{}'::jsonb  -- If context provided, filter by it (TODO: enhance)
        OR rc.attributes @> p_context_json  -- JSONB containment check
        GROUP BY aa.id
    ),
    
    -- Novelty boost: Activities not yet rated by kid
    novelty_scores AS (
        SELECT 
            aa.id AS activity_id,
            CASE 
                WHEN kp.id IS NULL THEN v_user_rules.novelty_weight
                ELSE 0.0
            END AS score
        FROM all_activities aa
        LEFT JOIN public.kid_preferences kp 
            ON kp.kid_id = p_kid_id AND kp.activity_id = aa.id
    ),
    
    -- Recency penalty: Activities recently recommended or done
    recency_scores AS (
        SELECT 
            aa.id AS activity_id,
            CASE 
                WHEN MAX(rh.created_at) > NOW() - INTERVAL '7 days' THEN -v_user_rules.recency_weight
                WHEN MAX(rh.created_at) > NOW() - INTERVAL '30 days' THEN -(v_user_rules.recency_weight * 0.5)
                ELSE 0.0
            END AS score
        FROM all_activities aa
        LEFT JOIN public.recommendation_history rh 
            ON rh.kid_id = p_kid_id 
            AND rh.activity_id = aa.id
            AND rh.user_action IN ('selected', 'completed')
        GROUP BY aa.id
    ),
    
    -- Combine all scores
    combined_scores AS (
        SELECT 
            aa.id,
            aa.name,
            aa.description,
            (
                COALESCE(ps.score, 0) +
                COALESCE(pars.score, 0) +
                COALESCE(sks.score, 0) +
                COALESCE(ts.score, 0) +
                COALESCE(cs.score, 0) +
                COALESCE(ns.score, 0) +
                COALESCE(rs.score, 0)
            ) AS total_score,
            jsonb_build_object(
                'preference', ps.reason,
                'parent', pars.reason,
                'similar_kids', sks.reason,
                'teacher', ts.reason,
                'context', cs.reason
            ) AS explanation
        FROM all_activities aa
        LEFT JOIN preference_scores ps ON ps.activity_id = aa.id
        LEFT JOIN parent_scores pars ON pars.activity_id = aa.id
        LEFT JOIN similar_kids_scores sks ON sks.activity_id = aa.id
        LEFT JOIN teacher_scores ts ON ts.activity_id = aa.id
        LEFT JOIN context_scores cs ON cs.activity_id = aa.id
        LEFT JOIN novelty_scores ns ON ns.activity_id = aa.id
        LEFT JOIN recency_scores rs ON rs.activity_id = aa.id
    )
    
    -- Return top recommendations
    SELECT 
        cs.id,
        cs.name,
        cs.description,
        ROUND((cs.total_score * 100)::numeric, 2) AS recommendation_score,
        LEAST(100, GREATEST(0, ROUND((cs.total_score * 100)::numeric, 0)))::INTEGER AS confidence,
        cs.explanation
    FROM combined_scores cs
    ORDER BY cs.total_score DESC, cs.name
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function: Record recommendation feedback
CREATE OR REPLACE FUNCTION record_recommendation_feedback(
    p_kid_id UUID,
    p_activity_id UUID,
    p_action TEXT,
    p_recommendation_score DECIMAL DEFAULT 0.0,
    p_explanation JSONB DEFAULT '{}'::jsonb,
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_history_id UUID;
BEGIN
    INSERT INTO public.recommendation_history 
        (kid_id, activity_id, user_action, recommendation_score, explanation, context_snapshot, action_timestamp)
    VALUES 
        (p_kid_id, p_activity_id, p_action, p_recommendation_score, p_explanation, p_context, NOW())
    RETURNING id INTO v_history_id;
    
    RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
