# Phase 2 Deployment Guide: Built-in Preferences Manager

This guide will help you deploy Phase 2, which adds native preferences management to replace Google Sheets dependency.

## 📋 Overview

Phase 2 introduces:
- Native preference management system
- Category and activity CRUD operations
- Data source switcher (Google Sheets OR Built-in)
- Drag-and-drop friendly interface
- Full integration with existing app

## 🚀 Deployment Steps

### Step 1: Update Database Schema

1. **Log in to Supabase Dashboard**
   - Go to https://supabase.com
   - Select your project

2. **Run Phase 2 SQL Script**
   - Navigate to: **SQL Editor** (left sidebar)
   - Click **New query**
   - Copy the entire contents of `database-phase2.sql`
   - Paste into the SQL editor
   - Click **Run** (or press Cmd/Ctrl + Enter)
   - Wait for "Success. No rows returned" message

3. **Verify Tables Created**
   - Navigate to: **Table Editor** (left sidebar)
   - You should see three new tables:
     - `activity_categories`
     - `activities`
     - `parent_preferences`
   - Click on each table to verify the structure

### Step 2: Deploy Code to Netlify

The code has already been committed and pushed to GitHub, which will trigger an automatic deployment to Netlify.

1. **Monitor Deployment**
   - Go to your Netlify dashboard
   - Wait for the deployment to complete (usually 1-2 minutes)
   - Look for "Published" status with a green checkmark

2. **Verify Deployment**
   - Check the deployment log for any errors
   - Note the deployment URL

### Step 3: Test the New Features

#### Test 1: Access Preferences Manager

1. **Log in to your app**
   - Visit your Netlify URL
   - Sign in with Google OAuth

2. **Navigate to Preferences Manager**
   - From the dashboard, click **"✏️ Manage Preferences"** in Quick Actions
   - OR use the Apps menu in the top navigation
   - You should see the Preferences Manager page

#### Test 2: Create a Category

1. **Click "➕ Add Category"**
2. **Fill in the form:**
   - Category Name: "Indoor Activities"
   - Icon: Choose 🏠
3. **Click "Save Category"**
4. **Verify:**
   - Category appears on the page
   - No errors in console

#### Test 3: Add an Activity

1. **In your new category, click "➕ Add Activity"**
2. **Fill in the form:**
   - Activity Name: "Reading Books"
   - Description: "Reading stories together"
   - Who likes this: Select "💜 Both"
3. **Click "Save Activity"**
4. **Verify:**
   - Activity appears in the category
   - Preference is set correctly

#### Test 4: Switch Data Sources

1. **Go to the main activity view** (click "View Activities" or go to `/index.html`)
2. **You should see a "Data Source" switcher** at the top
3. **Test Google Sheets mode:**
   - Select "Google Sheets" radio button
   - Click "🔄 Refresh Data"
   - Your Google Sheets data should load (if configured)
4. **Test Built-in mode:**
   - Select "Built-in Preferences" radio button
   - Your newly created activities should appear
   - Notice the "✏️ Manage Preferences" button appears

#### Test 5: Edit and Delete

1. **Go back to Preferences Manager**
2. **Test editing:**
   - Click ✏️ (edit) icon on an activity
   - Change the name or preference
   - Save and verify changes
3. **Test deleting:**
   - Click 🗑️ (delete) icon on an activity
   - Confirm deletion
   - Verify activity is removed

### Step 4: Verify Row Level Security (RLS)

RLS ensures users can only see and manage their own data.

1. **Test with a second account** (if available):
   - Sign in with a different Google account
   - Create some categories and activities
   - Sign out and sign back in with your first account
   - Verify you ONLY see your own data (not the other user's)

2. **Check in Supabase**:
   - Go to Supabase → Table Editor
   - View the `activity_categories` table
   - You should see data from multiple users (if you tested with multiple accounts)
   - Each row should have a different `user_id`

## 🐛 Troubleshooting

### Issue: "Failed to create user record" or Similar Database Errors

**Possible Causes:**
- Phase 2 SQL script didn't run successfully
- RLS policies are blocking operations

**Solution:**
1. Go to Supabase → SQL Editor
2. Run this query to check if tables exist:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('activity_categories', 'activities', 'parent_preferences');
   ```
3. If no results, re-run the Phase 2 SQL script
4. Check RLS policies:
   ```sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE tablename IN ('activity_categories', 'activities', 'parent_preferences');
   ```

### Issue: "Cannot read properties of undefined" in Console

**Possible Causes:**
- JavaScript files didn't load correctly
- Old cached files

**Solution:**
1. Hard refresh: Cmd/Ctrl + Shift + R
2. Clear browser cache
3. Check browser console for 404 errors on JavaScript files

### Issue: Data Source Switcher Not Working

**Possible Causes:**
- Event listeners not attached
- DOM elements not found

**Solution:**
1. Check browser console for errors
2. Verify `script.js` loaded correctly
3. Try hard refresh (Cmd/Ctrl + Shift + R)

### Issue: "No Preferences Yet" Message Persists

**Possible Causes:**
- User doesn't have any categories created
- Database query failed silently

**Solution:**
1. Create a category using the "Create First Category" button
2. Check browser console for error messages
3. Verify user is authenticated (check network tab for 401/403 errors)

## ✅ Success Criteria

Phase 2 is successfully deployed when:

- ✅ All three new database tables exist in Supabase
- ✅ RLS policies are active on all new tables
- ✅ Preferences Manager page loads without errors
- ✅ You can create, edit, and delete categories
- ✅ You can create, edit, and delete activities
- ✅ Preference levels (Both, Mom, Dad, Neither) work correctly
- ✅ Data source switcher appears on main activity page
- ✅ Switching to "Built-in Preferences" shows your data
- ✅ Switching to "Google Sheets" shows your sheets data (if configured)
- ✅ Multiple users can have their own separate data (RLS working)
- ✅ Dashboard has "Manage Preferences" link in Quick Actions
- ✅ No console errors when using the app

## 📝 What's Next?

After successful Phase 2 deployment, you can:

1. **Start using built-in preferences** instead of Google Sheets
2. **Migrate your existing Google Sheets data** (manually for now, import feature coming later)
3. **Share feedback** on the new preferences manager
4. **Prepare for Phase 4**: Kid Preferences Tracking (skipping Phase 3 for now per priority order)

## 📚 Files Created in Phase 2

- `database-phase2.sql` - Database schema for preferences
- `preferences-manager.html` - UI for managing preferences
- `preferences-manager.js` - Logic for preferences CRUD operations
- `PHASE2_DEPLOYMENT.md` - This deployment guide

## 📚 Files Modified in Phase 2

- `index.html` - Added data source switcher
- `script.js` - Added built-in preferences loading logic
- `dashboard.html` - Added "Manage Preferences" quick action link

## 🔄 Rollback Plan

If Phase 2 causes issues:

1. **Rollback Code:**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Rollback Database (if needed):**
   - The new tables don't affect existing functionality
   - You can leave them in place
   - Or manually drop them:
     ```sql
     DROP TABLE IF EXISTS public.parent_preferences CASCADE;
     DROP TABLE IF EXISTS public.activities CASCADE;
     DROP TABLE IF EXISTS public.activity_categories CASCADE;
     ```

3. **Clear Browser Cache:**
   - Users should hard refresh to get old code

---

**Need Help?** Check the browser console for error messages and include them when asking for assistance.
