-- Phase 3A: App Access Registration
-- Register the recommendations app in the platform

-- Register recommendations app
INSERT INTO public.apps (name, description, url, icon, category, is_active, sort_order)
VALUES (
    'Activity Recommendations',
    'Get personalized activity recommendations based on preferences, similar kids, and context',
    'recommendations.html',
    '✨',
    'features',
    true,
    6
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    url = EXCLUDED.url,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;

-- Register recommendation settings app
INSERT INTO public.apps (name, description, url, icon, category, is_active, sort_order)
VALUES (
    'Recommendation Settings',
    'Customize how recommendations are generated for your family',
    'recommendation-settings.html',
    '⚙️',
    'settings',
    true,
    7
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    url = EXCLUDED.url,
    icon = EXCLUDED.icon,
    is_active = EXCLUDED.is_active;
