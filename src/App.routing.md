# App.tsx Routing Updates

## Summary

To support both the original `Claim.tsx` and the new enhanced `ClaimListing.tsx`, you have two options:

### Option A: Replace the old route (Recommended)

Simply update the import and replace the old `/claim/:id` route with the new component.

**In App.tsx:**

```typescript
// OLD:
import Claim from '@/pages/Claim';
// ...
<Route path="/claim/:id" element={<Claim />} />

// NEW:
import ClaimListing from '@/pages/ClaimListing';
// ...
<Route path="/claim/:id" element={<ClaimListing />} />
```

### Option B: Keep both components

If you want to preserve the original `Claim.tsx` for reference or gradual migration:

1. Rename the original file: `Claim.tsx` → `ClaimOld.tsx`
2. Create the new file: `ClaimListing.tsx`
3. Update imports to use `ClaimListing` (which supports both practitioners and centers)

## What Changed

### New Component: `ClaimListing.tsx`

Enhancements over `Claim.tsx`:

1. **Centers Support**: The flow now works for both practitioners and centers
   - Automatically detects listing type
   - Uses appropriate RPC for claiming (claim_listing_center, claim_listing)
   - Stores listing_type in claim_requests table

2. **Better Error Handling**:
   - More robust listing lookup (tries both tables)
   - Better error messages
   - Improved file validation

3. **Enhanced Tier 4 Flow**:
   - Validates file MIME type server-side
   - Stores listing_type in claim_request (for admin clarity)
   - Better file size validation

4. **Toast Notifications**:
   - Success/error toasts using sonner
   - Better UX feedback

### RPC Updates

Three new RPCs were added to support centers:
- `claim_listing_center(p_center_id)` — Tier 1 instant claim for centers
- `approve_claim_center(p_claim_id)` — Admin approval for center Tier 4 claims
- `deny_claim_center(p_claim_id, p_notes)` — Admin denial for center Tier 4 claims

Existing RPCs were updated to be polymorphic:
- `approve_claim(p_claim_id)` — Now works for both practitioners and centers
- `deny_claim(p_claim_id, p_notes)` — Now works for both practitioners and centers

## Backward Compatibility

The original `Claim.tsx` is a valid practitioner-only claim flow. The new `ClaimListing.tsx` is a superset that also supports centers. There's no functional downside to replacing it.

## Route Parameters

Both components use the same URL pattern:
```
/claim/{id}
```

Where `{id}` is the UUID of the listing (practitioners or centers table).

The component automatically detects which table the ID belongs to.

## Auth Integration

Both components respect the same auth integration:
- Redirect to `/auth?claim={id}` if not logged in
- Resume claim flow after login via DashboardHome.tsx

No changes needed to Auth.tsx or AuthCallback.tsx.
