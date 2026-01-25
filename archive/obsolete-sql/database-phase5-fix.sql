-- Phase 5 Fix: Resolve infinite recursion in RLS policies
-- The issue: kids table policy references kid_access_permissions, which references kids (circular)

-- ============================================================================
-- Step 1: Drop the problematic policies
-- ============================================================================

-- Drop the teacher access policy that causes recursion
DROP POLICY IF EXISTS "Teachers can view accessible kids basic info" ON public.kids;

-- Drop the existing kid_access_permissions policies that reference kids table
DROP POLICY IF EXISTS "Parents can view permissions for own kids" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can create permissions for own kids" ON public.kid_access_permissions;
DROP POLICY IF EXISTS "Parents can update permissions for own kids" ON public.kid_access_permissions;

-- ============================================================================
-- Step 2: Recreate kid_access_permissions policies WITHOUT circular reference
-- ============================================================================

-- Parents can view permissions they granted (using granted_by, not kids table)
CREATE POLICY "Parents can view permissions they granted"
    ON public.kid_access_permissions FOR SELECT
    TO authenticated
    USING (granted_by = auth.uid());

-- Teachers can view their own access permissions
CREATE POLICY "Teachers can view own access permissions"
    ON public.kid_access_permissions FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

-- Parents can create permissions (checked via granted_by matching auth.uid)
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
-- Step 3: Add kid_id validation trigger (alternative to RLS circular reference)
-- ============================================================================

-- Create a function to validate kid ownership when granting access
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

-- Apply trigger to kid_access_permissions
DROP TRIGGER IF EXISTS validate_kid_access_permission_trigger ON public.kid_access_permissions;
CREATE TRIGGER validate_kid_access_permission_trigger
    BEFORE INSERT OR UPDATE ON public.kid_access_permissions
    FOR EACH ROW
    EXECUTE FUNCTION validate_kid_access_permission();

-- ============================================================================
-- Step 4: Recreate teacher access policy for kids table (safe now)
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
-- Verification
-- ============================================================================

-- Test query (should work without recursion):
-- SELECT * FROM public.kids WHERE parent_id = auth.uid();
