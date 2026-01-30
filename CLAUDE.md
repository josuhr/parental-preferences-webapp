# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HomeBase is a family activity platform with "What We Like" - an app for tracking activity preferences, managing kid profiles, and generating smart recommendations. Built with vanilla JavaScript, Supabase (PostgreSQL), and Netlify Functions.

## Development Commands

```bash
# Run local development server with Netlify functions
npm run dev

# Alternative: simple HTTP server (static content only)
./start-server.sh  # Serves on http://localhost:8000

# For local testing, set Supabase credentials in browser console:
localStorage.setItem("SUPABASE_URL", "https://xxx.supabase.co")
localStorage.setItem("SUPABASE_ANON_KEY", "your-anon-key")
```

No build step required - this is a static site with serverless functions.

## Architecture

### Tech Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (no framework, no bundler)
- **Backend**: Supabase (PostgreSQL with Row Level Security)
- **Serverless**: Netlify Functions (`/netlify/functions/`)
- **Auth**: Google OAuth (primary), Email/Password (fallback)

### Key Files

**Core Utilities:**
- `supabase-config.js` - Supabase client initialization, auth utilities (`window.supabaseUtils`)
- `sidebar-nav.js` - Collapsible sidebar navigation with hierarchical structure
- `platform-nav.js` - Top navigation bar

**Page Pattern:** Each feature has paired `feature.html` + `feature.js` files. Controllers follow this pattern:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await window.supabaseUtils.getCurrentUser();
    if (!currentUser) { window.location.href = '/auth.html'; return; }
    await loadData();
    setupEventListeners();
});
```

### Database

17 SQL migration files run in sequence (see `SQL_MIGRATION_ORDER.md`). Key phases:
- Phase 1-2: Users, apps, activity categories
- Phase 3A: Recommendation engine (multi-factor scoring with PostgreSQL functions)
- Phase 3B: Email auth, invitations
- Phase 4: Kids, universal activity library (114+ activities), household preferences
- Phase 5: Teacher access system

Every table has RLS policies. Pattern: `USING (user_id = auth.uid())`

### Recommendation Engine

PostgreSQL-native algorithm in `database-phase3a-recommendations.sql` with 7 weighted factors:
- Direct preference match, parent influence, similar kids (collaborative filtering)
- Teacher observations, context matching, novelty boost, recency penalty

Weights customizable via `/recommendation-settings.html` and `recommendation_rules` table.

### Netlify Functions

Located in `/netlify/functions/`:
- `get-config.js` - Serves Supabase credentials to frontend
- `send-invitation.js` - Teacher invitation emails via Resend API
- `generate-interests-summary.js` - Optional AI summaries via OpenAI

## Environment Variables

**Required (Netlify):**
```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

**Optional:**
```
RESEND_API_KEY, RESEND_FROM_EMAIL  # For email invitations
OPENAI_API_KEY                      # For AI summaries
```

## User Types

Users have `user_types` array in database: `'parent'`, `'teacher'`, `'admin'`

Check with: `window.supabaseUtils.isParent(userId)`, `isTeacher()`, `isAdmin()`, `getUserTypes()`
