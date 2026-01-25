-- Parental Preferences Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    google_id TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    sheet_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    theme_color TEXT DEFAULT '#667eea',
    font_family TEXT DEFAULT 'Comic Sans MS',
    category_tabs JSONB DEFAULT '["Arts & Crafts", "Experiential", "Games", "Movies", "Music", "Reading & Ed", "Video Games"]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Allow authenticated users to read all user data (needed for admin checks and user lists)
CREATE POLICY "Authenticated users can view all users"
    ON public.users FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert their own user record during OAuth sign-up
-- This policy requires that the user's auth.uid() matches the id being inserted
-- This ensures users can only create records for themselves during sign-up
CREATE POLICY "Allow user creation during sign-up"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- User settings policies
-- Users can view their own settings
CREATE POLICY "Users can view own settings"
    ON public.user_settings FOR SELECT
    USING (
        user_id = auth.uid()
    );

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
    ON public.user_settings FOR UPDATE
    USING (user_id = auth.uid());

-- Function to automatically create user settings on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create settings for new users
CREATE TRIGGER on_user_created
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on user_settings
CREATE TRIGGER on_user_settings_updated
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.user_settings TO anon, authenticated;
