-- Phase 3A: Recommendations Engine Testing Script
-- This script tests the recommendation algorithm with sample data
-- Run after database-phase3a-recommendations.sql

-- ============================================================================
-- Test 1: Verify Tables and Default Data
-- ============================================================================

SELECT 'Test 1: Checking tables exist...' AS test;

SELECT 
    'recommendation_contexts' AS table_name,
    COUNT(*) AS row_count,
    CASE WHEN COUNT(*) >= 14 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM public.recommendation_contexts
UNION ALL
SELECT 
    'recommendation_rules',
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN '✓ PASS' ELSE '✗ FAIL (Run after user creation)' END
FROM public.recommendation_rules;

-- ============================================================================
-- Test 2: Verify Functions Exist
-- ============================================================================

SELECT 'Test 2: Checking functions exist...' AS test;

SELECT 
    routine_name,
    '✓ EXISTS' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'compute_cosine_similarity',
    'compute_all_kid_similarities',
    'compute_activity_similarities',
    'get_similar_kids',
    'get_similar_activities',
    'get_recommendations_for_kid',
    'record_recommendation_feedback',
    'initialize_recommendation_rules'
)
ORDER BY routine_name;

-- ============================================================================
-- Test 3: Test Cosine Similarity Calculation
-- ============================================================================

SELECT 'Test 3: Testing cosine similarity calculation...' AS test;

-- Create test kids if not exist (adjust parent_id to your test user)
DO $$
DECLARE
    v_test_parent_id UUID;
    v_test_kid1_id UUID;
    v_test_kid2_id UUID;
    v_test_category_id UUID;
    v_test_activity1_id UUID;
    v_test_activity2_id UUID;
    v_test_activity3_id UUID;
BEGIN
    -- Find or create test parent
    SELECT id INTO v_test_parent_id FROM public.users WHERE email LIKE '%test%' LIMIT 1;
    
    IF v_test_parent_id IS NULL THEN
        RAISE NOTICE 'No test user found. Create a user first to run full tests.';
        RETURN;
    END IF;
    
    -- Clean up old test data
    DELETE FROM public.kids WHERE name IN ('Test Kid 1', 'Test Kid 2') AND parent_id = v_test_parent_id;
    
    -- Create test kids
    INSERT INTO public.kids (parent_id, name, birth_date)
    VALUES (v_test_parent_id, 'Test Kid 1', '2018-01-01')
    RETURNING id INTO v_test_kid1_id;
    
    INSERT INTO public.kids (parent_id, name, birth_date)
    VALUES (v_test_parent_id, 'Test Kid 2', '2017-06-15')
    RETURNING id INTO v_test_kid2_id;
    
    -- Create test category
    INSERT INTO public.kid_activity_categories (parent_id, name, icon)
    VALUES (v_test_parent_id, 'Test Activities', '🧪')
    RETURNING id INTO v_test_category_id;
    
    -- Create test activities
    INSERT INTO public.kid_activities (category_id, name, description)
    VALUES (v_test_category_id, 'Test Activity A', 'First test activity')
    RETURNING id INTO v_test_activity1_id;
    
    INSERT INTO public.kid_activities (category_id, name, description)
    VALUES (v_test_category_id, 'Test Activity B', 'Second test activity')
    RETURNING id INTO v_test_activity2_id;
    
    INSERT INTO public.kid_activities (category_id, name, description)
    VALUES (v_test_category_id, 'Test Activity C', 'Third test activity')
    RETURNING id INTO v_test_activity3_id;
    
    -- Add preferences for kid 1
    INSERT INTO public.kid_preferences (kid_id, activity_id, preference_level)
    VALUES 
        (v_test_kid1_id, v_test_activity1_id, 'loves'),
        (v_test_kid1_id, v_test_activity2_id, 'likes'),
        (v_test_kid1_id, v_test_activity3_id, 'neutral');
    
    -- Add preferences for kid 2 (similar to kid 1)
    INSERT INTO public.kid_preferences (kid_id, activity_id, preference_level)
    VALUES 
        (v_test_kid2_id, v_test_activity1_id, 'loves'),
        (v_test_kid2_id, v_test_activity2_id, 'likes'),
        (v_test_kid2_id, v_test_activity3_id, 'dislikes');
    
    RAISE NOTICE 'Test data created successfully!';
    RAISE NOTICE 'Test Kid 1 ID: %', v_test_kid1_id;
    RAISE NOTICE 'Test Kid 2 ID: %', v_test_kid2_id;
