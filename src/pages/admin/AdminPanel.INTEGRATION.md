# Admin Panel Integration Guide

## Adding Claim Requests Tab to AdminPanel.tsx

### Step 1: Import the new component and hook

At the top of `AdminPanel.tsx`, add:

```typescript
import { AdminClaimRequests } from './AdminClaimRequests';
```

### Step 2: Add "Claims" tab to the main tabs

In the tabs section of AdminPanel (around the tab buttons), add a new button for "Claims":

```typescript
<button
  onClick={() => setActiveTab('claims')}
  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
    activeTab === 'claims'
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`}
>
  <FileText className="h-4 w-4 inline mr-2" />
  Claim Requests
</button>
```

### Step 3: Add the Claims tab content

In the main content area where tabs are rendered (around where Practitioners, Centers, etc. are rendered), add:

```typescript
{activeTab === 'claims' && <AdminClaimRequests />}
```

### Step 4: Update the activeTab type

Change the activeTab type from:
```typescript
type TabName = 'practitioners' | 'centers' | 'retreats' | 'articles' | 'flags' | 'accounts';
```

To:
```typescript
type TabName = 'practitioners' | 'centers' | 'retreats' | 'articles' | 'flags' | 'accounts' | 'claims';
```

### Step 5: Add necessary imports

Ensure these icons are imported in AdminPanel.tsx:
```typescript
import { FileText } from 'lucide-react';
```

## Complete Example Structure

```typescript
// In AdminPanel.tsx render method

<div className="space-y-6">
  <div>
    <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
    <p className="text-muted-foreground">Manage directory content and users</p>
  </div>

  {/* Tabs */}
  <div className="flex gap-2 border-b flex-wrap">
    <button
      onClick={() => setActiveTab('practitioners')}
      className={/* ... */}
    >
      Practitioners
    </button>
    <button
      onClick={() => setActiveTab('centers')}
      className={/* ... */}
    >
      Centers
    </button>
    {/* ... other tabs ... */}
    <button
      onClick={() => setActiveTab('claims')}
      className={/* ... */}
    >
      <FileText className="h-4 w-4 inline mr-2" />
      Claim Requests
    </button>
  </div>

  {/* Tab content */}
  {activeTab === 'practitioners' && <AdminPractitioners />}
  {activeTab === 'centers' && <AdminCenters />}
  {/* ... other tab content ... */}
  {activeTab === 'claims' && <AdminClaimRequests />}
</div>
```

## Styling Notes

The `AdminClaimRequests` component uses Shadcn UI components that should already be imported in your project:
- `Table`, `TableHead`, `TableHeader`, `TableBody`, `TableCell`, `TableRow`
- `Button` (with variants)
- `Input`, `Textarea`
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, etc.
- `Sheet`, `SheetContent`, `SheetDescription`, `SheetHeader`, `SheetTitle`
- `Alert`, `AlertDescription`
- Icons from lucide-react

All of these are already in use in the rest of the codebase, so no additional dependencies are needed.

## Environment Notes

The `useAdminClaims` hook uses `supabaseAdmin` (service role client). Ensure:
1. The admin user has proper access to create/delete claim documents
2. CORS is configured for the claim-documents storage bucket
3. Storage bucket RLS policies are set up per the migration file

## Testing Checklist

- [ ] Admin can view pending claim requests
- [ ] Admin can click to preview document (PDF or image)
- [ ] Admin can approve a claim → listing owner_id is set
- [ ] Admin can reject a claim with notes → user receives email with notes
- [ ] Document is deleted from storage after approve/deny
- [ ] Approved claims move to "Approved" tab
- [ ] Denied claims move to "Denied" tab
- [ ] Notification toast appears on success/error
