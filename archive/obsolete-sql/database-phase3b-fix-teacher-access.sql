-- Diagnostic: Check if teacher access was created
-- Run this to see if the kid_access_permissions record exists

-- Replace 'josuhr@cisco.com' with your teacher email
SELECT 
    u.email as teacher_email,
    k.name as kid_name,
    kap.access_level,
    kap.status,
    kap.granted_at,
    kap.granted_by
FROM users u
JOIN kid_access_permissions kap ON u.id = kap.teacher_id
JOIN kids k ON kap.kid_id = k.id
WHERE u.email = 'josuhr@cisco.com';

-- If this returns results, the access was created but RLS is blocking it
-- If this returns no results, the insert failed

-- ============================================================================
-- Fix: Ensure Teachers Can Read Their Own Access Permissions
-- ============================================================================

-- The teacher dashboard needs to query kid_access_permissions
-- Make sure the policy allows teachers to see their own permissions

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'kid_access_permissions';

-- Drop and recreate the teacher access policy
DROP POLICY IF EXISTS "Teachers can view own permissions" ON public.kid_access_permissions;

CREATE POLICY "Teachers can view own permissions"
    ON public.kid_access_permissions FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

-- Also ensure teachers can view kids they have access to
DROP POLICY IF EXISTS "Teachers can view accessible kids" ON public.kids;

CREATE POLICY "Teachers can view accessible kids"
    ON public.kids FOR SELECT
    TO authenticated
    USING (
        -- Own kids
        parent_id = auth.uid()
        OR
        -- Kids they have access to
        id IN (
            SELECT kid_id 
            FROM kid_access_permissions 
            WHERE teacher_id = auth.uid() 
            AND status = 'approved'
        )
    );
