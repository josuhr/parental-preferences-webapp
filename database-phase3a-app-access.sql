-- Phase 3A: App Access Registration
-- Register the recommendations app in the platform

-- Register recommendations app
INSERT INTO public.apps (slug, name, description, icon, is_active)
VALUES (
    'recommendations',
    'Activity Recommendations',
    'Get personalized activity recommendations based on preferences, similar kids, and context',
    '✨',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- Register recommendation settings app
INSERT INTO public.apps (slug, name, description, icon, is_active)
VALUES (
    'recommendation-settings',
    'Recommendation Settings',
    'Customize how recommendations are generated for your family',
    '⚙️',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- Grant all existing users access to recommendations app
INSERT INTO public.user_app_access (user_id, app_id, role)
SELECT u.id, a.id, 'user'
FROM public.users u
CROSS JOIN public.apps a
WHERE a.slug = 'recommendations'
ON CONFLICT (user_id, app_id) DO NOTHING;

-- Grant all existing users access to recommendation settings app
INSERT INTO public.user_app_access (user_id, app_id, role)
SELECT u.id, a.id, 'user'
FROM public.users u
CROSS JOIN public.apps a
WHERE a.slug = 'recommendation-settings'
ON CONFLICT (user_id, app_id) DO NOTHING;
