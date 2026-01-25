-- Phase 1: Platform Foundation - Database Schema
-- Run this in Supabase SQL Editor after the main database-schema.sql

-- Add user_type to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'parent' CHECK (user_type IN ('parent', 'teacher', 'admin'));

-- Apps table - Registry of all apps in the platform
CREATE TABLE IF NOT EXISTS public.apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,  -- 'parental-prefs', 'kid-prefs', etc.
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,  -- Emoji or icon name
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User app access - Controls which users can access which apps
CREATE TABLE IF NOT EXISTS public.user_app_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    app_id UUID REFERENCES public.apps(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, app_id)
);

-- Enable Row Level Security
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for apps table
-- All authenticated users can view active apps
CREATE POLICY "Authenticated users can view active apps"
    ON public.apps FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Only admins can manage apps
CREATE POLICY "Admins can manage apps"
    ON public.apps FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- RLS Policies for user_app_access table
-- Users can view their own app access
CREATE POLICY "Users can view own app access"
    ON public.user_app_access FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Admins can view all app access
CREATE POLICY "Admins can view all app access"
    ON public.user_app_access FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- Admins can manage app access
CREATE POLICY "Admins can manage app access"
    ON public.user_app_access FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- Insert default apps
INSERT INTO public.apps (slug, name, description, icon, is_active) VALUES
    ('parental-prefs', 'Parental Preferences', 'Track which activities parents love to do with their kids', '🎨', true),
    ('kid-prefs', 'Kid Preferences', 'Manage and track kids activity preferences', '👶', false),  -- Not active yet
    ('teacher-tools', 'Teacher Tools', 'Classroom planning and perspective-taking exercises', '🏫', false)  -- Not active yet
ON CONFLICT (slug) DO NOTHING;

-- Grant all existing users access to the parental-prefs app
INSERT INTO public.user_app_access (user_id, app_id, role)
SELECT u.id, a.id, 'user'
FROM public.users u
CROSS JOIN public.apps a
WHERE a.slug = 'parental-prefs'
ON CONFLICT (user_id, app_id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_apps_slug ON public.apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_is_active ON public.apps(is_active);
CREATE INDEX IF NOT EXISTS idx_user_app_access_user_id ON public.user_app_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_access_app_id ON public.user_app_access(app_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);

-- Grant permissions
GRANT ALL ON public.apps TO authenticated;
GRANT ALL ON public.user_app_access TO authenticated;
