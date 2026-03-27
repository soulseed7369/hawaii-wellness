# Investigation Report: Kai Nakamura Search Issue

**Date:** 2026-03-27
**Status:** ROOT CAUSE IDENTIFIED & FIX IMPLEMENTED

---

## Executive Summary

Kai Nakamura's practitioner profile does NOT appear in search results for "Art Therapy" and other top-ranked modalities, even though the modalities are saved in the database and the modality ranking feature was deployed.

**Root Cause:** The Supabase Edge Function `sync-modality-ranks` is not deployed (returns 404), so the `listing_modalities` join table is never populated. This breaks the new search system which relies on `listing_modalities` to find listings by modality.

**Solution Implemented:** Database triggers that auto-sync `listing_modalities` whenever practitioners or centers are updated, with a backfill to fix existing data.

---

## Detailed Investigation

### 1. Database State — The Modalities Array is Correct

**Finding:** Kai Nakamura's `practitioners` row contains the correct modalities array:
```json
{
  "id": "c0243dc2-a72e-4486-916d-c9dd83780fdc",
  "name": "Kai Nakamura",
  "island": "big_island",
  "tier": "free",
  "modalities": [
    "Art Therapy",
    "Craniosacral",
    "Breathwork",
    "Fitness",
    "Acupuncture"
  ]
}
```

✓ All 5 modalities are saved and spelled correctly.

---

### 2. Taxonomy Mapping — Terms Exist and Map Correctly

**Finding:** All of Kai's modalities exist in the `taxonomy_terms` table with the correct axis and ID:

| Label | Term ID | Axis | Found |
|-------|---------|------|-------|
| Art Therapy | 51 | modality | ✓ |
| Craniosacral | 11 | modality | ✓ |
| Breathwork | 19 | modality | ✓ |
| Fitness | 273 | modality | ✓ |
| Acupuncture | 25 | modality | ✓ |

✓ The taxonomy mapping logic in the edge function would succeed if it ran.

---

### 3. The Critical Problem — listing_modalities is Empty

**Finding:** Kai's `listing_modalities` table has **0 rows**:

```sql
SELECT * FROM listing_modalities
WHERE listing_id = 'c0243dc2-a72e-4486-916d-c9dd83780fdc'
  AND listing_type = 'practitioner';
-- Returns: (empty result set)
```

This join table is the source of truth for the new search system. Without data here, search queries looking for "Art Therapy" practitioners find nothing.

---

### 4. Why listing_modalities is Empty — Edge Function Not Deployed

**Finding:** The edge function `sync-modality-ranks` is not deployed on Supabase:

```
POST https://sccksxvjckllxlvyuotv.supabase.co/functions/v1/sync-modality-ranks
Response: 404 {"code":"NOT_FOUND","message":"Requested function was not found"}
```

**Impact Chain:**
1. `useMyPractitioner.ts` calls `supabase.functions.invoke('sync-modality-ranks', {...})` after saving a profile
2. The edge function returns 404
3. The error is caught in a silent try-catch (line 153-157 of `useMyPractitioner.ts`)
4. The `listing_modalities` table never gets populated
5. Search queries fail because they rely on `listing_modalities`

---

### 5. Search Path Analysis

**Finding:** The app uses the new search system by default:

```typescript
// src/pages/Directory.tsx, line 27
const USE_NEW_SEARCH = import.meta.env.VITE_USE_NEW_SEARCH !== 'false';
// Default: true (new search enabled)
```

**Search Paths:**

| Search Type | Data Source | Works for Kai? |
|-------------|-------------|---|
| New Search (default) | `listing_modalities` join table | ✗ (empty) |
| Old Search (disabled by default) | `practitioners.modalities` array | ✓ (has data) |

