-- Diagnostic: Find ALL invitations for the teacher email
-- This will show us what invitations exist and their status

SELECT 
    id,
    email,
    kid_id,
    invited_by,
    access_level,
    status,
    created_at,
    accepted_at,
    expires_at
FROM teacher_invitations
WHERE email = 'josuhr@cisco.com'
ORDER BY created_at DESC;

-- Also check if the kid exists
SELECT 
    k.id,
    k.name,
    k.parent_id,
    u.email as parent_email
FROM kids k
JOIN users u ON k.parent_id = u.id
WHERE u.email = 'josh.suhr@mac.com';  -- Your parent account

-- ============================================================================
-- Fix: Create Missing Invitation OR Update Status
-- ============================================================================

-- If no invitation exists at all, we need to create one
-- If invitation exists but status is 'pending', we need to update it

-- Option 1: If invitation exists with status 'pending', update it to 'accepted'
UPDATE teacher_invitations
SET 
    status = 'accepted',
    accepted_at = NOW()
WHERE email = 'josuhr@cisco.com'
  AND status = 'pending';

-- Option 2: If no invitation exists, create one manually
-- First, find the parent and kid
SELECT 
    u.id as parent_id,
    k.id as kid_id,
    k.name as kid_name
FROM users u
JOIN kids k ON k.parent_id = u.id
WHERE u.email = 'josh.suhr@mac.com';  -- Your parent account

-- Then insert invitation (replace UUIDs from query above)
INSERT INTO teacher_invitations (
    invited_by,
    kid_id,
    email,
    token,
    access_level,
    status,
    expires_at,
    accepted_at
) VALUES (
    'PARENT_ID_HERE'::uuid,         -- Parent's UUID
    'KID_ID_HERE'::uuid,            -- Kid's UUID
    'josuhr@cisco.com',             -- Teacher email
    'manual-fix-token',             -- Dummy token
    'view',                         -- Access level
    'accepted',                     -- Status
    NOW() + interval '7 days',      -- Expires in 7 days
    NOW()                           -- Accepted now
);

-- ============================================================================
-- Automatic Fix: Handle Both Cases
-- ============================================================================

DO $$
DECLARE
    v_teacher_id uuid;
    v_parent_id uuid;
    v_kid_id uuid;
    v_invitation_id uuid;
    v_access_level text := 'view';
    v_app_id uuid;
BEGIN
    -- Find teacher
    SELECT id INTO v_teacher_id
    FROM users
    WHERE email = 'josuhr@cisco.com' AND user_type = 'teacher';
    
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Teacher not found with email josuhr@cisco.com';
    END IF;
    
    RAISE NOTICE 'Found teacher: %', v_teacher_id;
    
    -- Find parent and their kid
    SELECT u.id, k.id
    INTO v_parent_id, v_kid_id
    FROM users u
    JOIN kids k ON k.parent_id = u.id
    WHERE u.email = 'josh.suhr@mac.com'
    LIMIT 1;
    
    IF v_kid_id IS NULL THEN
        RAISE EXCEPTION 'No kid found for parent josh.suhr@mac.com';
    END IF;
    
    RAISE NOTICE 'Found parent % and kid %', v_parent_id, v_kid_id;
    
    -- Check if invitation exists
    SELECT id, access_level, status INTO v_invitation_id, v_access_level
    FROM teacher_invitations
    WHERE email = 'josuhr@cisco.com'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If invitation exists but not accepted, update it
    IF v_invitation_id IS NOT NULL THEN
        UPDATE teacher_invitations
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = v_invitation_id AND status != 'accepted';
        
        RAISE NOTICE 'Updated invitation: %', v_invitation_id;
    ELSE
        -- Create new invitation
        INSERT INTO teacher_invitations (
            invited_by, kid_id, email, token, access_level, status, expires_at, accepted_at
        ) VALUES (
            v_parent_id, v_kid_id, 'josuhr@cisco.com', 'manual-fix-token',
            'view', 'accepted', NOW() + interval '7 days', NOW()
        ) RETURNING id INTO v_invitation_id;
        
        RAISE NOTICE 'Created new invitation: %', v_invitation_id;
    END IF;
    
    -- Now create kid access
    INSERT INTO kid_access_permissions (
        kid_id, teacher_id, granted_by, access_level, status, granted_at
    ) VALUES (
        v_kid_id, v_teacher_id, v_parent_id, v_access_level, 'approved', NOW()
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created kid access permission';
    
    -- Grant app access
    SELECT id INTO v_app_id FROM apps WHERE slug = 'teacher-dashboard';
    
    IF v_app_id IS NULL THEN
        RAISE EXCEPTION 'Teacher dashboard app not found';
    END IF;
    
    INSERT INTO user_app_access (user_id, app_id, role)
    VALUES (v_teacher_id, v_app_id, 'user')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Success! Teacher % now has access to kid % and teacher-dashboard app', v_teacher_id, v_kid_id;
END $$;
