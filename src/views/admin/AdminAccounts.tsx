/**
 * AdminAccounts — user account management and featured slot overview.
 * Extracted from AdminPanel.tsx for maintainability.
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Crown, Star, X, MapPin as MapPinIcon } from 'lucide-react';
import { useAdminAccounts, useSetAccountTier, useAdminFeaturedSlots, useRemoveFeaturedSlot, type AccountTier } from '@/hooks/useAccounts';

const TIER_LABELS: Record<AccountTier, { label: string; color: string; icon: React.ReactNode }> = {
  free:      { label: 'Free',      color: 'bg-gray-100 text-gray-600 border-gray-200',        icon: null },
  premium:   { label: 'Premium',   color: 'bg-blue-100 text-blue-700 border-blue-200',         icon: <Star className="h-3 w-3" /> },
  featured:  { label: 'Featured',  color: 'bg-amber-100 text-amber-700 border-amber-200',      icon: <Crown className="h-3 w-3" /> },
};

const ISLAND_LABELS: Record<string, string> = {
  big_island: 'Big Island',
  oahu:       'Oahu',
  maui:       'Maui',
  kauai:      'Kauai',
  molokai:    'Molokai',
};

export function AdminAccounts() {
  const { data: accounts = [], isLoading: accountsLoading } = useAdminAccounts();
  const { data: featuredSlots, isLoading: slotsLoading } = useAdminFeaturedSlots();
  const setTier = useSetAccountTier();
  const removeSlot = useRemoveFeaturedSlot();
  const [activeSection, setActiveSection] = useState<'users' | 'featured'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<AccountTier | 'all'>('all');

  const filtered = accounts.filter(a => {
    const matchesTier = tierFilter === 'all' || a.tier === tierFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || a.email.toLowerCase().includes(q);
    return matchesTier && matchesSearch;
  });

  function handleSetTier(userId: string, tier: AccountTier) {
    setTier.mutate({ userId, tier }, {
      onSuccess: () => toast.success('Tier updated'),
      onError: (e: Error) => toast.error(e.message),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold flex-1">Account Management</h2>
        <div className="flex gap-2">
          <Button
            variant={activeSection === 'users' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('users')}
          >
            <Users className="h-4 w-4 mr-1.5" />
            Users
          </Button>
          <Button
            variant={activeSection === 'featured' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('featured')}
          >
            <Crown className="h-4 w-4 mr-1.5" />
            Featured Slots
          </Button>
        </div>
      </div>

      {/* ── Users section ── */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search by email…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
            <div className="flex gap-1">
              {(['all', 'free', 'premium', 'featured'] as const).map(t => (
                <Button
                  key={t}
                  variant={tierFilter === t ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs capitalize"
                  onClick={() => setTierFilter(t)}
                >
                  {t === 'all' ? `All (${accounts.length})` : `${t} (${accounts.filter(a => a.tier === t).length})`}
                </Button>
              ))}
            </div>
          </div>

          {accountsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No accounts found.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(account => {
                const tierMeta = TIER_LABELS[account.tier] ?? TIER_LABELS.free;
                return (
                  <Card key={account.id} className="p-0 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4 flex-wrap">
                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm truncate">{account.email}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tierMeta.color}`}>
                              {tierMeta.icon}
                              {tierMeta.label}
                            </span>
                            {account.subscription_status && (
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${
                                account.subscription_status === 'active'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }`}>
                                {account.subscription_status}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span>Joined {new Date(account.created_at).toLocaleDateString()}</span>
                            {account.subscription_period_end && (
                              <span>Renews {new Date(account.subscription_period_end).toLocaleDateString()}</span>
                            )}
                            <span>{account.practitioner_count} practitioner{account.practitioner_count !== 1 ? 's' : ''}</span>
                            <span>{account.center_count} center{account.center_count !== 1 ? 's' : ''}</span>
                          </div>
                          {/* Listings */}
                          {account.listings.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {account.listings.map(l => (
                                <span key={l.id} className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                                  <MapPinIcon className="h-2.5 w-2.5 text-gray-400" />
                                  {l.name}
                                  <span className={`ml-0.5 ${l.status === 'published' ? 'text-green-600' : 'text-gray-400'}`}>
                                    ({l.status})
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Tier override */}
                        <div className="flex-shrink-0">
                          <Select
                            value={account.tier}
                            onValueChange={(v) => handleSetTier(account.id, v as AccountTier)}
                            disabled={setTier.isPending}
                          >
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                              <SelectItem value="featured">Featured</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-gray-400 mt-1 text-center">Override tier</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Featured Slots section ── */}
      {activeSection === 'featured' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Up to 5 featured listings per island. Featured listings rotate randomly on the homepage.
          </p>
          {slotsLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(ISLAND_LABELS).map(([islandKey, islandLabel]) => {
                const islandData = featuredSlots?.[islandKey] ?? { slots: [], remaining: 5 };
                const occupancy = islandData.slots.length;
                const capacity = 5;
                const pct = Math.round((occupancy / capacity) * 100);

                return (
                  <Card key={islandKey} className="p-0 overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{islandLabel}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          occupancy >= capacity
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : occupancy > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>
                          {occupancy}/{capacity} slots
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            occupancy >= capacity ? 'bg-red-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Slot list */}
                      {islandData.slots.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">No featured listings</p>
                      ) : (
                        <div className="space-y-1.5">
                          {islandData.slots.map(slot => (
                            <div key={slot.id} className="flex items-center gap-2 bg-amber-50 rounded px-2 py-1.5">
                              <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{slot.listing_name ?? slot.listing_id}</p>
                                <p className="text-[10px] text-gray-500 truncate">{slot.owner_email ?? 'unknown owner'}</p>
                              </div>
                              <span className="text-[10px] text-gray-400 flex-shrink-0 capitalize">{slot.listing_type}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                                disabled={removeSlot.isPending}
                                onClick={() => {
                                  removeSlot.mutate(slot.id, {
                                    onSuccess: () => toast.success(`Removed ${slot.listing_name ?? 'slot'}`),
                                    onError: (e: Error) => toast.error(e.message),
                                  });
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Remaining indicator */}
                      {islandData.remaining > 0 && (
                        <p className="text-[11px] text-gray-400 text-center">
                          {islandData.remaining} slot{islandData.remaining !== 1 ? 's' : ''} available
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