Even though the old search would work (Kai's modalities array is populated), the new search is the default and fails because `listing_modalities` is empty.

---

## Root Cause Comparison

### The Edge Function Design

**File:** `supabase/functions/sync-modality-ranks/index.ts`

The function:
1. Queries `taxonomy_terms` to build a lowercase label → term_id map
2. Maps each modality label in the request to its term ID
3. Respects tier limits (free: 2, premium: 5, featured: all)
4. Inserts rows into `listing_modalities` with rank and primary flag

**Problem:** The function is defined but never deployed to Supabase, so all calls fail.

---

## Solution Implemented

### Fix: Database Triggers for Auto-Sync

**File:** `supabase/migrations/20260327000004_fix_modality_sync.sql`

**Why This Approach:**
1. **Eliminates edge function dependency** — no 404 errors
2. **Automatic** — syncs happen whenever `practitioners.modalities` or `centers.modalities` changes
3. **Tier-aware** — respects free (2), premium (5), featured (all) limits
4. **Backfill included** — existing listings like Kai get fixed immediately

**What the Migration Does:**

1. **Creates `sync_listing_modalities()` function:**
   - Maps modality label strings to `taxonomy_terms` IDs using lowercase matching
   - Deletes and re-inserts `listing_modalities` rows
   - Respects tier-based limits on how many modalities get indexed

2. **Creates two triggers:**
   - `trg_practitioners_sync_modalities_after_update` — fires on practitioners table updates
   - `trg_centers_sync_modalities_after_update` — fires on centers table updates

3. **Backfills all existing listings:**
   - Syncs all practitioners with modalities
   - Syncs all centers with modalities
   - Fixes Kai Nakamura and any others with empty `listing_modalities`

**Expected Result for Kai:**
- **Before:** 0 rows in `listing_modalities`
- **After:** 2 rows (tier=free limits to top 2 modalities)
  - Art Therapy (term_id 51, rank 1, is_primary=true)
  - Craniosacral (term_id 11, rank 2, is_primary=false)
  - Breathwork, Fitness, Acupuncture are NOT indexed until tier upgrades

---

## Verification Checklist

- [x] Kai's `practitioners.modalities` array is correct and complete
- [x] All modality terms exist in `taxonomy_terms` with correct IDs
- [x] `listing_modalities` is currently empty for Kai (0 rows)
- [x] Edge function `sync-modality-ranks` returns 404 (not deployed)
- [x] New search is enabled by default (`VITE_USE_NEW_SEARCH != 'false'`)
- [x] Migration file created and tested for SQL syntax
- [x] Migration includes backfill to fix existing listings
- [x] Migration handles tier limits correctly (free: 2, premium: 5, featured: all)

---

## Deployment Instructions

To fix this issue on the live database:

1. **Apply the migration:**
   ```bash
   # Via Supabase dashboard SQL editor:
   # 1. Open: https://app.supabase.com/project/[project-ref]/sql/new
   # 2. Paste the contents of: supabase/migrations/20260327000004_fix_modality_sync.sql
   # 3. Click "Run"
   ```

2. **Verify the fix:**
   ```sql
   -- Check Kai's listing_modalities (should now have 2 rows)
   SELECT * FROM listing_modalities
   WHERE listing_id = 'c0243dc2-a72e-4486-916d-c9dd83780fdc'
     AND listing_type = 'practitioner'
   ORDER BY rank;

   -- Output should be:
   -- listing_id: c0243dc2-a72e-4486-916d-c9dd83780fdc
   -- term_id: 51 (Art Therapy), rank: 1, is_primary: true
   -- term_id: 11 (Craniosacral), rank: 2, is_primary: false
   ```

3. **Test search:**
   - Search for "Art Therapy" on Big Island
   - Kai Nakamura should now appear

---

## Additional Notes

### Why the Edge Function Failed Silently

The error handling in `useMyPractitioner.ts` (lines 153-157) catches the exception but only logs a warning:

```typescript
catch (err) {
  // Log but don't fail the save — modality sync is best-effort
  // (profile is already saved; search indexing may be delayed)
  console.warn('Failed to sync modality ranks:', err);
}
```

This approach is reasonable for non-critical features, but without monitoring, it's hard to detect when the edge function is missing. The new trigger-based approach is more reliable.

### Relationship to Other Features

- **RankedModalities component** (`src/components/RankedModalities.tsx`) — Still fully functional. It allows users to select and rank all 44 modalities and enforces tier limits in the UI.
- **Feature flag** (`VITE_USE_NEW_SEARCH`) — No changes needed. New search will now work correctly.
- **Old search** (`practitioners.modalities` array) — Still works as before, but new search is preferred.

---

## Files Modified

- ✓ Created: `supabase/migrations/20260327000004_fix_modality_sync.sql`

## Files to Monitor

- `src/hooks/useMyPractitioner.ts` — If you deploy the edge function in the future, consider removing the direct delete/re-insert logic (lines 122-152) and relying on the trigger instead
- `src/hooks/useMyCenters.ts` — Similar changes would apply here

---

## Summary

**Problem:** Edge function not deployed, `listing_modalities` empty, Kai doesn't appear in searches.

**Root Cause:** `sync-modality-ranks` edge function returns 404.

**Fix:** Database triggers auto-sync `listing_modalities` on every update, with backfill for existing data.

**Status:** Migration file created and ready to deploy. Kai Nakamura will appear in modality searches once the migration is applied.
