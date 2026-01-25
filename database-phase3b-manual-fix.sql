-- Direct Fix: Manually Create All Missing Records for Teacher
-- This is a step-by-step manual fix

-- ============================================================================
-- Step 1: Find Teacher User
-- ============================================================================
SELECT id, email, display_name, user_type, auth_method
FROM users
WHERE email = 'josuhr@cisco.com';

-- Copy the 'id' value from above. You'll need it below.
-- Replace 'TEACHER_USER_ID_HERE' with the actual UUID

-- ============================================================================
-- Step 2: Find the Invitation and Kid
-- ============================================================================
SELECT 
    ti.id as invitation_id,
    ti.kid_id,
    ti.invited_by as parent_id,
    ti.access_level,
    ti.email,
    k.name as kid_name
FROM teacher_invitations ti
JOIN kids k ON ti.kid_id = k.id
WHERE ti.email = 'josuhr@cisco.com'
ORDER BY ti.created_at DESC
LIMIT 1;

-- Note the kid_id, parent_id (invited_by), and access_level

-- ============================================================================
-- Step 3: Create Kid Access Permission (Replace UUIDs with actual values)
-- ============================================================================

-- IMPORTANT: Replace these placeholders with actual UUIDs from steps 1 and 2:
-- TEACHER_USER_ID: from step 1
-- KID_ID: from step 2
-- PARENT_ID: from step 2 (invited_by column)
-- ACCESS_LEVEL: from step 2 (e.g., 'view', 'comment', 'full')

INSERT INTO kid_access_permissions (
    kid_id,
    teacher_id,
    granted_by,
    access_level,
    status,
    granted_at,
    created_at
) VALUES (
    'KID_ID_HERE'::uuid,           -- Replace with actual kid_id
    'TEACHER_USER_ID_HERE'::uuid,  -- Replace with actual teacher id
    'PARENT_ID_HERE'::uuid,        -- Replace with actual parent id
    'view',                         -- Replace with actual access_level
    'approved',
    NOW(),
    NOW()
);

-- ============================================================================
-- Step 4: Grant Teacher Dashboard App Access
-- ============================================================================

-- First, get the teacher-dashboard app ID
SELECT id, slug, name FROM apps WHERE slug = 'teacher-dashboard';

-- Then grant access (Replace TEACHER_USER_ID and APP_ID)
INSERT INTO user_app_access (user_id, app_id, role)
SELECT 
    'TEACHER_USER_ID_HERE'::uuid,  -- Replace with teacher id
    id,
    'user'
FROM apps
WHERE slug = 'teacher-dashboard'
AND NOT EXISTS (
    SELECT 1 FROM user_app_access 
    WHERE user_id = 'TEACHER_USER_ID_HERE'::uuid 
    AND app_id = apps.id
);

-- ============================================================================
-- Step 5: Verify Everything Was Created
-- ============================================================================

-- Check kid access
SELECT 
    u.email,
    k.name as kid_name,
    kap.access_level,
    kap.status
FROM users u
JOIN kid_access_permissions kap ON u.id = kap.teacher_id
JOIN kids k ON kap.kid_id = k.id
WHERE u.email = 'josuhr@cisco.com';

-- Check app access
SELECT 
    u.email,
    a.name as app_name,
    a.slug
FROM users u
JOIN user_app_access uaa ON u.id = uaa.user_id
JOIN apps a ON uaa.app_id = a.id
WHERE u.email = 'josuhr@cisco.com'
AND a.slug = 'teacher-dashboard';

-- ============================================================================
-- ALTERNATIVE: Automatic Version (Try this if manual seems complex)
-- ============================================================================

-- This automatically finds all the IDs and creates the records
DO $$
DECLARE
    v_teacher_id uuid;
    v_kid_id uuid;
    v_parent_id uuid;
    v_access_level text;
    v_app_id uuid;
BEGIN
    -- Find teacher
    SELECT id INTO v_teacher_id
    FROM users
    WHERE email = 'josuhr@cisco.com' AND user_type = 'teacher';
    
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Teacher not found';
    END IF;
    
    -- Find invitation
    SELECT kid_id, invited_by, access_level
    INTO v_kid_id, v_parent_id, v_access_level
    FROM teacher_invitations
    WHERE email = 'josuhr@cisco.com'
    AND status = 'accepted'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_kid_id IS NULL THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;
    
    -- Create kid access if doesn't exist
    INSERT INTO kid_access_permissions (
        kid_id, teacher_id, granted_by, access_level, status, granted_at
    ) VALUES (
        v_kid_id, v_teacher_id, v_parent_id, v_access_level, 'approved', NOW()
    )
    ON CONFLICT DO NOTHING;
    
    -- Find app
    SELECT id INTO v_app_id FROM apps WHERE slug = 'teacher-dashboard';
    
    IF v_app_id IS NULL THEN
        RAISE EXCEPTION 'Teacher dashboard app not found';
    END IF;
    
    -- Grant app access if doesn't exist
    INSERT INTO user_app_access (user_id, app_id, role)
    VALUES (v_teacher_id, v_app_id, 'user')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Success! Created access for teacher % to kid % and app', v_teacher_id, v_kid_id;
END $$;
