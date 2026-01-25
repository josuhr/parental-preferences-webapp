# Project Cleanup Plan

## Files to Archive/Remove

### ✅ Safe to Remove (Temporary/Test Files)
These were for testing and are no longer needed:
```
simple-test.html
test-connection.html
```

### ✅ Safe to Remove (Superseded SQL Migration Files)
These were incremental fixes that are now consolidated:

**Phase 3B Fixes (All superseded by database-phase3b-final-fix.sql):**
```
database-phase3b-fix-rls.sql
database-phase3b-fix-teacher-rls.sql
database-phase3b-fix-teacher-access.sql
database-phase3b-fix-missing-access.sql
database-phase3b-complete-fix.sql
database-phase3b-manual-fix.sql
fix-josh-user.sql                    # One-time manual fix
```

**Phase 5 Fixes (Superseded by database-phase5-consolidated.sql):**
```
database-phase5.sql                  # Superseded by consolidated version
database-phase5-fix.sql              # Superseded by consolidated version
```

### ✅ Safe to Remove (Duplicate Documentation)
```
PHASE3B_COMPLETE.md                  # Superseded by PHASE3B_COMPLETE_FINAL.md
```

---

## Files to Keep

### ✅ Active SQL Migration Files
These are the clean, consolidated versions to run:
```
database-schema.sql                  ✅ Base schema (run FIRST)
database-phase1.sql                  ✅ Platform foundation (run SECOND)
database-phase2.sql                  ✅ Built-in preferences
database-phase2-update.sql           ✅ Preference level dimension
database-caregiver-labels.sql        ✅ Customizable labels
database-phase3b-auth.sql            ✅ Dual auth schema
database-phase3b-final-fix.sql       ✅ Final RLS fixes for Phase 3B
database-phase4.sql                  ✅ Kid preferences
database-phase4-app-access.sql       ✅ Kid prefs app registration
database-phase5-consolidated.sql     ✅ Teacher access (consolidated)
database-phase5-app-access.sql       ✅ Teacher dashboard app registration
```

### ✅ Documentation
```
README.md
QUICKSTART.md
DEPLOYMENT.md
IMPLEMENTATION_SUMMARY.md
SUPABASE_SETUP.md
RESEND_SETUP.md
PHASE1_COMPLETE.md
PHASE1_DEPLOYMENT.md
PHASE2_COMPLETE.md
PHASE2_DEPLOYMENT.md
PHASE3B_COMPLETE_FINAL.md           ✅ Keep this one
PHASE5_SUMMARY.md
PHASE5_PART2A_COMPLETE.md
PHASE5_COMPLETE.md
```

### ✅ Application Files
All HTML, JS, CSS files are active and needed.

---

## Recommended Action

### Option A: Archive (Safer)
Move obsolete files to an `archive/` folder:
```bash
mkdir -p archive/sql-migrations
mkdir -p archive/test-files
mkdir -p archive/docs

# Move files but keep in git history
mv [obsolete files] archive/
```

### Option B: Delete (Cleaner)
Remove obsolete files completely:
```bash
git rm [files]
```

They'll still exist in git history if needed.

---

## Summary

**Can safely remove:** 12 files (2 test files, 9 SQL fixes, 1 doc)
**Total cleanup:** ~1.5KB of unnecessary files
**Result:** Cleaner project structure, easier to navigate

Would you like me to proceed with the cleanup?
