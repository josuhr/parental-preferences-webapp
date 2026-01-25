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
