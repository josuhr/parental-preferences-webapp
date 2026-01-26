# Parental Preferences - Multi-User App

A kid-friendly web application for tracking which activities Mom and Dad love to do together! Now with multi-user support, Google authentication, and personalized Google Sheets integration.

## Features

### Core Features
- 🔐 **Secure Authentication** - Google OAuth and email-based login
- 📊 **Activity Preferences** - Track what activities kids and parents enjoy
- 👶 **Kid Profiles** - Manage multiple kids with individual preferences
- 👩‍🏫 **Teacher Access** - Invite teachers to view and observe kids
- ✨ **Smart Recommendations** - AI-powered activity suggestions based on preferences
- 🎨 **Custom Themes** - Personalize colors and fonts
- 🖨️ **Print-Ready** - Beautiful layouts for physical reference

### For Parents
- Manage activity preferences (built-in or Google Sheets)
- Create and track kid profiles with preference levels
- Get personalized activity recommendations for each kid
- Customize recommendation algorithm weights
- Grant teacher access to specific kids
- View teacher observations and insights

### For Teachers
- View authorized kid profiles and preferences
- Create observations and track progress
- Design perspective-building activities
- Message parents about kid development
- Share professional insights

### For Admins
- 👥 **User Management** - View and manage all registered users
- 📈 **Statistics** - Track total users and activity
- 🛡️ **Access Control** - Enable/disable user accounts

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACES                                 │
├──────────────┬──────────────────────┬──────────────────────┬────────────────┤
│   Parents    │      Teachers        │      Admins          │   Anonymous    │
│              │                      │                      │                │
│  Dashboard   │  Teacher Dashboard   │  Admin Panel         │  Auth Page     │
│  Prefs Mgmt  │  Kid View           │  User Management     │  (Login/Signup)│
│  Kid Prefs   │  Observations       │  Statistics          │                │
│  Recommend.  │  Activities         │  Access Control      │                │
│  Settings    │  Messages           │                      │                │
└──────┬───────┴──────────┬───────────┴───────────┬──────────┴────────┬───────┘
       │                  │                       │                   │
       │                  │                       │                   │
       ▼                  ▼                       ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION LAYER                                 │
│                         (Supabase Auth)                                      │
│                                                                              │
│   ┌────────────────┐      ┌──────────────────┐    ┌──────────────────┐    │
│   │  Google OAuth  │      │  Email/Password  │    │  Teacher Tokens  │    │
│   │  (Primary)     │      │  (Alternative)   │    │  (Invite Links)  │    │
│   └────────────────┘      └──────────────────┘    └──────────────────┘    │
│                                                                              │
│   Session Management • JWT Tokens • Role-Based Access                       │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │                    Frontend (Vanilla JS)                       │         │
│  │                                                                 │         │
│  │  • Platform Navigation (platform-nav.js)                       │         │
│  │  • Supabase Client (supabase-config.js)                       │         │
│  │  • Page Controllers (script.js, auth.js, etc.)                │         │
│  │  • Recommendation Engine UI (recommendations.js)               │         │
│  │  • Settings Management (recommendation-settings.js)            │         │
│  └─────────────────────────────┬───────────────────────────────────┘         │
│                                │                                             │
│                                ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │              Netlify Serverless Functions                      │         │
│  │                                                                 │         │
│  │  • get-config.js ─────────→ Environment config delivery       │         │
│  │  • send-invitation.js ────→ Email invitations (via Resend)    │         │
│  │  • (Future: nightly-similarities.js for batch processing)     │         │
│  └─────────────────────────────┬───────────────────────────────────┘         │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (Supabase PostgreSQL)                     │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ROW LEVEL SECURITY (RLS)                           │  │
│  │  Every table protected • User-scoped queries • Teacher permissions   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────────┐   │
│  │  User & Platform  │  │   Preferences     │  │  Recommendations     │   │
│  │                   │  │                   │  │  (Phase 3A)          │   │
│  │  • users          │  │  • activities     │  │  • contexts          │   │
│  │  • user_settings  │  │  • categories     │  │  • activity_contexts │   │
│  │  • apps           │  │  • parent_prefs   │  │  • similarity cache  │   │
│  │  • user_app_access│  │  • kids           │  │  • rules & weights   │   │
│  │  • auth tables    │  │  • kid_activities │  │  • history & feedback│   │
│  └───────────────────┘  │  • kid_prefs      │  └──────────────────────┘   │
│                         └───────────────────┘                               │
│  ┌───────────────────┐  ┌───────────────────┐                              │
│  │  Teacher System   │  │  Insights & Obs   │                              │
│  │  (Phase 5)        │  │                   │                              │
│  │                   │  │  • kid_insights   │                              │
│  │  • invitations    │  │  • observations   │                              │
│  │  • access_perms   │  │  • perspective    │                              │
│  │  • messages       │  │    activities     │                              │
│  └───────────────────┘  └───────────────────┘                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL Functions (Recommendation Engine)              │ │
│  │                                                                         │ │
│  │  • compute_cosine_similarity()     → Kid similarity calculation       │ │
│  │  • compute_all_kid_similarities()  → Batch similarity processing      │ │
│  │  • compute_activity_similarities() → Activity co-occurrence analysis  │ │
│  │  • get_similar_kids()              → Find similar kid profiles        │ │
│  │  • get_similar_activities()        → Content-based filtering          │ │
│  │  • get_recommendations_for_kid()   → Multi-factor scoring algorithm   │ │
│  │  • record_recommendation_feedback() → Track user interactions         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                     │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │  Google OAuth    │  │  Resend Email    │  │  Netlify Hosting/CDN    │  │
│  │  (Authentication)│  │  (Invitations)   │  │  (Global Distribution)  │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘


                            KEY DATA FLOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. RECOMMENDATION GENERATION FLOW:
   Parent → Select Kid → UI → get_recommendations_for_kid() → 
   [Compute: Direct Prefs (40%) + Parent Influence (20%) + Similar Kids (20%) +
    Teacher Obs (10%) + Context (10%) + Novelty (5%) - Recency (15%)] →
   Ranked Activity List → Display with Explanations

