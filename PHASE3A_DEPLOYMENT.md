# Phase 3A Quick Deployment Guide

## Prerequisites
- Supabase project set up and running
- Access to Supabase SQL Editor
- Netlify deployment configured

## Step-by-Step Deployment

### 1. Database Migration (5 minutes)

Open Supabase SQL Editor and run in order:

```sql
-- 1. Create recommendation tables and functions
-- Copy and paste: database-phase3a-recommendations.sql
-- Expected: 6 tables, 8 functions, 14 contexts created

-- 2. Register apps in platform
-- Copy and paste: database-phase3a-app-access.sql  
-- Expected: 2 apps registered
```

**Verify:**
```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%recommendation%' OR table_name LIKE '%similarity%');
-- Should show 6 tables

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%similar%' OR routine_name LIKE '%recommend%');
-- Should show 8+ functions

-- Check contexts
SELECT COUNT(*) FROM recommendation_contexts;
-- Should be 14

-- Check apps
SELECT name FROM apps WHERE name LIKE '%Recommend%';
-- Should show 2 apps
```

### 2. Initial Data Setup (2 minutes)

The migration automatically:
- ✅ Creates 14 default recommendation contexts
- ✅ Initializes default rules for existing users
- ✅ Sets up triggers for new users

No manual data entry needed!

### 3. Compute Initial Similarities (1-5 minutes)

Run in Supabase SQL Editor:

```sql
-- Compute kid similarities (may take time if many kids)
SELECT * FROM compute_all_kid_similarities();
-- Returns: processed_count, similarity_pairs, execution_time_ms

-- Compute activity similarities
SELECT * FROM compute_activity_similarities();
-- Returns: processed_count, similarity_pairs, execution_time_ms
```

**Note:** If you have many kids, this can be run later. Recommendations will work without it, just with less collaborative filtering.

### 4. Deploy Frontend Files (Automatic)

Files are already in your repo:
- ✅ recommendations.html
- ✅ recommendations.js
- ✅ recommendation-settings.html
- ✅ recommendation-settings.js

**If using Git:**
```bash
git add .
git commit -m "Add Phase 3A: Recommendations Engine"
git push
```

Netlify will auto-deploy (2-3 minutes).

### 5. Test the Feature (5 minutes)

1. **Log in** to your app
2. **Navigate** to "Activity Recommendations" (should appear in platform nav)
3. **Select a kid** to get recommendations
4. **Verify recommendations** appear
5. **Click "Customize Settings"** 
6. **Adjust weights** and save
7. **Return** to recommendations and verify changes

**Expected Behavior:**
- Recommendations load in <1 second
- Cards show scores, confidence, and explanations
- Action buttons work (Try This, Save, Dismiss)
- Settings save and affect recommendations

### 6. Schedule Batch Jobs (Optional but Recommended)

Choose one option:

**Option A: Supabase Edge Function (Recommended)**
```typescript
// supabase/functions/compute-similarities/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  // Run nightly at 2 AM
  const { data: kidSim } = await supabase.rpc('compute_all_kid_similarities')
  const { data: actSim } = await supabase.rpc('compute_activity_similarities')
  
  return new Response(JSON.stringify({ kidSim, actSim }))
})
```

**Option B: Netlify Scheduled Function**
```javascript
// netlify/functions/compute-similarities.js
const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event, context) => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  
  const { data: kidSim } = await supabase.rpc('compute_all_kid_similarities')
  const { data: actSim } = await supabase.rpc('compute_activity_similarities')
  
  return {
    statusCode: 200,
    body: JSON.stringify({ kidSim, actSim })
  }
}
```

Add to `netlify.toml`:
```toml
[[functions]]
  name = "compute-similarities"
  schedule = "0 2 * * *"  # 2 AM daily
```

**Option C: Manual SQL (Simple Start)**
Run manually in Supabase SQL Editor once per day:
```sql
SELECT * FROM compute_all_kid_similarities();
SELECT * FROM compute_activity_similarities();
```

