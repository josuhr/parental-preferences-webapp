# Supabase Setup Instructions

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/sign in
2. Click "New Project"
3. Fill in:
   - Name: `parental-preferences`
   - Database Password: (save this securely)
   - Region: Choose closest to you
4. Click "Create new project"
5. Wait for project to be created (~2 minutes)

## Step 2: Get API Keys

1. In your Supabase project, click the **Settings** icon (⚙️ gear icon) in the left sidebar
2. Under "PROJECT SETTINGS", click **API Keys**
3. You'll see the API Keys page. Copy these values:

   **Project URL**: 
   - Look at your browser's address bar. You'll see a URL like: `https://supabase.com/dashboard/project/XXXXX/settings/api-keys`
   - The `XXXXX` part (like `npebkfflssfmhyuzewpv`) is your project reference
   - Your Project URL is: `https://XXXXX.supabase.co` (replace XXXXX with your project reference)
   - Example: If you see `npebkfflssfmhyuzewpv`, your URL is `https://npebkfflssfmhyuzewpv.supabase.co`
   - **OR** go to Settings → General and you'll see "Reference ID" - use that to build your URL
   
   **Publishable key** (this is your "anon" key):
   - Under "Publishable key" section, copy the API_KEY that starts with `sb_publishable_...`
   - This is safe to use in your browser/frontend
   
   **Secret key** (this is your "service_role" key):
   - Under "Secret keys" section, you'll see the API_KEY is hidden (`sb_secret_qcy0b•••••••••••••••`)
   - Click the **eye icon** (👁️) to reveal the full secret key
   - Copy the entire key (starts with `sb_secret_...`)
   - ⚠️ **KEEP THIS SECRET!** Never commit to git or share publicly
   
   Note: If you see a tab for "Legacy anon, service_role API keys", you can use those too - they work the same way.

## Step 3: Configure Google OAuth

1. In Supabase, go to Authentication → Providers
2. Find "Google" and toggle it ON
3. You'll need Google OAuth credentials:

### Get Google OAuth Credentials:

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Go to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure consent screen if needed
6. Application type: "Web application"
7. Add authorized redirect URI:
   ```
   https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback
   ```
8. Copy the Client ID and Client Secret
9. Paste them in Supabase Google provider settings
10. Save

## Step 4: Set Environment Variables in Netlify

1. Go to your Netlify site dashboard (https://app.netlify.com)
2. Click on your site (parental-preferences-webapp)
3. Go to **Site configuration** → **Environment variables** (or **Site settings** → **Environment variables**)
4. Click **Add a variable** (or **Add variables**)
5. Add these three variables one by one (use the keys you copied from Supabase):
   
   **Variable 1:**
   - Key: `SUPABASE_URL`
   - Value: `https://npebkfflssfmhyuzewpv.supabase.co` (your project URL)
   
   **Variable 2:**
   - Key: `SUPABASE_ANON_KEY`
   - Value: `sb_publishable_v3WM8Tjh...` (your Publishable key from Supabase)
   
   **Variable 3:**
   - Key: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: `sb_secret_qcy0b...` (your Secret key from Supabase)

6. Click **Save** after adding all variables

7. **Trigger a new deployment** so the environment variables take effect:
   - Go to the **Deploys** tab
   - Click **Trigger deploy** → **Deploy project without cache**
   - Wait for the deployment to complete (~1-2 minutes)
   
   Note: Environment variable changes require a new deployment to take effect in your live app.

## Step 5: Create Database Tables

Run the SQL from `database-schema.sql` in Supabase SQL Editor:

1. Go to SQL Editor in Supabase
2. Click "New query"
3. Copy contents from `database-schema.sql`
4. Run the query
5. Verify tables were created in Table Editor

## Step 6: Set Your Admin Account

After you first sign in with Google, run this SQL to make yourself admin:

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'your-email@gmail.com';
```

## Troubleshooting

### Issue: User Stuck on "Loading..." After Sign-In

If a new user signs in successfully but gets stuck on the dashboard showing "Loading..." or sees "Account Setup Error", their user record was not automatically created in the database.

**Symptoms:**
- User can sign in with Google OAuth
- Redirects to dashboard
- Dashboard shows "Loading..." that never completes, or shows "Account Setup Error"
- Console shows error: "User profile not found in database"

**Solution: Manually Create User Record**

1. Get the user's information:
   - Email: (they should provide this)
   - User ID: Check browser console for the error message showing the User ID
   - OR have them visit the dashboard and check the console logs

2. Run this SQL in Supabase SQL Editor:

```sql
-- First, find the user's auth ID
-- Have the user visit the site and check their browser console for "User ID: xxx"
-- OR query the auth.users table:
SELECT id, email FROM auth.users WHERE email = 'user-email@example.com';

-- Then insert the user record (replace values):
INSERT INTO public.users (id, email, display_name, google_id, role, is_active, created_at, last_login)
VALUES (
    'USER_AUTH_ID_HERE',           -- From auth.users or console
    'user-email@example.com',      -- Their actual email
    'Display Name',                -- Their name or email username
    'USER_AUTH_ID_HERE',           -- Same as id above
    'user',                        -- Role: 'user' or 'admin'
    true,                          -- Active status
    NOW(),                         -- Created timestamp
    NOW()                          -- Last login timestamp
)
ON CONFLICT (id) DO UPDATE
SET last_login = NOW();
```

3. Example with real values:

```sql
INSERT INTO public.users (id, email, display_name, google_id, role, is_active, created_at, last_login)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'laura.suhr@gmail.com',
    'Laura Suhr',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'user',
    true,
    NOW(),
    NOW()
);
```

4. After running this SQL:
   - Have the user refresh the dashboard page
   - They should now see their profile loaded correctly

### Issue: User Creation Fails During Sign-Up

If the INSERT policy is preventing automatic user creation:

1. Verify the INSERT policy exists:

```sql
-- Check existing policies on users table
SELECT * FROM pg_policies WHERE tablename = 'users';
```

2. If the INSERT policy is missing, create it:

```sql
CREATE POLICY "Allow user creation during sign-up"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
```

3. Verify RLS is enabled:

```sql
-- Check if RLS is enabled on users table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'users';
```

### Issue: Cannot Find User's Auth ID

If you need to find a user's auth ID to create their record:

1. Have the user sign in and visit the dashboard
2. Open browser console (F12 or Right-click → Inspect → Console)
3. Look for the error message that includes their User ID
4. OR run this query in Supabase SQL Editor:

```sql
-- List all auth users not in the users table
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;
```

This will show all authenticated Google users who don't have a record in the public.users table.

## Complete!

Your Supabase backend is now configured. The app will automatically connect using the environment variables.