2. SIMILARITY COMPUTATION FLOW (Nightly Batch):
   All Kids → compute_all_kid_similarities() → Cosine Similarity Matrix →
   kid_similarity_cache → Used by get_recommendations_for_kid()
   
   All Activities → compute_activity_similarities() → Co-occurrence Analysis →
   activity_similarity → Content-based Recommendations

3. TEACHER ACCESS FLOW:
   Parent → Invite Teacher → send-invitation.js → Resend Email →
   Teacher Clicks Link → Create Account → Token Validation →
   Access Granted (RLS) → View Kids → Add Observations →
   Observations Influence Recommendations

4. AUTHENTICATION FLOW:
   User → Login (Google/Email) → Supabase Auth → JWT Token →
   RLS Policies Enforce Access → User-Scoped Data Only
```

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Authentication**: Supabase Auth (Google OAuth + Email)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Backend**: Netlify Functions (serverless)
- **Hosting**: Netlify
- **Email**: Resend (teacher invitations)
- **AI/ML**: PostgreSQL-native recommendation algorithm with cosine similarity

## Quick Start

### For End Users

1. Visit the app URL
2. Click "Sign in with Google"
3. Go to Dashboard
4. Enter your Google Sheet ID
5. Customize your theme
6. View your activities!

### For Developers

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for complete setup instructions.

**Quick setup:**
```bash
# Clone the repo
git clone https://github.com/josuhr/parental-preferences-webapp.git
cd parental-preferences-webapp

# Install function dependencies
cd netlify/functions
npm install
cd ../..

