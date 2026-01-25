-- Fix: Teacher Access Permission Not Created During Invitation
-- The insert failed because RLS doesn't allow teachers to create their own access

-- ============================================================================
-- Step 1: Fix RLS Policy on kid_access_permissions
-- ============================================================================

-- The problem: Teachers can't INSERT into kid_access_permissions
-- Only parents should be able to grant access
-- But during invitation acceptance, we need to allow the insert

-- Check existing INSERT policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'kid_access_permissions' AND cmd = 'INSERT';

-- Drop restrictive policy
DROP POLICY IF EXISTS "Parents can create permissions" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can grant access to their kids" ON public.kid_access_permissions;

-- Create new policy that allows:
-- 1. Parents to grant access (granted_by = auth.uid())
-- 2. System to create access during invitation acceptance
CREATE POLICY "Allow access permission creation"
    ON public.kid_access_permissions FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Parent granting access
        granted_by = auth.uid()
        OR
        -- Or, teacher accepting invitation (granted_by is the parent who invited them)
        (teacher_id = auth.uid() AND granted_by IS NOT NULL)
    );

-- ============================================================================
-- Step 2: Manually Create Missing Access Permission
-- ============================================================================

-- Find the teacher user
SELECT id, email, display_name, user_type
FROM users
WHERE email = 'josuhr@cisco.com' AND user_type = 'teacher';

-- Find the invitation
SELECT id, kid_id, invited_by, access_level, email
FROM teacher_invitations
WHERE email = 'josuhr@cisco.com' 
  AND status = 'accepted'
ORDER BY created_at DESC
LIMIT 1;

-- Create the access permission manually
-- Replace these UUIDs with actual values from queries above:
INSERT INTO kid_access_permissions (
    kid_id,
    teacher_id,
    granted_by,
    access_level,
    status,
    granted_at
)
SELECT 
    ti.kid_id,
    u.id as teacher_id,
    ti.invited_by as granted_by,
    ti.access_level,
    'approved' as status,
    NOW() as granted_at
FROM teacher_invitations ti
JOIN users u ON u.email = ti.email
WHERE ti.email = 'josuhr@cisco.com'
  AND ti.status = 'accepted'
  AND u.user_type = 'teacher'
  AND NOT EXISTS (
      -- Don't create duplicate
      SELECT 1 FROM kid_access_permissions kap
      WHERE kap.teacher_id = u.id AND kap.kid_id = ti.kid_id
  )
ORDER BY ti.created_at DESC
LIMIT 1;

-- Verify it was created
SELECT 
    u.email as teacher_email,
    k.name as kid_name,
    kap.access_level,
    kap.status,
    kap.granted_at
FROM users u
JOIN kid_access_permissions kap ON u.id = kap.teacher_id
JOIN kids k ON kap.kid_id = k.id
WHERE u.email = 'josuhr@cisco.com';