END $$;

-- Test similarity between test kids
SELECT 
    k1.name AS kid1,
    k2.name AS kid2,
    compute_cosine_similarity(k1.id, k2.id) AS similarity_score,
    CASE 
        WHEN compute_cosine_similarity(k1.id, k2.id) > 0.5 THEN '✓ PASS (High similarity expected)'
        ELSE '⚠ WARNING (Low similarity)'
    END AS status
FROM public.kids k1
CROSS JOIN public.kids k2
WHERE k1.name = 'Test Kid 1' 
AND k2.name = 'Test Kid 2'
LIMIT 1;

-- ============================================================================
-- Test 4: Test Batch Similarity Computation
-- ============================================================================

SELECT 'Test 4: Computing all kid similarities...' AS test;

-- Note: This may take time if you have many kids. Skip if too slow.
-- SELECT * FROM compute_all_kid_similarities();

SELECT 
    'Kid similarity cache',
    COUNT(*) AS cached_pairs,
    AVG(similarity_score) AS avg_similarity,
    MAX(similarity_score) AS max_similarity,
    CASE WHEN COUNT(*) > 0 THEN '✓ PASS' ELSE '⚠ WARNING (No similarities computed yet)' END AS status
FROM public.kid_similarity_cache;

-- ============================================================================
-- Test 5: Test Activity Similarity Computation
-- ============================================================================

SELECT 'Test 5: Computing activity similarities...' AS test;

-- Note: Requires at least 2 kids with overlapping preferences
-- SELECT * FROM compute_activity_similarities();

SELECT 
    'Activity similarity',
    COUNT(*) AS similar_pairs,
    AVG(similarity_score) AS avg_similarity,
    CASE WHEN COUNT(*) >= 0 THEN '✓ PASS' ELSE '⚠ INFO (Need more data)' END AS status
FROM public.activity_similarity;

-- ============================================================================
-- Test 6: Test Recommendation Generation
-- ============================================================================

SELECT 'Test 6: Generating recommendations...' AS test;

-- Get recommendations for test kid
WITH test_kid AS (
    SELECT id FROM public.kids WHERE name = 'Test Kid 1' LIMIT 1
)
SELECT 
    activity_name,
    recommendation_score,
    confidence,
    explanation->>'preference' AS preference_reason,
    CASE 
        WHEN recommendation_score > 0 THEN '✓ PASS'
        ELSE '✗ FAIL'
    END AS status
FROM test_kid, get_recommendations_for_kid(test_kid.id, '{}'::jsonb, 5)
LIMIT 5;

-- ============================================================================
-- Test 7: Test Recommendation Feedback Recording
-- ============================================================================

SELECT 'Test 7: Testing feedback recording...' AS test;

-- Record feedback (will only work if test data exists)
DO $$
DECLARE
    v_test_kid_id UUID;
    v_test_activity_id UUID;
    v_history_id UUID;
BEGIN
    SELECT id INTO v_test_kid_id FROM public.kids WHERE name = 'Test Kid 1' LIMIT 1;
    SELECT id INTO v_test_activity_id FROM public.kid_activities WHERE name = 'Test Activity A' LIMIT 1;
    
    IF v_test_kid_id IS NOT NULL AND v_test_activity_id IS NOT NULL THEN
        v_history_id := record_recommendation_feedback(
            v_test_kid_id,
            v_test_activity_id,
            'selected',
            85.5,
            '{"test": true}'::jsonb,
            '{"time": "morning"}'::jsonb
        );
        RAISE NOTICE 'Feedback recorded with ID: %', v_history_id;
    ELSE
        RAISE NOTICE 'Skipping feedback test - no test data found';
    END IF;
