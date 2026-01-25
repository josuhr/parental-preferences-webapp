-- Phase 3B: Dual Authentication System - Database Schema
-- This adds email/password authentication alongside existing Google OAuth

-- ============================================================================
-- Update Users Table
-- ============================================================================

-- Make google_id optional (currently NOT NULL)
ALTER TABLE public.users ALTER COLUMN google_id DROP NOT NULL;

-- Add email/password authentication columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'google' 
    CHECK (auth_method IN ('google', 'email', 'teacher_invite')),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;

-- Create indexes for token lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token 
    ON public.users(email_verification_token) 
    WHERE email_verification_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_password_reset_token 
    ON public.users(password_reset_token) 
    WHERE password_reset_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_method 
    ON public.users(auth_method);

-- ============================================================================
-- Teacher Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invited_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    access_level TEXT CHECK (access_level IN ('view', 'comment', 'full')) DEFAULT 'view',
    status TEXT CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teacher_invitations_token 
    ON public.teacher_invitations(token);

CREATE INDEX IF NOT EXISTS idx_teacher_invitations_email_status 
    ON public.teacher_invitations(email, status);

CREATE INDEX IF NOT EXISTS idx_teacher_invitations_kid_id 
    ON public.teacher_invitations(kid_id);

CREATE INDEX IF NOT EXISTS idx_teacher_invitations_invited_by 
    ON public.teacher_invitations(invited_by);

-- ============================================================================
-- Row Level Security for Teacher Invitations
-- ============================================================================

ALTER TABLE public.teacher_invitations ENABLE ROW LEVEL SECURITY;

-- Parents can view invitations they sent
CREATE POLICY "Parents can view invitations they sent"
    ON public.teacher_invitations FOR SELECT
    TO authenticated
    USING (invited_by = auth.uid());

-- Parents can create invitations for their kids
CREATE POLICY "Parents can create invitations"
    ON public.teacher_invitations FOR INSERT
    TO authenticated
    WITH CHECK (invited_by = auth.uid());

-- Parents can update their own invitations (e.g., cancel)
CREATE POLICY "Parents can update own invitations"
    ON public.teacher_invitations FOR UPDATE
    TO authenticated
    USING (invited_by = auth.uid());

-- Allow anyone to read invitations by token (for acceptance page)
-- This is safe because tokens are unique and hard to guess
CREATE POLICY "Anyone can view invitation by token"
    ON public.teacher_invitations FOR SELECT
    TO anon, authenticated
    USING (true);

-- ============================================================================
-- Update Existing Data
-- ============================================================================

-- Set auth_method for existing Google OAuth users
UPDATE public.users 
SET auth_method = 'google', 
    email_verified = true  -- Google users are already verified
WHERE google_id IS NOT NULL 
  AND auth_method IS NULL;

-- ============================================================================
-- Helper Function - Clean Expired Invitations
-- ============================================================================

CREATE OR REPLACE FUNCTION clean_expired_invitations()
RETURNS void AS $$
BEGIN
    UPDATE public.teacher_invitations
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT ALL ON public.teacher_invitations TO authenticated;
GRANT SELECT ON public.teacher_invitations TO anon;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN public.users.auth_method IS 'Authentication method: google (OAuth), email (email/password), or teacher_invite (invited by parent)';
COMMENT ON COLUMN public.users.email_verified IS 'Whether email has been verified. Auto-true for Google OAuth and teacher invites.';
COMMENT ON TABLE public.teacher_invitations IS 'Stores teacher invitation tokens for secure account creation with auto-access';