# Set up Supabase (see DEPLOYMENT.md)
# Set up Netlify environment variables
# Deploy!
```

## Project Structure

```
parental-preferences/
├── Core Pages
│   ├── index.html                    # Main activity viewer
│   ├── auth.html                     # Login/signup page
│   ├── dashboard.html                # User dashboard
│   ├── admin.html                    # Admin panel
│   └── platform-nav.html             # Universal navigation
│
├── Preferences Management
│   ├── preferences-manager.html      # Parent activity preferences
│   ├── kid-preferences-manager.html  # Kid profile management
│   ├── kid-prefs.html               # Kid preference editor
│   └── kid-access-management.html   # Teacher access control
│
├── Recommendations (Phase 3A)
│   ├── recommendations.html          # Activity recommendations
│   └── recommendation-settings.html  # Algorithm customization
│
├── Teacher Features (Phase 5)
│   ├── teacher-invite.html          # Invite teachers
│   ├── teacher-dashboard.html       # Teacher home
│   ├── teacher-kid-view.html        # Kid profiles (teacher view)
│   ├── teacher-observations.html    # Observation tracking
│   └── perspective-activities.html  # Activity library
│
├── JavaScript Modules
│   ├── supabase-config.js           # Supabase client
│   ├── script.js, auth.js, etc.     # Page-specific logic
│   ├── recommendations.js           # Recommendation UI
│   └── recommendation-settings.js   # Settings UI
│
├── Database Migrations
│   ├── database-schema.sql          # Base schema
│   ├── database-phase1.sql          # Platform foundation
│   ├── database-phase2.sql          # Built-in preferences
│   ├── database-phase3a-*.sql       # Recommendations engine
│   ├── database-phase3b-*.sql       # Dual authentication
│   ├── database-phase4.sql          # Kid preferences
│   ├── database-phase5-*.sql        # Teacher access
│   └── SQL_MIGRATION_ORDER.md       # Migration guide
│
├── Documentation
│   ├── README.md                    # This file
│   ├── DEPLOYMENT.md                # Deployment guide
│   ├── SUPABASE_SETUP.md           # Database setup
│   ├── PHASE3A_COMPLETE.md         # Recommendations docs
│   └── PHASE*_COMPLETE.md          # Phase completion docs
│
├── netlify/
│   └── functions/
│       ├── get-config.js           # Config endpoint
│       ├── send-invitation.js      # Email invitations
│       └── package.json            # Dependencies
│
└── netlify.toml                    # Netlify configuration
```

## Database Schema

### Phase 1: Platform Foundation
- **users** - User profiles with Google ID and email
- **user_settings** - Theme colors, fonts, customizations
- **apps** - Registered platform apps and navigation

### Phase 2: Built-in Preferences
- **activity_categories** - User-defined activity categories
- **activities** - Activities within categories
- **parent_preferences** - Parent preference levels per activity
- **caregiver_labels** - Customizable role labels (mom/dad)

### Phase 3A: Recommendations Engine ✨ NEW
- **recommendation_contexts** - Context filters (indoor, morning, etc.)
- **activity_contexts** - Activity-to-context mappings
- **activity_similarity** - Pre-computed activity similarities
- **kid_similarity_cache** - Pre-computed kid similarities (cosine)
- **recommendation_rules** - User-customizable algorithm weights
- **recommendation_history** - Feedback and interaction tracking

### Phase 3B: Dual Authentication
- **email_auth_users** - Email-based authentication support
- **teacher_invitations** - Teacher invitation workflow

### Phase 4: Kid Preferences
- **kids** - Kid profiles with birth dates and avatars
- **kid_activity_categories** - Kid-specific categories
- **kid_activities** - Activities for kids
- **kid_preferences** - Kid preference levels (loves/likes/neutral)
- **kid_insights** - Auto-generated insights about kids

### Phase 5: Teacher Access
- **kid_access_permissions** - Teacher access grants
- **teacher_observations** - Teacher notes and observations
- **perspective_activities** - Teacher-created activities
- **perspective_activity_sessions** - Activity session tracking
- **parent_teacher_messages** - Communication system

All tables include Row Level Security (RLS) for privacy and multi-tenancy.

## Key Features Deep Dive

### 🎯 Smart Recommendations (Phase 3A)

The recommendations engine uses a sophisticated multi-factor algorithm:

**Algorithm Factors:**
1. **Direct Preference Match** (40%) - What the kid already loves/likes
2. **Parent Influence** (20%) - Parent's activity preferences
3. **Similar Kids** (20%) - Collaborative filtering using cosine similarity
4. **Teacher Observations** (10%) - Professional insights
5. **Context Matching** (10%) - Time, weather, energy level
6. **Novelty Boost** (5%) - Encourage trying new things
7. **Recency Penalty** (15%) - Promote variety

**User Customization:**
- Adjust any factor weight via intuitive sliders
- Quick presets: Balanced, Kid-Led, Parent-Guided, Discovery
- Settings persist per family

**Performance:**
- Sub-100ms query response time
- PostgreSQL-native (no external services)
- Nightly similarity computation
- Scales to 5,000+ kids efficiently

See `PHASE3A_COMPLETE.md` for detailed documentation.

---

## Environment Variables (Netlify)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Features Roadmap

### Completed ✅
- [x] Google OAuth authentication
- [x] Email-based authentication
- [x] User dashboard and settings
- [x] Admin panel
- [x] Theme customization
- [x] Built-in preference management
- [x] Kid profile management
- [x] Kid preference tracking
- [x] Teacher invitation system
- [x] Teacher dashboard and observations
- [x] **Smart Recommendations Engine** (Phase 3A)
  - [x] Multi-factor scoring algorithm
  - [x] Collaborative filtering (similar kids)
  - [x] Context-aware filtering
  - [x] Customizable algorithm weights
  - [x] Feedback tracking system

### In Progress 🚧
- [ ] Mobile-responsive design improvements
- [ ] Recommendation analytics dashboard
- [ ] Weather API integration for auto-context

### Planned 📋
- [ ] Machine learning model training from feedback
- [ ] Activity duration matching
- [ ] Community activity discovery
- [ ] Share read-only links with family
- [ ] Mobile app version (React Native)
- [ ] Dark mode
- [ ] Multiple language support
- [ ] Export/import preferences

## Contributing

This is a personal/family project, but suggestions are welcome! Open an issue or submit a pull request.

## License

MIT License - feel free to use and modify for your own family!

## Support

For issues or questions:
1. Check [`DEPLOYMENT.md`](DEPLOYMENT.md) for setup help
2. Review browser console for errors
3. Verify Supabase and Netlify configurations
4. Open a GitHub issue

---

Made with 💜 for helping families spend quality time together!
