# Claim Verification Feature — Deployment Checklist

## Phase 1: Database Setup (Supabase Dashboard)

### Migrations

- [ ] **Migration 1**: `20260320000000_claim_centers_support.sql`
  - [ ] Copy file content
  - [ ] Supabase Dashboard → **SQL Editor** → New Query
  - [ ] Paste and run
  - [ ] Verify no errors

- [ ] **Migration 2**: `20260320000001_claim_documents_storage_rls.sql`
  - [ ] Copy file content
  - [ ] Supabase Dashboard → **SQL Editor** → New Query
  - [ ] Paste and run
  - [ ] Verify no errors

### Storage Bucket Setup

- [ ] **claim-documents bucket exists**
  - [ ] Supabase Dashboard → **Storage** → Buckets
  - [ ] Verify `claim-documents` bucket exists (was created by original claim migration)
  - [ ] Set to **Private** if not already

- [ ] **RLS Policies** (optional but recommended)
  - [ ] Supabase Dashboard → **Storage** → Bucket → `claim-documents` → **Policies**
  - [ ] Current setting: RLS OFF (public read/write for authenticated users via edge functions)
  - [ ] If you want stricter control, add policies:
    - [ ] Policy 1: Authenticated users can list their own claims
    - [ ] Policy 2: Service role can manage all documents

### Environment Variables (Supabase)

Already set up (verify):
- [ ] `SUPABASE_URL` — your Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — service role key (keep secret!)
- [ ] `SUPABASE_ANON_KEY` — anon key (safe to expose in browser)

Optional (if using SMS):
- [ ] `TWILIO_ACCOUNT_SID` — from Twilio console
- [ ] `TWILIO_AUTH_TOKEN` — from Twilio console
- [ ] `TWILIO_FROM_NUMBER` — your Twilio phone number (e.g., +1234567890)

To set these:
- Supabase Dashboard → **Project Settings** → **Edge Functions** → set under "Environment Variables"

## Phase 2: Edge Functions Deployment

These were already deployed in a previous sprint. Verify they're up to date:

### Existing Functions (Already Running)

- [ ] `send-verification-code` — sends OTP via email or SMS
  - [ ] Redeploy to pick up any changes:
    ```bash
    supabase functions deploy send-verification-code --no-verify-jwt
    ```

- [ ] `verify-code` — validates OTP
  - [ ] Redeploy:
    ```bash
    supabase functions deploy verify-code --no-verify-jwt
    ```

## Phase 3: Frontend Code Integration

### File Placement

- [ ] `src/hooks/useAdminClaims.ts` — new hook for admin claim management
- [ ] `src/pages/admin/AdminClaimRequests.tsx` — new admin component
- [ ] `src/pages/ClaimListing.tsx` — enhanced claim page (replace or add alongside original)
- [ ] `src/pages/admin/AdminPanel.INTEGRATION.md` — integration guide
- [ ] `src/App.routing.md` — routing update documentation

### Update Routes (App.tsx)

```typescript
// Old import (if replacing):
// import Claim from '@/pages/Claim';

// New import:
import ClaimListing from '@/pages/ClaimListing';

// Update route:
<Route path="/claim/:id" element={<ClaimListing />} />
```

### Update Admin Panel (AdminPanel.tsx)

1. [ ] Import the new component:
   ```typescript
   import { AdminClaimRequests } from './AdminClaimRequests';
   ```

2. [ ] Add "Claim Requests" tab to the tab list

3. [ ] Add tab content:
   ```typescript
   {activeTab === 'claims' && <AdminClaimRequests />}
   ```

4. [ ] Update activeTab type to include 'claims'

### Install Dependencies (if needed)

Check if `sonner` toast library is installed:
```bash
npm list sonner
```

If not installed:
```bash
npm install sonner
```

## Phase 4: Email Configuration

### Supabase Email Template

- [ ] Follow guide: `SETUP_EMAIL_TEMPLATES.md`
  - [ ] Open Supabase Dashboard → **Auth** → **Email Templates**
  - [ ] Edit "Magic Link" template
  - [ ] Paste custom template with code display
  - [ ] Save

### Test Email Delivery

- [ ] Test email OTP claim flow:
  1. [ ] Log in as test user
  2. [ ] Create a test listing with matching email
  3. [ ] Click "Claim Listing"
  4. [ ] Click "Send code"
  5. [ ] Check email for 6-digit code (not just magic link)
  6. [ ] Enter code and verify claim succeeds

## Phase 5: Testing

### Tier 1 Testing (Email Match → Instant Claim)

- [ ] Create a test practitioner listing with email test@example.com
- [ ] Log in as test@example.com user
- [ ] Navigate to `/claim/{listing-id}`
- [ ] Verify email match detected
- [ ] Click "Send code"
- [ ] Receive email with 6-digit code
- [ ] Enter code
- [ ] Click "Verify & Claim Listing"
- [ ] Verify claim succeeds and redirects to dashboard
- [ ] Check database: `practitioners.owner_id` is set to user ID
- [ ] Check database: `practitioners.email_verified_at` is set

### Tier 4 Testing (Email Mismatch → Document Upload)

- [ ] Create a test center listing with email other@example.com
- [ ] Log in as different@example.com user
- [ ] Navigate to `/claim/{listing-id}`
- [ ] Verify email mismatch detected (shows "Document upload" flow)
- [ ] Upload a PDF or image file (< 5 MB)
- [ ] Click "Submit for Review"
- [ ] Verify document uploaded to storage
- [ ] Verify claim_request created with status = 'pending'
- [ ] Check admin panel → Claim Requests tab
- [ ] Verify pending claim appears in table
- [ ] Click document to preview
- [ ] Click "Approve"
- [ ] Verify claim_request status = 'approved'
- [ ] Verify centers.owner_id is set
- [ ] Verify document deleted from storage

