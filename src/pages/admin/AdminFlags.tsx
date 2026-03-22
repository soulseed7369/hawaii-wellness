/**
 * AdminFlags — review and manage user-submitted listing reports.
 * Extracted from AdminPanel.tsx for maintainability.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Trash2, ExternalLink, Flag } from 'lucide-react';
import { useAdminFlags, useUpdateFlag, useDeleteFlag, type FlagStatus } from '@/hooks/useListingFlags';

const REASON_LABELS: Record<string, string> = {
  closed:     '🚫 Closed / Inactive',
  inaccurate: '✏️ Inaccurate Info',
  duplicate:  '📋 Duplicate',
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  reviewed:  'bg-blue-100 text-blue-800 border-blue-200',
  dismissed: 'bg-gray-100 text-gray-500 border-gray-200',
};

export function AdminFlags() {
  const [flagStatusFilter, setFlagStatusFilter] = useState<FlagStatus | 'all'>('pending');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const { data: flags = [], isLoading: flagsLoading } = useAdminFlags(
    flagStatusFilter === 'all' ? undefined : flagStatusFilter
  );
  const updateFlag = useUpdateFlag();
  const deleteFlag = useDeleteFlag();

  const handleUpdateStatus = (id: string, status: FlagStatus) => {
    updateFlag.mutate({ id, status, admin_notes: adminNotes[id] });
  };

  const pendingCount = flags.filter(f => f.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Reported Listings</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {pendingCount} pending
            </span>
          )}
        </div>
        <Select
          value={flagStatusFilter}
          onValueChange={v => setFlagStatusFilter(v as FlagStatus | 'all')}
        >
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All flags</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {flagsLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Flag className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm">No {flagStatusFilter !== 'all' ? flagStatusFilter : ''} flags</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map(flag => (
            <div key={flag.id} className="rounded-lg border bg-white p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{flag.listing_name || 'Unknown listing'}</span>
                    <span className="text-xs text-gray-400 capitalize">{flag.listing_type}</span>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[flag.status]}`}>
                      {flag.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs font-medium text-gray-700">
                      {REASON_LABELS[flag.reason] ?? flag.reason}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(flag.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                    {flag.reporter_email && (
                      <span className="text-xs text-gray-400">{flag.reporter_email}</span>
                    )}
                  </div>
                  {flag.details && (
                    <p className="mt-1.5 text-xs text-gray-600 italic">"{flag.details}"</p>
                  )}
                </div>
                {flag.listing_type === 'practitioner' && (
                  <a
                    href={`/profile/${flag.listing_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" /> View
                  </a>
                )}
              </div>

              {/* Admin notes */}
              <Input
                placeholder="Admin notes (optional)"
                value={adminNotes[flag.id] ?? flag.admin_notes ?? ''}
                onChange={e => setAdminNotes(prev => ({ ...prev, [flag.id]: e.target.value }))}
                className="text-xs h-8"
              />

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {flag.status !== 'reviewed' && (
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                    disabled={updateFlag.isPending}
                    onClick={() => handleUpdateStatus(flag.id, 'reviewed')}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark reviewed
                  </Button>
                )}
                {flag.status !== 'dismissed' && (
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs text-gray-600 border-gray-300 hover:bg-gray-50"
                    disabled={updateFlag.isPending}
                    onClick={() => handleUpdateStatus(flag.id, 'dismissed')}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Dismiss
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost"
                  className="h-7 text-xs text-gray-400 hover:text-red-500 ml-auto"
                  disabled={deleteFlag.isPending}
                  onClick={() => deleteFlag.mutate(flag.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove flag
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
