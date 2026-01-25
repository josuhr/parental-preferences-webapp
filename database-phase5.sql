-- Phase 5: Teacher Access & Collaboration
-- This schema adds teacher access control and collaboration features

-- ============================================================================
-- Kid Access Permissions Table
-- ============================================================================
-- Controls which teachers can access which kids' data

CREATE TABLE IF NOT EXISTS public.kid_access_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    granted_by UUID REFERENCES public.users(id) NOT NULL, -- The parent who granted access
    access_level TEXT CHECK (access_level IN ('view', 'comment', 'full')) DEFAULT 'view',
    status TEXT CHECK (status IN ('pending', 'approved', 'denied', 'revoked')) DEFAULT 'pending',
    granted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date
    notes TEXT, -- Why access is being granted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kid_id, teacher_id)
);

-- ============================================================================
-- Teacher Observations Table
-- ============================================================================
-- Teachers can record observations about kids' preferences/behaviors

CREATE TABLE IF NOT EXISTS public.teacher_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    activity_id UUID REFERENCES public.kid_activities(id) ON DELETE SET NULL,
    observation_type TEXT CHECK (observation_type IN ('preference', 'behavior', 'growth', 'challenge', 'success')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    observed_date DATE DEFAULT CURRENT_DATE,
    is_visible_to_parent BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Perspective Taking Activities Table
-- ============================================================================
-- Classroom activities designed to teach perspective-taking skills

CREATE TABLE IF NOT EXISTS public.perspective_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES public.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    age_range TEXT, -- e.g., "5-7 years"
    duration_minutes INTEGER,
    materials_needed TEXT,
    instructions TEXT,
    learning_goals TEXT,
    is_public BOOLEAN DEFAULT false, -- Can other teachers see this?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Perspective Activity Sessions Table
-- ============================================================================
-- Track when teachers use perspective activities with kids

CREATE TABLE IF NOT EXISTS public.perspective_activity_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES public.perspective_activities(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_date DATE DEFAULT CURRENT_DATE,
    participant_count INTEGER,
    notes TEXT, -- How it went, observations
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Parent Teacher Messages Table
-- ============================================================================
-- Communication between parents and teachers about kids

CREATE TABLE IF NOT EXISTS public.parent_teacher_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) NOT NULL,
    recipient_id UUID REFERENCES public.users(id) NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    parent_id UUID REFERENCES public.users(id) NOT NULL, -- The parent who owns the kid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.kid_access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perspective_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perspective_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_teacher_messages ENABLE ROW LEVEL SECURITY;

-- Kid Access Permissions Policies
-- Parents can view/manage permissions for their kids
CREATE POLICY "Parents can view permissions for own kids"
    ON public.kid_access_permissions FOR SELECT
    TO authenticated
    USING (
        granted_by = auth.uid() OR
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid())
    );

CREATE POLICY "Parents can create permissions for own kids"
    ON public.kid_access_permissions FOR INSERT
    TO authenticated
    WITH CHECK (
        granted_by = auth.uid() AND
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid())
    );

CREATE POLICY "Parents can update permissions for own kids"
    ON public.kid_access_permissions FOR UPDATE
    TO authenticated
    USING (
        granted_by = auth.uid() OR
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid())
    );

-- Teachers can view their own access permissions
CREATE POLICY "Teachers can view own permissions"
    ON public.kid_access_permissions FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

-- Teacher Observations Policies
-- Teachers can create observations for kids they have access to
CREATE POLICY "Teachers can create observations for accessible kids"
    ON public.teacher_observations FOR INSERT
    TO authenticated
    WITH CHECK (
        teacher_id = auth.uid() AND
        kid_id IN (
            SELECT kid_id FROM public.kid_access_permissions
            WHERE teacher_id = auth.uid() AND status = 'approved'
        )
    );

-- Teachers can view their own observations
CREATE POLICY "Teachers can view own observations"
    ON public.teacher_observations FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

-- Parents can view observations about their kids
CREATE POLICY "Parents can view observations for own kids"
    ON public.teacher_observations FOR SELECT
    TO authenticated
    USING (
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid()) AND
        is_visible_to_parent = true
    );

-- Teachers can update their own observations
CREATE POLICY "Teachers can update own observations"
    ON public.teacher_observations FOR UPDATE
    TO authenticated
    USING (teacher_id = auth.uid());

-- Perspective Activities Policies
-- Teachers can create activities
CREATE POLICY "Teachers can create perspective activities"
    ON public.perspective_activities FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Teachers can view their own activities
CREATE POLICY "Teachers can view own activities"
    ON public.perspective_activities FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

-- Teachers can view public activities
CREATE POLICY "Teachers can view public activities"
    ON public.perspective_activities FOR SELECT
    TO authenticated
    USING (is_public = true);

-- Teachers can update their own activities
CREATE POLICY "Teachers can update own activities"
    ON public.perspective_activities FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- Perspective Activity Sessions Policies
CREATE POLICY "Teachers can manage own sessions"
    ON public.perspective_activity_sessions
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