### Admin Panel Testing

- [ ] Log in as admin
- [ ] Navigate to `/admin`
- [ ] Click "Claim Requests" tab
- [ ] Verify pending claims display with:
  - [ ] Listing name
  - [ ] Provider email
  - [ ] Document filename (clickable)
  - [ ] Submitted date
  - [ ] Approve/Reject buttons
- [ ] Click document → preview sheet opens
  - [ ] [ ] Image files: display image preview
  - [ ] [ ] PDF files: show icon + download button
  - [ ] [ ] Other files: show icon + download button
- [ ] Click Approve → success toast
  - [ ] [ ] Verify claim marked approved
  - [ ] [ ] Verify document deleted
  - [ ] [ ] Verify listing owner_id set
- [ ] Click Reject → confirmation dialog
  - [ ] [ ] Enter notes (optional)
  - [ ] [ ] Confirm
  - [ ] [ ] Verify claim marked denied with notes
  - [ ] [ ] Verify document deleted
- [ ] Switch to "Approved" tab
  - [ ] [ ] Verify approved claims visible
  - [ ] [ ] Verify no action buttons shown
- [ ] Switch to "Denied" tab
  - [ ] [ ] Verify denied claims visible
  - [ ] [ ] Verify notes displayed

### SMS Testing (Optional)

If Twilio is configured:
- [ ] Create a listing with a phone number
- [ ] Log in as owner
- [ ] In dashboard, verify phone
- [ ] Click "Verify phone"
- [ ] Receive SMS with 6-digit code
- [ ] Enter code
- [ ] Verify success

### Rate Limiting Testing

- [ ] Try to send code 6+ times in 1 hour
- [ ] Verify error: "Too many verification attempts"
- [ ] Wait (or skip) 1 hour
- [ ] Verify code can be sent again

### Edge Cases

- [ ] [ ] Attempt to claim already-owned listing → error "already been claimed"
- [ ] [ ] Attempt to claim non-existent listing → error "Listing not found"
- [ ] [ ] Upload file > 5 MB → error "File must be under 5 MB"
- [ ] [ ] Upload executable (.exe, .app) → error or rejection (depends on validation)
- [ ] [ ] Enter wrong OTP code → error "Invalid or expired code"
- [ ] [ ] Wait 10+ minutes and re-enter code → error "expired"

## Phase 6: Production Deployment

### Pre-Production

- [ ] All tests pass locally
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Staging environment tested (if available)

### Production

- [ ] Deploy frontend (Vercel, etc.)
- [ ] Verify routes load: `/claim/{id}`, `/admin`
- [ ] Verify API calls succeed (network tab in DevTools)
- [ ] Monitor error logs (Sentry, Vercel, etc.)
- [ ] Announce feature to users

### Post-Deployment Monitoring

- [ ] [ ] Check error logs for API failures
- [ ] [ ] Monitor claim_requests table growth
- [ ] [ ] Monitor storage/claim-documents size
- [ ] [ ] Monitor email delivery (bounce rate, etc.)
- [ ] [ ] Gather user feedback on claim flow

## Rollback Plan

If issues arise:

1. **Revert frontend**: Roll back Vercel deployment to previous version
2. **Keep database**: Migrations are not rolled back (data stays intact)
3. **Preserve claims**: Already-created claims remain valid
4. **Communication**: Notify admins and affected users

## Maintenance Tasks

### Weekly

- [ ] Check admin claim requests table for backlog
- [ ] Review denied claims for patterns
- [ ] Monitor storage bucket size

### Monthly

- [ ] Run cleanup: delete old documents (> 90 days)
  ```sql
  DELETE FROM storage.objects
   WHERE bucket_id = 'claim-documents'
     AND created_at < now() - interval '90 days';
  ```
- [ ] Archive old claim requests
- [ ] Review and optimize email template if needed

### Quarterly

- [ ] Analyze claim flow metrics:
  - Tier 1 success rate
  - Tier 4 approval rate
  - Time to admin approval
  - User satisfaction
- [ ] Adjust email template if needed
- [ ] Review and update documentation

## Support & Troubleshooting

### Common Issues

**Issue**: Email OTP not arriving
- **Fix**: Check email template configuration (SETUP_EMAIL_TEMPLATES.md)
- **Fix**: Verify email address in listing
- **Fix**: Check spam folder
- **Fix**: Check Supabase logs

**Issue**: Admin can't see claims
- **Fix**: Verify supabaseAdmin is initialized (not null)
- **Fix**: Check user has admin role
- **Fix**: Check RLS policies on claim_requests table

**Issue**: Document upload fails
- **Fix**: Check bucket exists and is private
- **Fix**: Verify file size < 5 MB
- **Fix**: Check CORS configuration

**Issue**: Claim approval hangs
- **Fix**: Check RPC function exists (approve_claim, approve_claim_center)
- **Fix**: Verify service role key is correct
- **Fix**: Check database for constraint violations

## Success Criteria

- [ ] Tier 1 claims (email match) resolve instantly with 99%+ success rate
- [ ] Tier 4 claims (document upload) are reviewed within 1 business day
- [ ] 0 data loss during claim process
- [ ] Admin can approve/reject claims within 1 minute
- [ ] Documents are securely stored and cleaned up
- [ ] Email delivery rate > 95%
- [ ] No production incidents caused by claim system
