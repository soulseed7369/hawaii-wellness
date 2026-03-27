import React, { useState } from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ALL_MODALITIES } from '@/lib/modalities';

export type ModalityTier = 'free' | 'premium' | 'featured';

interface RankedModalitiesProps {
  modalities: string[];
  tier: ModalityTier;
  onChange: (modalities: string[]) => void;
}

/**
 * RankedModalities component — two-zone UI for modality ranking
 *
 * TIER LIMITS:
 *   Free tier: top 2 modalities are searchable
 *   Premium tier: top 5 modalities are searchable
 *   Featured tier: all modalities are searchable
 *
 * BEHAVIOR:
 *   - Providers can select all 44 modalities in the dashboard
 *   - Only the top N (based on tier) are indexed in listing_modalities join table
 *   - Search RPC queries listing_modalities, so tier limit is enforced at query time
 *   - When user upgrades tier, their next profile save triggers re-sync of modality ranks
 *
 * UI ZONES:
 *   - "Active in Search": shows modalities that will be searchable (top N based on tier)
 *   - "Not searched": shows additional selected modalities that won't appear in results
 *     (disabled color, ready to activate on tier upgrade)
 */
export const RankedModalities: React.FC<RankedModalitiesProps> = ({ modalities, tier, onChange }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const getTierLimit = (tierType: ModalityTier): number => {
    switch (tierType) {
      case 'featured': return modalities.length; // all
      case 'premium': return 5;
      case 'free': return 2;
      default: return 2;
    }
  };

  const tierLimit = getTierLimit(tier);
  const activeModalities = modalities.slice(0, tierLimit);
  const inactiveModalities = modalities.slice(tierLimit);

  // Available modalities not yet selected
  const availableModalities = ALL_MODALITIES.filter(m => !modalities.includes(m));
  const filteredAvailable = searchQuery
    ? availableModalities.filter(m => m.toLowerCase().includes(searchQuery.toLowerCase()))
    : availableModalities;

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newMods = [...modalities];
    [newMods[index], newMods[index - 1]] = [newMods[index - 1], newMods[index]];
    onChange(newMods);
  };

  const moveDown = (index: number) => {
    if (index >= modalities.length - 1) return;
    const newMods = [...modalities];
    [newMods[index], newMods[index + 1]] = [newMods[index + 1], newMods[index]];
    onChange(newMods);
  };

  const remove = (index: number) => {
    const newMods = modalities.filter((_, i) => i !== index);
    onChange(newMods);
  };

  const add = (modalityName: string) => {
    if (!modalities.includes(modalityName)) {
      onChange([...modalities, modalityName]);
      setSearchQuery('');
    }
  };

  const getTierLabel = (): string => {
    switch (tier) {
      case 'free': return 'Free (Top 2 searchable)';
      case 'premium': return 'Premium (Top 5 searchable)';
      case 'featured': return 'Featured (All searchable)';
      default: return '';
    }
  };

  const getUpgradeMessage = (): string | null => {
    if (tier === 'free' && modalities.length > 2) {
      return 'You have selected more than your tier limit allows. Only your top 2 will appear in search. Upgrade to Premium for 5 searchable modalities.';
    }
    if (tier === 'premium' && modalities.length > 5) {
      return 'You have selected more than your tier limit allows. Only your top 5 will appear in search. Upgrade to Featured for all modalities to be searchable.';
    }
    return null;
  };

  const upgradeMessage = getUpgradeMessage();

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Search Ranking — {getTierLabel()}</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Drag to reorder or use arrow buttons. Your top modalities appear in search results.
          Select more below even if not searchable now — they'll activate when you upgrade.
        </p>
      </div>

      {/* Active in Search Zone */}
      <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <h3 className="font-semibold text-sm mb-3 text-primary">Active in Search (Top {tierLimit})</h3>
        {modalities.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4">No modalities selected yet. Add one below.</p>
        ) : (
          <div className="space-y-2">
            {modalities.map((modality, index) => {
              const isActive = index < tierLimit;
              return (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    isActive
                      ? 'bg-white border-primary/20 shadow-sm'
                      : 'bg-muted/40 border-muted-foreground/20 opacity-60'
                  }`}
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{modality}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === modalities.length - 1}
                      className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Tier limit warning */}
      {upgradeMessage && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
          {upgradeMessage}
        </div>
      )}

      {/* Add More Modalities */}
      <div className="space-y-3 pt-2">
        <Label className="text-sm font-semibold">Add More Modalities</Label>
        <Input
          placeholder="Search modalities..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 border border-dashed border-border rounded-lg bg-muted/20">
          {filteredAvailable.length === 0 ? (
            <p className="col-span-full text-xs text-muted-foreground py-4 text-center">
              {searchQuery ? 'No matching modalities' : 'All modalities added'}
            </p>
          ) : (
            filteredAvailable.map(modalityName => (
              <button
                key={modalityName}
                type="button"
                onClick={() => add(modalityName)}
                className="text-xs py-1.5 px-2 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left truncate"
              >
                {modalityName}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Summary */}
      {modalities.length > 0 && (
        <div className="pt-2 text-xs text-muted-foreground italic">
          Selected: {modalities.length} modalities
          {modalities.length > tierLimit && (
            <span className="block text-amber-600 font-medium mt-1">
              ⚠ Top {tierLimit} will be searchable with your {tier} tier
            </span>
          )}
        </div>
      )}
    </div>
  );
};
