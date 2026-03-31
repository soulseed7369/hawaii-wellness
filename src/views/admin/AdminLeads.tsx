/**
 * AdminLeads — marketing leads table ranked by website staleness and missing contact info.
 * Extracted from AdminPanel.tsx for maintainability.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const ISLANDS = [
  { value: 'big_island', label: 'Big Island' },
  { value: 'oahu', label: 'Oahu' },
  { value: 'maui', label: 'Maui' },
  { value: 'kauai', label: 'Kauai' },
  { value: 'molokai', label: 'Molokai' },
];

export function AdminLeads() {
  const [island, setIsland] = useState('all');
  const [minScore, setMinScore] = useState(50);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const fetchTable = async (table: string) => {
        let q = supabase!
          .from(table)
          .select('id, name, first_name, last_name, island, city, email, phone, website_url, website_platform, website_score, no_website_lead, lead_score, tier, status, modalities')
          .gte('lead_score', minScore)
          .order('lead_score', { ascending: false })
          .limit(200);
        if (island !== 'all') q = q.eq('island', island);
        if (noWebsiteOnly) q = q.eq('no_website_lead', true);
        const { data } = await q;
        return (data || []).map(r => ({ ...r, _table: table }));
      };
      const [practs, centers] = await Promise.all([
        fetchTable('practitioners'),
        fetchTable('centers'),
      ]);
      // Merge and sort by lead_score
      const merged = [...practs, ...centers].sort(
        (a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)
      );
      setLeads(merged);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [island, minScore, noWebsiteOnly]);

  const platformBadgeColor = (platform: string | null) => {
    if (!platform || platform === 'none') return 'bg-red-100 text-red-700';
    if (['godaddy', 'weebly', 'strikingly', 'jimdo'].includes(platform))
      return 'bg-orange-100 text-orange-700';
    if (['wix', 'wordpress'].includes(platform))
      return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  const scoreColor = (score: number | null) => {
    if (score === null || score === undefined) return 'text-gray-400';
    if (score >= 75) return 'text-red-600 font-bold';
    if (score >= 50) return 'text-orange-500 font-semibold';
    return 'text-green-600';
  };

  const displayName = (r: any) =>
    r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : r.name;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Marketing Leads</h2>
        <p className="text-sm text-muted-foreground">{leads.length} listings</p>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Listings ranked by website staleness and missing contact info — best targets for selling website upgrades.
      </p>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4 items-center">
        <Select value={island} onValueChange={setIsland}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Islands</SelectItem>
            {ISLANDS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(minScore)} onValueChange={v => setMinScore(Number(v))}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Score ≥ 30 (all)</SelectItem>
            <SelectItem value="50">Score ≥ 50 (warm)</SelectItem>
            <SelectItem value="65">Score ≥ 65 (hot)</SelectItem>
            <SelectItem value="80">Score ≥ 80 (top)</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input type="checkbox" checked={noWebsiteOnly}
            onChange={e => setNoWebsiteOnly(e.target.checked)} className="w-3.5 h-3.5" />
          No website only
        </label>
        <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Hot (75+)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Warm (50–74)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Cool (&lt;50)</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : leads.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No leads found. Run script 22 with <code>--score-leads --apply</code> to populate scores.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 pr-3 font-medium">Name</th>
                <th className="text-left py-2 pr-3 font-medium">Island / City</th>
                <th className="text-left py-2 pr-3 font-medium">Platform</th>
                <th className="text-center py-2 pr-3 font-medium">Site Score</th>
                <th className="text-center py-2 pr-3 font-medium">Lead Score</th>
                <th className="text-left py-2 pr-3 font-medium">Contact</th>
                <th className="text-left py-2 font-medium">Website</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map(r => (
                <tr key={`${r._table}-${r.id}`} className="hover:bg-muted/30 group">
                  <td className="py-2 pr-3">
                    <div className="font-medium leading-tight">{displayName(r)}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {r._table === 'practitioners' ? 'practitioner' : 'center'}
                      {r.no_website_lead && (
                        <span className="ml-1.5 text-red-600 font-semibold">· no website</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    <div>{ISLANDS.find(i => i.value === r.island)?.label ?? r.island}</div>
                    <div className="text-muted-foreground">{r.city}</div>
                  </td>
                  <td className="py-2 pr-3">
                    {r.website_platform ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${platformBadgeColor(r.website_platform)}`}>
                        {r.website_platform}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`py-2 pr-3 text-center text-sm ${scoreColor(r.website_score)}`}>
                    {r.website_score ?? '—'}
                  </td>
                  <td className={`py-2 pr-3 text-center text-sm font-bold ${scoreColor(r.lead_score)}`}>
                    {r.lead_score ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-xs">
                    {r.email ? (
                      <a href={`mailto:${r.email}`}
                        className="text-blue-600 hover:underline truncate block max-w-[160px]">
                        {r.email}
                      </a>
                    ) : (
                      <span className="text-red-500 text-xs">no email</span>
                    )}
                    {r.phone && (
                      <div className="text-muted-foreground">{r.phone}</div>
                    )}
                  </td>
                  <td className="py-2 text-xs">
                    {r.website_url ? (
                      <a href={r.website_url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        <span className="truncate max-w-[140px]">
                          {r.website_url.replace(/^https?:\/\/(www\.)?/, '')}
                        </span>
                      </a>
                    ) : (
                      <span className="text-red-500">no website</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
