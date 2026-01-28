-- HomeBase Rebrand Migration
-- Consolidate activity apps into "What We Like" and rebrand platform to HomeBase

-- ============================================================================
-- Create "What We Like" Consolidated App
-- ============================================================================

INSERT INTO public.apps (slug, name, description, icon, is_active)
VALUES (
    'what-we-like',
    'What We Like',
    'Track activity preferences, get recommendations, and discover what your family enjoys together',
    '❤️',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- Mark Old Activity Apps as Inactive (Keep for Data Integrity)
-- ============================================================================

UPDATE public.apps
SET is_active = false
WHERE slug IN (
    'parental-prefs',
    'kid-prefs',
    'recommendations',
    'recommendation-settings',
    'kids-activity-view'
);

-- ============================================================================
-- Grant All Users Access to "What We Like"
-- ============================================================================

INSERT INTO public.user_app_access (user_id, app_id, role)
SELECT u.id, a.id, 'user'
FROM public.users u
CROSS JOIN public.apps a
WHERE a.slug = 'what-we-like'
ON CONFLICT (user_id, app_id) DO NOTHING;

-- ============================================================================
-- Add Future App Placeholders (Inactive, Coming Soon)
-- ============================================================================

INSERT INTO public.apps (slug, name, description, icon, is_active)
VALUES 
    (
        'house-rules',
        'House Rules',
        'Build and manage values-driven house rules for your family',
        '📋',
        false
    ),
    (
        'food-explorer',
        'Food Explorer',
        'Track food preferences and encourage culinary adventures',
        '🍽️',
        false
    ),
    (
        'try-this',
        'Try This',
        'Gamified real-world experiences to expand engagement with the physical world',
        '🎯',
        false
    ),
    (
        'little-earners',
        'Little Earners',
        'Menu-driven task management and allowance system for kids',
        '💰',
        false
    )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Verification Query
-- ============================================================================

DO $$
DECLARE
    what_we_like_count INTEGER;
    inactive_apps_count INTEGER;
    future_apps_count INTEGER;
    user_access_count INTEGER;
BEGIN
    -- Count What We Like app
    SELECT COUNT(*) INTO what_we_like_count 
    FROM public.apps 
    WHERE slug = 'what-we-like' AND is_active = true;
    
    -- Count inactive old apps
    SELECT COUNT(*) INTO inactive_apps_count
    FROM public.apps
    WHERE slug IN ('parental-prefs', 'kid-prefs', 'recommendations', 'recommendation-settings', 'kids-activity-view')
      AND is_active = false;
    
    -- Count future app placeholders
    SELECT COUNT(*) INTO future_apps_count
    FROM public.apps
    WHERE slug IN ('house-rules', 'food-explorer', 'try-this', 'little-earners')
      AND is_active = false;
    
    -- Count user access records
    SELECT COUNT(*) INTO user_access_count
    FROM public.user_app_access uaa
    JOIN public.apps a ON a.id = uaa.app_id
    WHERE a.slug = 'what-we-like';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'HomeBase Rebrand Migration Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Active Apps:';
    RAISE NOTICE '  - What We Like: %', CASE WHEN what_we_like_count = 1 THEN '✓' ELSE '✗' END;
    RAISE NOTICE '  - Users with access: %', user_access_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Inactive Apps (Consolidated): %', inactive_apps_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Future Apps (Placeholders): %', future_apps_count;
    RAISE NOTICE '  - House Rules';
    RAISE NOTICE '  - Food Explorer';
    RAISE NOTICE '  - Try This';
    RAISE NOTICE '  - Little Earners';
    RAISE NOTICE '';
    RAISE NOTICE 'Platform Name: HomeBase';
    RAISE NOTICE 'Primary App: What We Like';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Deploy new frontend with sidebar navigation';
    RAISE NOTICE '  2. Users will see consolidated "What We Like" app';
    RAISE NOTICE '  3. Old URLs will continue to work';
END $$;
