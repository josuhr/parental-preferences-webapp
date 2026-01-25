-- Phase 4: Update app registry and grant access to kid preferences app

-- Insert the kid preferences app
INSERT INTO public.apps (slug, name, description, icon, is_active) VALUES
    ('kid-prefs', 'Kid Preferences', 'Track and manage your kids'' activity preferences', '👶', true)
ON CONFLICT (slug) DO UPDATE SET
    is_active = true,
    description = 'Track and manage your kids'' activity preferences';

-- Grant all existing users access to the kid-prefs app
INSERT INTO public.user_app_access (user_id, app_id, role)
SELECT u.id, a.id, 'user'
FROM public.users u
CROSS JOIN public.apps a
WHERE a.slug = 'kid-prefs'
  AND NOT EXISTS (
      SELECT 1 FROM public.user_app_access uaa
      WHERE uaa.user_id = u.id AND uaa.app_id = a.id
  );
