-- ============================================================================
-- Diagnostic: Check Teacher Access to Kid Data
-- ============================================================================
-- Run this in Supabase SQL Editor to diagnose the issue
-- Replace 'teacher@example.com' with the actual teacher email

-- Step 1: Check what RLS policies exist on the relevant tables
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive,
    cmd
FROM pg_policies
WHERE tablename IN ('kids', 'kid_activity_categories', 'kid_activities', 'kid_preferences')
ORDER BY tablename, policyname;

-- Step 2: Check if the teacher has approved access
-- Replace the email below with your teacher's email
SELECT 
    u.email as teacher_email,
    k.name as kid_name,
    kap.access_level,
    kap.status,
    kap.granted_at
FROM users u
JOIN kid_access_permissions kap ON u.id = kap.teacher_id
JOIN kids k ON kap.kid_id = k.id
WHERE kap.status = 'approved';

-- Step 3: Check if universal categories exist
SELECT id, name, icon, parent_id 
FROM kid_activity_categories 
WHERE parent_id IS NULL
ORDER BY sort_order;

-- Step 4: Count activities in universal categories
SELECT 
    kac.name as category,
    COUNT(ka.id) as activity_count
FROM kid_activity_categories kac
LEFT JOIN kid_activities ka ON ka.category_id = kac.id
WHERE kac.parent_id IS NULL
GROUP BY kac.id, kac.name
ORDER BY kac.sort_order;

-- Step 5: Check if the kid has any preferences set
-- Replace 'kid-uuid-here' with an actual kid ID, or remove the WHERE clause
SELECT 
    k.name as kid_name,
    COUNT(kp.id) as preference_count
FROM kids k
LEFT JOIN kid_preferences kp ON kp.kid_id = k.id
GROUP BY k.id, k.name;
