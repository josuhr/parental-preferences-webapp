# Phase 1: Platform Foundation - Deployment Guide

## What's New in Phase 1

Phase 1 establishes the foundation for a multi-app platform by introducing:
- **App Registry System**: Database tables to manage multiple apps
- **Unified Platform Navigation**: Consistent navigation across all pages
- **User Type Classification**: Distinguish between parents, teachers, and admins
- **App Access Control**: Fine-grained permissions for which users can access which apps

## Files Created

1. **`database-phase1.sql`** - Database schema for app registry and access control
2. **`platform-nav.html`** - Reusable navigation component for all pages
3. **`PHASE1_DEPLOYMENT.md`** - This deployment guide

## Files Modified

1. **`index.html`** - Added platform navigation
2. **`dashboard.html`** - Added platform navigation
3. **`admin.html`** - Added platform navigation

## Deployment Steps

### Step 1: Update Database Schema

Run the SQL in `database-phase1.sql` in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Click "New query"
3. Copy the entire contents of `database-phase1.sql`
4. Click "Run"
5. Verify:
   - New tables: `apps`, `user_app_access`
   - New column in `users`: `user_type`
   - All existing users should have `user_type = 'parent'`

**Check it worked:**
```sql
-- Should show 3 apps
SELECT * FROM public.apps;

-- Should show all users have access to 'parental-prefs' app
SELECT COUNT(*) FROM public.user_app_access;
```

### Step 2: Deploy to Netlify

The updated files will be automatically deployed via Git:

1. Commit changes:
   ```bash
   git add .
   git commit -m "Phase 1: Add platform foundation with app registry and unified navigation"
   git push origin main
   ```

2. Wait for Netlify to deploy (~1-2 minutes)

### Step 3: Test Platform Navigation

1. **Visit your site** and sign in
2. **Check for platform navigation** at the top:
   - Should see "Parent Support Platform" branding
   - App switcher showing available apps
   - User menu with your name

3. **Test app switcher**:
   - Click "Apps" button
   - Should see "Parental Preferences" (active)
   - Should see "Kid Preferences" (Coming Soon)
   - Should see "Teacher Tools" (Coming Soon)

4. **Test user menu**:
   - Click your name
   - Should see Dashboard, Admin Panel (if admin), Sign Out

5. **Navigate between pages**:
   - Go to Dashboard → should see platform nav
   - Go to Admin Panel → should see platform nav
   - Go to main app (index.html) → should see platform nav

### Step 4: Verify App Access

Check that all existing users have access to the Parental Preferences app:

```sql
-- Should show all users
SELECT u.email, u.user_type, a.name as app_name, uaa.role
FROM public.users u
JOIN public.user_app_access uaa ON u.id = uaa.user_id
JOIN public.apps a ON uaa.app_id = a.id;
```

## What Users Will See

### Changes for Existing Users
- New platform navigation bar at the top of every page
- "Apps" menu showing current app and upcoming apps (marked "Coming Soon")
- Cleaner, more professional look
- No breaking changes - everything still works as before

### For Admins
- Can see all three apps in the registry (via database)
- Can manage user app access if needed
- Platform nav shows admin badge/icon

## Troubleshooting

### Issue: Platform Nav Not Showing

**Symptoms:** Navigation bar doesn't appear at top of pages

**Solutions:**
1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Check browser console for errors
3. Verify `platform-nav.html` exists and is accessible
4. Check that Supabase is initialized before platform nav loads

### Issue: "Apps" Menu Empty

**Symptoms:** Click "Apps" button but menu is empty

**Solutions:**
1. Check browser console for errors
2. Verify `apps` and `user_app_access` tables exist in Supabase
3. Run this SQL to grant access:
   ```sql
   INSERT INTO public.user_app_access (user_id, app_id, role)
   SELECT u.id, a.id, 'user'
   FROM public.users u
   CROSS JOIN public.apps a
   WHERE a.slug = 'parental-prefs'
   ON CONFLICT (user_id, app_id) DO NOTHING;
   ```

### Issue: User Type Not Set

**Symptoms:** Users don't have `user_type` field

**Solutions:**
```sql
-- Set all existing users to 'parent'
UPDATE public.users 
SET user_type = 'parent' 
WHERE user_type IS NULL;
```

## Next Steps

Phase 1 is complete! This foundation enables:
- **Phase 2**: Built-in Preferences Manager (no more Google Sheets dependency)
- **Phase 4**: Kid Preferences Tracking (new app)
- **Phase 5**: Teacher Access & Collaboration (new app + roles)
- **Phase 3**: Recommendations Engine (cross-app feature)

## Rollback Plan

If issues occur, you can rollback by:

1. **Remove platform nav from pages** (revert to previous commit)
2. **Database**: The new tables don't affect existing functionality
   - Can leave them in place
   - Or drop them: `DROP TABLE user_app_access CASCADE; DROP TABLE apps CASCADE;`

## Success Criteria

Phase 1 is successfully deployed when:
- ✅ All users can see platform navigation on every page
- ✅ App switcher shows "Parental Preferences" as active
- ✅ User menu works correctly
- ✅ No errors in browser console
- ✅ All existing functionality (Google Sheets, preferences, etc.) still works
- ✅ Navigation between pages is smooth
