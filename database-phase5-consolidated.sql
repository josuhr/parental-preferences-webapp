-- Phase 5: Complete Schema Setup (Consolidated)
-- This script can be run multiple times safely

-- ============================================================================
-- Drop existing policies first to avoid conflicts
-- ============================================================================

-- Kid Access Permissions policies
DROP POLICY IF EXISTS "Parents can view permissions for own kids" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can create permissions for own kids" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can update permissions for own kids" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Teachers can view own permissions" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Teachers can view own access permissions" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can view permissions they granted" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can create access permissions" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can update permissions they granted" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can delete permissions they granted" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Teachers can view accessible kids" ON public.kids;
DROP POLICY IF EXISTS "Teachers can view accessible kids basic info" ON public.kids;

-- ============================================================================
-- Create Tables (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kid_access_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    granted_by UUID REFERENCES public.users(id) NOT NULL,
    access_level TEXT CHECK (access_level IN ('view', 'comment', 'full')) DEFAULT 'view',
    status TEXT CHECK (status IN ('pending', 'approved', 'denied', 'revoked')) DEFAULT 'pending',
    granted_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kid_id, teacher_id)
);

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

CREATE TABLE IF NOT EXISTS public.perspective_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES public.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    age_range TEXT,
    duration_minutes INTEGER,
    materials_needed TEXT,
    instructions TEXT,
    learning_goals TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.perspective_activity_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES public.perspective_activities(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    session_date DATE DEFAULT CURRENT_DATE,
    participant_count INTEGER,
    notes TEXT,
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.parent_teacher_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) NOT NULL,
    recipient_id UUID REFERENCES public.users(id) NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    parent_id UUID REFERENCES public.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Enable RLS
-- ============================================================================

ALTER TABLE public.kid_access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perspective_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perspective_activity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_teacher_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create Validation Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_kid_access_permission()
RETURNS TRIGGER AS $$
BEGIN
    -- Verify that the user granting access actually owns the kid
    IF NOT EXISTS (
        SELECT 1 FROM public.kids 
        WHERE id = NEW.kid_id 
        AND parent_id = NEW.granted_by
    ) THEN
        RAISE EXCEPTION 'You can only grant access to your own kids';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS validate_kid_access_permission_trigger ON public.kid_access_permissions;
CREATE TRIGGER validate_kid_access_permission_trigger
    BEFORE INSERT OR UPDATE ON public.kid_access_permissions
    FOR EACH ROW
    EXECUTE FUNCTION validate_kid_access_permission();

-- ============================================================================
-- RLS Policies - Kid Access Permissions
-- ============================================================================

-- Parents can view permissions they granted
CREATE POLICY "Parents can view permissions they granted"
    ON public.kid_access_permissions FOR SELECT
    TO authenticated
    USING (granted_by = auth.uid());

-- Teachers can view their own access permissions
CREATE POLICY "Teachers can view own access permissions"
    ON public.kid_access_permissions FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

-- Parents can create permissions
CREATE POLICY "Parents can create access permissions"
    ON public.kid_access_permissions FOR INSERT
    TO authenticated
    WITH CHECK (granted_by = auth.uid());

-- Parents can update permissions they granted
CREATE POLICY "Parents can update permissions they granted"
    ON public.kid_access_permissions FOR UPDATE
    TO authenticated
    USING (granted_by = auth.uid());

-- Parents can delete permissions they granted
CREATE POLICY "Parents can delete permissions they granted"
    ON public.kid_access_permissions FOR DELETE
    TO authenticated
    USING (granted_by = auth.uid());

-- ============================================================================
-- RLS Policies - Kids Table (Teacher Access)
-- ============================================================================

-- Teachers can view kids they have approved access to
CREATE POLICY "Teachers can view accessible kids"
    ON public.kids FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT kid_id FROM public.kid_access_permissions
            WHERE teacher_id = auth.uid() AND status = 'approved'
        )
    );

-- ============================================================================
-- RLS Policies - Teacher Observations
-- ============================================================================

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

CREATE POLICY "Teachers can view own observations"
    ON public.teacher_observations FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Parents can view observations for own kids"
    ON public.teacher_observations FOR SELECT
    TO authenticated
    USING (
        kid_id IN (SELECT id FROM public.kids WHERE parent_id = auth.uid()) AND
        is_visible_to_parent = true
    );

CREATE POLICY "Teachers can update own observations"
    ON public.teacher_observations FOR UPDATE
    TO authenticated
    USING (teacher_id = auth.uid());

-- ============================================================================
-- RLS Policies - Perspective Activities
-- ============================================================================

CREATE POLICY "Teachers can create perspective activities"
    ON public.perspective_activities FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Teachers can view own activities"
    ON public.perspective_activities FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Teachers can view public activities"
    ON public.perspective_activities FOR SELECT
    TO authenticated
    USING (is_public = true);

CREATE POLICY "Teachers can update own activities"
    ON public.perspective_activities FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- ============================================================================
-- RLS Policies - Perspective Activity Sessions
-- ============================================================================

CREATE POLICY "Teachers can manage own sessions"
    ON public.perspective_activity_sessions
    TO authenticated
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

-- ============================================================================
-- RLS Policies - Parent Teacher Messages
-- ============================================================================

CREATE POLICY "Parents can view messages about own kids"
    ON public.parent_teacher_messages FOR SELECT
    TO authenticated
    USING (
        parent_id = auth.uid() OR
        sender_id = auth.uid() OR
        recipient_id = auth.uid()
    );

CREATE POLICY "Teachers can view own messages"
    ON public.parent_teacher_messages FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send messages"
    ON public.parent_teacher_messages FOR INSERT
    TO authenticated
    WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Recipients can update read status"
    ON public.parent_teacher_messages FOR UPDATE
    TO authenticated
    USING (recipient_id = auth.uid());

-- ============================================================================
-- RLS Policies - Kid Preferences (Teacher Access)
-- ============================================================================

DROP POLICY IF EXISTS "Teachers can view preferences for accessible kids" ON public.kid_preferences;

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
-- RLS Policies - Kid Activities (Teacher Access)
-- ============================================================================

DROP POLICY IF EXISTS "Teachers can view activities for accessible kids" ON public.kid_activities;

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
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kid_access_permissions_kid_id ON public.kid_access_permissions(kid_id);
CREATE INDEX IF NOT EXISTS idx_kid_access_permissions_teacher_id ON public.kid_access_permissions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_kid_access_permissions_status ON public.kid_access_permissions(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_teacher_observations_kid_id ON public.teacher_observations(kid_id);
CREATE INDEX IF NOT EXISTS idx_teacher_observations_teacher_id ON public.teacher_observations(teacher_id);
CREATE INDEX IF NOT EXISTS idx_perspective_activities_created_by ON public.perspective_activities(created_by);
CREATE INDEX IF NOT EXISTS idx_perspective_activities_public ON public.perspective_activities(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_parent_teacher_messages_kid_id ON public.parent_teacher_messages(kid_id);
CREATE INDEX IF NOT EXISTS idx_parent_teacher_messages_recipient ON public.parent_teacher_messages(recipient_id, is_read);

-- ============================================================================
-- Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_kid_access_permissions_updated_at ON public.kid_access_permissions;
CREATE TRIGGER update_kid_access_permissions_updated_at
    BEFORE UPDATE ON public.kid_access_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_teacher_observations_updated_at ON public.teacher_observations;
CREATE TRIGGER update_teacher_observations_updated_at
    BEFORE UPDATE ON public.teacher_observations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_perspective_activities_updated_at ON public.perspective_activities;
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

DROP VIEW IF EXISTS public.teacher_accessible_kids;

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