### 7. Verify Everything Works

**Checklist:**
- [ ] Can view recommendations page
- [ ] Recommendations load for kids with preferences
- [ ] Can filter by context (Indoor, Outdoor, etc.)
- [ ] Action buttons work (Try This, Save, Dismiss)
- [ ] Settings page loads
- [ ] Can adjust weights with sliders
- [ ] Settings save and persist
- [ ] Changes affect recommendations
- [ ] No console errors in browser

## Troubleshooting

### "No recommendations available"
- **Cause:** Kid has no preferences set
- **Fix:** Add some preferences in Kid Preferences Manager first

### "Error loading recommendations"
- **Cause:** Database functions not created or RLS issue
- **Fix:** Re-run database-phase3a-recommendations.sql, check browser console

### Slow recommendations (>2 seconds)
- **Cause:** Similarities not computed
- **Fix:** Run `compute_all_kid_similarities()` and `compute_activity_similarities()`

### Settings not saving
- **Cause:** RLS policy issue or authentication problem
- **Fix:** Verify user is logged in, check RLS policies in Supabase dashboard

### Apps not appearing in platform nav
- **Cause:** App registration didn't run
- **Fix:** Re-run database-phase3a-app-access.sql

## Testing with Sample Data

Run the test suite:

```sql
-- Run comprehensive tests
-- Copy and paste: database-phase3a-test.sql
-- Expected: 10 test scenarios, all passing
```

This creates test kids, preferences, and validates the entire system.

## Performance Benchmarks

Expected performance (for <5,000 kids):
- ✅ Recommendation query: <100ms
- ✅ Similar kids lookup: <10ms (cached)
- ✅ Similar activities lookup: <10ms (cached)
- ✅ Batch similarity computation: <5 minutes
- ✅ Settings save: <50ms

## Post-Deployment Monitoring

Monitor these metrics:
1. **Query performance**: Check Supabase dashboard for slow queries
2. **User engagement**: Track recommendation actions in recommendation_history
3. **Error rates**: Monitor browser console and Netlify function logs
4. **Batch job status**: Verify nightly jobs complete successfully

## Rollback Plan

If issues arise:

1. **Disable apps** (temporary):
```sql
UPDATE apps SET is_active = false WHERE name LIKE '%Recommend%';
```

2. **Drop tables** (nuclear option):
```sql
DROP TABLE IF EXISTS recommendation_history CASCADE;
DROP TABLE IF EXISTS recommendation_rules CASCADE;
DROP TABLE IF EXISTS kid_similarity_cache CASCADE;
DROP TABLE IF EXISTS activity_similarity CASCADE;
DROP TABLE IF EXISTS activity_contexts CASCADE;
DROP TABLE IF EXISTS recommendation_contexts CASCADE;
```

3. **Restore from backup** (if needed)

## Success Criteria

Phase 3A is successfully deployed when:
- ✅ All database objects created without errors
- ✅ Apps appear in platform navigation
- ✅ Users can view recommendations for their kids
- ✅ Users can customize algorithm weights
- ✅ Feedback is recorded when users interact
- ✅ No linting errors in code
- ✅ Performance meets targets (<100ms queries)

## Next Steps After Deployment

1. **Monitor usage** for first week
2. **Gather user feedback** on recommendation quality
3. **Tune similarity thresholds** if needed
4. **Add more context types** based on usage patterns
5. **Consider A/B testing** different weight configurations

## Support Resources

- **Full Documentation**: `PHASE3A_COMPLETE.md`
- **Test Suite**: `database-phase3a-test.sql`
- **Implementation Summary**: `PHASE3A_SUMMARY.md`
- **SQL Migration Order**: `SQL_MIGRATION_ORDER.md`

---

**Estimated Total Time:** 15-20 minutes  
**Difficulty:** Medium  
**Risk Level:** Low (no breaking changes to existing features)

**Ready to deploy!** 🚀
