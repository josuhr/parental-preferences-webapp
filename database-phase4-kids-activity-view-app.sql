-- Register Kids Activity View App
-- Allows kids to see which caregivers prefer which activities

-- Register the app
INSERT INTO public.apps (slug, name, description, icon, is_active)
VALUES (
    'kids-activity-view',
    'Who Likes What?',
    'See which caregivers enjoy which activities in your household',
    '👨‍👩‍👧‍👦',
    true
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- Grant access to all existing users
INSERT INTO public.user_app_access (user_id, app_id, role)
SELECT u.id, a.id, 'user'
FROM public.users u
CROSS JOIN public.apps a
WHERE a.slug = 'kids-activity-view'
ON CONFLICT (user_id, app_id) DO NOTHING;

-- Log completion
DO $$
DECLARE
    app_count INTEGER;
    access_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO app_count FROM public.apps WHERE slug = 'kids-activity-view';
    SELECT COUNT(*) INTO access_count FROM public.user_app_access WHERE app_id IN (SELECT id FROM public.apps WHERE slug = 'kids-activity-view');
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Kids Activity View App Registered!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'App: Who Likes What? (👨‍👩‍👧‍👦)';
    RAISE NOTICE 'Users with access: %', access_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Kids can now see which caregivers prefer which activities!';
END $$;
