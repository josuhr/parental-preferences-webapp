-- Register Teacher Dashboard app in the apps registry
-- Run this in Supabase SQL Editor

INSERT INTO public.apps (slug, name, icon, description, is_active)
VALUES (
    'teacher-dashboard',
    'Teacher Dashboard',
    '🏫',
    'View kids you support and manage observations',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- Grant access to all existing users with user_type = 'teacher'
-- (If there are any teachers already in the system)
INSERT INTO public.user_app_access (user_id, app_id, role)
SELECT u.id, a.id, 'user'
FROM public.users u
CROSS JOIN public.apps a
WHERE u.user_type = 'teacher'
AND a.slug = 'teacher-dashboard'
AND NOT EXISTS (
    SELECT 1 FROM public.user_app_access uaa
    WHERE uaa.user_id = u.id AND uaa.app_id = a.id
);
