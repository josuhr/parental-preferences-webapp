-- Diagnostic: Check what exists in the database

-- 1. Check all users
SELECT id, email, display_name, user_type, auth_method
FROM users
ORDER BY created_at DESC;

-- 2. Check all kids
SELECT k.id, k.name, k.age, u.email as parent_email
FROM kids k
JOIN users u ON k.parent_id = u.id
ORDER BY k.created_at DESC;

-- 3. Check all teacher invitations
SELECT 
    ti.id,
    ti.email as teacher_email,
    ti.status,
    k.name as kid_name,
    u.email as parent_email,
    ti.created_at
FROM teacher_invitations ti
LEFT JOIN kids k ON ti.kid_id = k.id
LEFT JOIN users u ON ti.invited_by = u.id
ORDER BY ti.created_at DESC;

-- 4. Check existing access permissions
SELECT 
    t.email as teacher_email,
    k.name as kid_name,
    p.email as parent_email,
    kap.access_level,
    kap.status
FROM kid_access_permissions kap
JOIN users t ON kap.teacher_id = t.id
JOIN kids k ON kap.kid_id = k.id
JOIN users p ON kap.granted_by = p.id;

-- ============================================================================
-- SOLUTION: Create a Test Kid for Parent Account
-- ============================================================================

-- First, find your parent user ID
SELECT id, email FROM users WHERE email = 'josh.suhr@mac.com';

-- Create a test kid (replace PARENT_ID with UUID from above)
INSERT INTO kids (
    parent_id,
    name,
    age,
    avatar_emoji
) VALUES (
    'PARENT_ID_HERE'::uuid,
    'Robert',  -- The kid name from your invitation email
    5,
    '👦'
)
RETURNING id, name;

-- ============================================================================
-- AUTOMATIC: Create Kid and Grant Teacher Access
-- ============================================================================

DO $$
DECLARE
    v_parent_id uuid;
    v_teacher_id uuid;
    v_kid_id uuid;
    v_app_id uuid;
BEGIN
    -- Find parent
    SELECT id INTO v_parent_id
    FROM users
    WHERE email = 'josh.suhr@mac.com';
    
    IF v_parent_id IS NULL THEN
        RAISE EXCEPTION 'Parent account not found';
    END IF;
    
    RAISE NOTICE 'Found parent: %', v_parent_id;
    
    -- Find teacher
    SELECT id INTO v_teacher_id
    FROM users
    WHERE email = 'josuhr@cisco.com' AND user_type = 'teacher';
    
    IF v_teacher_id IS NULL THEN
        RAISE EXCEPTION 'Teacher account not found';
    END IF;
    
    RAISE NOTICE 'Found teacher: %', v_teacher_id;
    
    -- Check if kid already exists
    SELECT id INTO v_kid_id
    FROM kids
    WHERE parent_id = v_parent_id
    LIMIT 1;
    
    -- If no kid exists, create one
    IF v_kid_id IS NULL THEN
        INSERT INTO kids (parent_id, name, age, avatar_emoji)
        VALUES (v_parent_id, 'Robert', 5, '👦')
        RETURNING id INTO v_kid_id;
        
        RAISE NOTICE 'Created kid: %', v_kid_id;
    ELSE
        RAISE NOTICE 'Using existing kid: %', v_kid_id;
    END IF;
    
    -- Create invitation record
    INSERT INTO teacher_invitations (
        invited_by, kid_id, email, token, access_level, status, expires_at, accepted_at
    ) VALUES (
        v_parent_id, v_kid_id, 'josuhr@cisco.com', 'manual-fix-token',
        'view', 'accepted', NOW() + interval '7 days', NOW()
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created invitation record';
    
    -- Grant kid access
    INSERT INTO kid_access_permissions (
        kid_id, teacher_id, granted_by, access_level, status, granted_at
    ) VALUES (
        v_kid_id, v_teacher_id, v_parent_id, 'view', 'approved', NOW()
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Granted kid access';
    
    -- Grant app access
    SELECT id INTO v_app_id FROM apps WHERE slug = 'teacher-dashboard';
    
    IF v_app_id IS NOT NULL THEN
        INSERT INTO user_app_access (user_id, app_id, role)
        VALUES (v_teacher_id, v_app_id, 'user')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Granted app access';
    END IF;
    
    RAISE NOTICE 'SUCCESS! Teacher % has access to kid % (Robert)', v_teacher_id, v_kid_id;
END $$;
