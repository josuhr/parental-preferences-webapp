# SQL Migration Order

Run these SQL files in Supabase SQL Editor in this exact order:

## Initial Setup
1. `database-schema.sql` - Base schema (users, settings, RLS)

## Phase 1: Platform Foundation  
2. `database-phase1.sql` - Apps registry, user types, platform nav

## Phase 2: Built-in Preferences
3. `database-phase2.sql` - Activity categories, activities, preferences
4. `database-phase2-update.sql` - Add preference_level dimension
5. `database-caregiver-labels.sql` - Customizable caregiver labels

## Phase 3B: Dual Authentication
6. `database-phase3b-auth.sql` - Email auth, teacher invitations table
7. `database-phase3b-final-fix.sql` - RLS fixes for auth flows

## Phase 4: Kid Preferences
8. `database-phase4.sql` - Kids table, kid preferences, kid activities
9. `database-phase4-app-access.sql` - Register kid-prefs app
10. `database-phase4-universal-activities.sql` - Convert activities to universal (shared across all users)
11. `database-phase4-parent-kid-prefs.sql` - Parent preferences for kid activities (drop anything/sometimes/on your own)
12. `database-phase4-household-prefs.sql` - Household activities with multi-caregiver preferences (Caregiver1, Caregiver2, Both)
13. `database-phase4-kids-activity-view-app.sql` - Register "Who Likes What?" app for kids

## Phase 3A: Recommendations Engine
14. `database-phase3a-recommendations.sql` - Recommendation contexts, similarity, rules, algorithm
15. `database-phase3a-app-access.sql` - Register recommendations apps

## Phase 5: Teacher Access
16. `database-phase5-consolidated.sql` - Teacher access, observations, perspective activities
17. `database-phase5-app-access.sql` - Register teacher-dashboard app

## Phase 6: Kid View
18. `database-kid-view.sql` - Activity illustrations, kid activity selections

---

## Archived Files

Obsolete migration files (superseded by consolidated versions above):
- `archive/obsolete-sql/` - Old fix files, incremental migrations
- `archive/test-files/` - Test HTML files
- `archive/obsolete-docs/` - Superseded documentation

These are kept for reference but not needed for setup.
