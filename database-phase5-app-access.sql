-- Register Teacher Dashboard app in the apps registry
-- Run this in Supabase SQL Editor

INSERT INTO public.apps (app_id, name, icon, route, description, is_active)
VALUES (
    'teacher-dashboard',
    'Teacher Dashboard',
    '🏫',
    '/teacher-dashboard.html',
    'View kids you support and manage observations',
    true
)
ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    route = EXCLUDED.route,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- Grant access to all existing users with user_type = 'teacher'
-- (If there are any teachers already in the system)
INSERT INTO public.user_app_access (user_id, app_id, granted_at)
SELECT id, 'teacher-dashboard', NOW()
FROM public.users
WHERE user_type = 'teacher'
AND id NOT IN (
    SELECT user_id FROM public.user_app_access WHERE app_id = 'teacher-dashboard'
);