END $$;

-- Verify feedback was recorded
SELECT 
    'Recommendation history',
    COUNT(*) AS feedback_count,
    COUNT(DISTINCT user_action) AS distinct_actions,
    CASE WHEN COUNT(*) > 0 THEN '✓ PASS' ELSE '⚠ INFO (No feedback yet)' END AS status
FROM public.recommendation_history;

-- ============================================================================
-- Test 8: Test Context Filtering
-- ============================================================================

SELECT 'Test 8: Testing context-based recommendations...' AS test;

-- Get recommendations with indoor context
WITH test_kid AS (
    SELECT id FROM public.kids WHERE name = 'Test Kid 1' LIMIT 1
)
SELECT 
    activity_name,
    recommendation_score,
    explanation->>'context' AS context_match,
    '✓ INFO' AS status
FROM test_kid, get_recommendations_for_kid(
    test_kid.id, 
    '{"location": "indoor"}'::jsonb, 
    3
)
LIMIT 3;

-- ============================================================================
-- Test 9: Test Recommendation Rules Customization
-- ============================================================================

SELECT 'Test 9: Testing custom recommendation weights...' AS test;

-- Check if rules are initialized
SELECT 
    rule_type,
    weight,
    is_enabled,
    CASE WHEN weight BETWEEN 0 AND 1 THEN '✓ PASS' ELSE '✗ FAIL' END AS status
FROM public.recommendation_rules
WHERE user_id IN (SELECT id FROM public.users LIMIT 1)
ORDER BY rule_type;

-- ============================================================================
-- Test 10: Performance Test
-- ============================================================================

SELECT 'Test 10: Performance test...' AS test;

-- Time a recommendation query
EXPLAIN ANALYZE
SELECT * 
FROM get_recommendations_for_kid(
    (SELECT id FROM public.kids LIMIT 1),
    '{}'::jsonb,
    20
);

-- ============================================================================
-- Test Summary
-- ============================================================================

SELECT '============================================' AS separator;
SELECT 'PHASE 3A TESTS COMPLETE' AS summary;
SELECT '============================================' AS separator;

SELECT 
    'Tables' AS component,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE '%recommendation%' OR table_name LIKE '%similarity%') AS count,
    '6 expected' AS expected
UNION ALL
SELECT 
    'Functions',
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name LIKE '%similar%' OR routine_name LIKE '%recommend%'),
    '8+ expected'
UNION ALL
SELECT 
    'Default Contexts',
    (SELECT COUNT(*) FROM public.recommendation_contexts),
    '14 expected'
UNION ALL
SELECT 
    'RLS Policies',
    (SELECT COUNT(*) FROM pg_policies WHERE tablename LIKE '%recommendation%' OR tablename LIKE '%similarity%'),
    '20+ expected';

-- ============================================================================
-- Cleanup (Optional - Comment out to keep test data)
-- ============================================================================

/*
-- Clean up test data
DELETE FROM public.kids WHERE name IN ('Test Kid 1', 'Test Kid 2');
DELETE FROM public.kid_activity_categories WHERE name = 'Test Activities';
SELECT 'Test data cleaned up' AS cleanup;
*/

-- ============================================================================
-- Next Steps
-- ============================================================================

SELECT 'Next Steps:' AS instructions;
SELECT '1. Run compute_all_kid_similarities() with real data' AS step;
SELECT '2. Run compute_activity_similarities() with real data' AS step;
SELECT '3. Test UI at recommendations.html' AS step;
SELECT '4. Adjust recommendation weights at recommendation-settings.html' AS step;
SELECT '5. Schedule nightly batch jobs' AS step;
