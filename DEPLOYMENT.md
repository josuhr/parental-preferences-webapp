# Multi-User Deployment Guide

Congratulations! Your multi-user authentication system is now built. Follow these steps to deploy it.

## Prerequisites

- [ ] Supabase account (free tier is fine)
- [ ] Google Cloud Console account (for OAuth)
- [ ] Netlify account connected to your GitHub repo

## Step 1: Set Up Supabase (15 minutes)

### 1.1 Create Supabase Project

1. Go to https://supabase.com
2. Sign in and click "New Project"
3. Name: `parental-preferences`
4. Choose a strong database password (save it!)
5. Select your region
6. Click "Create new project" (takes ~2 minutes)

### 1.2 Create Database Tables

1. In Supabase, go to SQL Editor
2. Open the file `database-schema.sql` from your project
3. Copy all the SQL and paste into a new query
4. Click "Run" to create all tables and policies

### 1.3 Configure Google OAuth

#### Get Google OAuth Credentials:

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing one
3. Go to "APIs & Services" → "Credentials"
4. Click "CREATE CREDENTIALS" → "OAuth 2.0 Client ID"
5. If needed, configure the OAuth consent screen first:
   - User Type: External
   - App name: "Parental Preferences"
   - User support email: your email
   - Developer contact: your email
   - Save and continue through the scopes (no need to add any)
6. Back to Credentials → Create OAuth 2.0 Client ID:
   - Application type: "Web application"
   - Name: "Parental Preferences"
   - Authorized redirect URIs: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     (Replace YOUR-PROJECT-REF with your actual Supabase project reference from Settings → API)
7. Click "Create" and copy the Client ID and Client Secret

#### Configure in Supabase:

1. In Supabase, go to Authentication → Providers
2. Find "Google" in the list
3. Toggle it to "Enabled"
4. Paste your Google Client ID
5. Paste your Google Client Secret
6. Click "Save"

### 1.4 Get API Keys

1. In Supabase, go to Settings → API
2. Copy these values (you'll need them for Netlify):
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGciOi...`
   - **service_role** key: `eyJhbGciOi...` (keep this secret!)

## Step 2: Update Your Code (5 minutes)

### 2.1 Update .gitignore

Make sure `.env` and `node_modules/` are in `.gitignore` (they already are)

### 2.2 Install Function Dependencies

```bash
cd /Users/josuhr/Documents/Projects/parental-preferences/netlify/functions
npm install
cd ../..
```

## Step 3: Commit and Push to GitHub (2 minutes)

```bash
git add .
git commit -m "Add multi-user authentication system with Supabase

- Google OAuth sign-in
- User dashboard for sheet configuration
- Admin panel for user management
- Theme customization
- User-specific Google Sheets"

git push origin main
```

## Step 4: Configure Netlify (5 minutes)

### 4.1 Set Environment Variables

1. Go to your Netlify site dashboard
2. Site settings → Environment variables → Add variables
3. Add these three variables:

```
Key: SUPABASE_URL
Value: https://YOUR-PROJECT-REF.supabase.co

Key: SUPABASE_ANON_KEY
Value: [your anon public key]

Key: SUPABASE_SERVICE_ROLE_KEY
Value: [your service role key]
```

4. Click "Save"

### 4.2 Trigger Redeploy

1. Go to Deploys tab
2. Click "Trigger deploy" → "Deploy site"
3. Wait for deployment to complete (~1-2 minutes)

## Step 5: Test Your Deployment (10 minutes)

### 5.1 Test Authentication

1. Go to your Netlify URL
2. You should be redirected to `/auth.html`
3. Click "Sign in with Google"
4. Authorize with your Google account
5. You should be redirected to `/dashboard.html`

### 5.2 Configure Your Sheet

1. In the dashboard, enter your Google Sheet ID
2. Click "Test Connection"
3. If successful, click "Save Sheet ID"
4. Click "View Activities" to see your sheet data

### 5.3 Test Customization

1. In dashboard, change the theme color
2. Select a different font
3. Click "Save Preferences"
4. Go to "View Activities" - your customizations should be applied

### 5.4 Set Up Admin Access

1. In Supabase, go to Table Editor → users
2. Find your user row
3. Click to edit
4. Change `role` from `user` to `admin`
5. Save
6. Refresh your app - you should now see "Admin" button
7. Click it to access the admin panel

## Step 6: Test Multi-User (Optional)

1. Sign out
2. Sign in with a different Google account
3. Configure a different Google Sheet
4. Verify each user sees their own data

## Troubleshooting

### "Failed to initialize authentication"
- Check that Netlify environment variables are set correctly
- Verify Supabase project is active
- Check browser console for specific errors

### "OAuth redirect error"
- Verify the redirect URI in Google Cloud Console matches your Supabase project
- Make sure Google OAuth is enabled in Supabase

### "No Google Sheet configured"
- User needs to go to Dashboard and enter their Sheet ID
- Sheet must be shared with "Anyone with the link can view"

### "Failed to load data"
- Verify the Google Sheet ID is correct
- Ensure the sheet has the required tabs (Arts & Crafts, etc.)
- Check that sheet is publicly accessible

## Next Steps

- Invite family members to sign up
- Customize your theme colors
- Add more activities to your Google Sheet
- Monitor users in the admin panel

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all environment variables in Netlify
3. Check Supabase logs: Authentication → Logs
4. Ensure Google Sheet sharing is set correctly

## Success!

Your multi-user parental preferences app is now live! Each family can:
- Sign in with their Google account
- Configure their own Google Sheet
- Customize colors and themes
- View beautiful activity guides
- Print kid-friendly layouts

Admin users can:
- View all registered users
- Enable/disable accounts
- Monitor system usage
