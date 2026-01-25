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

## Complete!

Your Supabase backend is now configured. The app will automatically connect using the environment variables.