-- Parent Teacher Messages Policies
-- Parents can view messages about their kids
CREATE POLICY "Parents can view messages about own kids"
    ON public.parent_teacher_messages FOR SELECT
    TO authenticated
    USING (
        parent_id = auth.uid() OR
        sender_id = auth.uid() OR
        recipient_id = auth.uid()
    );

-- Teachers can view messages they sent or received
CREATE POLICY "Teachers can view own messages"
    ON public.parent_teacher_messages FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Users can send messages
CREATE POLICY "Users can send messages"
    ON public.parent_teacher_messages FOR INSERT
    TO authenticated
    WITH CHECK (sender_id = auth.uid());

-- Users can mark messages as read
CREATE POLICY "Recipients can update read status"
    ON public.parent_teacher_messages FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid());

-- ============================================================================
-- Update Kids Table RLS for Teacher Access
-- ============================================================================
-- Teachers need to see basic kid info for kids they have access to

-- Add policy for teachers to view kids they have access to
CREATE POLICY "Teachers can view accessible kids basic info"
    ON public.kids FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT kid_id FROM public.kid_access_permissions
            WHERE teacher_id = auth.uid() AND status = 'approved'
        )
    );

-- ============================================================================
-- Update Kid Preferences RLS for Teacher Access
-- ============================================================================
-- Teachers need to see preferences for kids they have access to

CREATE POLICY "Teachers can view preferences for accessible kids"
    ON public.kid_preferences FOR SELECT
    TO authenticated
    USING (
        kid_id IN (
            SELECT kid_id FROM public.kid_access_permissions
            WHERE teacher_id = auth.uid() AND status = 'approved'
        )
    );

-- ============================================================================
-- Update Kid Activities RLS for Teacher Access
-- ============================================================================

CREATE POLICY "Teachers can view activities for accessible kids"
    ON public.kid_activities FOR SELECT
    TO authenticated
    USING (
        category_id IN (
            SELECT kac.id FROM public.kid_activity_categories kac
            WHERE EXISTS (
                SELECT 1 FROM public.kids k
                INNER JOIN public.kid_access_permissions kap ON k.id = kap.kid_id
                WHERE k.parent_id = kac.parent_id
                  AND kap.teacher_id = auth.uid()
                  AND kap.status = 'approved'
            )
        )
    );

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kid_access_permissions_kid_id 
    ON public.kid_access_permissions(kid_id);

CREATE INDEX IF NOT EXISTS idx_kid_access_permissions_teacher_id 
    ON public.kid_access_permissions(teacher_id);

CREATE INDEX IF NOT EXISTS idx_kid_access_permissions_status 
    ON public.kid_access_permissions(teacher_id, status);

CREATE INDEX IF NOT EXISTS idx_teacher_observations_kid_id 
    ON public.teacher_observations(kid_id);

CREATE INDEX IF NOT EXISTS idx_teacher_observations_teacher_id 
    ON public.teacher_observations(teacher_id);

CREATE INDEX IF NOT EXISTS idx_perspective_activities_created_by 
    ON public.perspective_activities(created_by);

CREATE INDEX IF NOT EXISTS idx_perspective_activities_public 
    ON public.perspective_activities(is_public) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_parent_teacher_messages_kid_id 
    ON public.parent_teacher_messages(kid_id);

CREATE INDEX IF NOT EXISTS idx_parent_teacher_messages_recipient 
    ON public.parent_teacher_messages(recipient_id, is_read);

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

CREATE TRIGGER update_kid_access_permissions_updated_at
    BEFORE UPDATE ON public.kid_access_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teacher_observations_updated_at
    BEFORE UPDATE ON public.teacher_observations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perspective_activities_updated_at
    BEFORE UPDATE ON public.perspective_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT ALL ON public.kid_access_permissions TO authenticated;
GRANT ALL ON public.teacher_observations TO authenticated;
GRANT ALL ON public.perspective_activities TO authenticated;
GRANT ALL ON public.perspective_activity_sessions TO authenticated;
GRANT ALL ON public.parent_teacher_messages TO authenticated;

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View for teachers to see their accessible kids with stats
CREATE OR REPLACE VIEW public.teacher_accessible_kids AS
SELECT 
    k.*,
    kap.access_level,
    kap.granted_at,
    kap.expires_at,
    u.display_name AS parent_name,
    u.email AS parent_email,
    COUNT(DISTINCT kp.id) AS total_preferences,
    COUNT(DISTINCT CASE WHEN kp.preference_level = 'loves' THEN kp.id END) AS loves_count
FROM public.kids k
INNER JOIN public.kid_access_permissions kap ON k.id = kap.kid_id
INNER JOIN public.users u ON k.parent_id = u.id
LEFT JOIN public.kid_preferences kp ON k.id = kp.kid_id
WHERE kap.status = 'approved'
GROUP BY k.id, kap.access_level, kap.granted_at, kap.expires_at, u.display_name, u.email;

GRANT SELECT ON public.teacher_accessible_kids TO authenticated;

-- Note: Views inherit RLS from underlying tables (kids, kid_access_permissions, etc.)
-- No need to add policies directly on the view
