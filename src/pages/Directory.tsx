import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProviderCard } from "@/components/ProviderCard";
import { CenterCard } from "@/components/CenterCard";
import { DirectoryMap } from "@/components/DirectoryMap";
import { Skeleton } from "@/components/ui/skeleton";
import { usePractitioners } from "@/hooks/usePractitioners";
import { useCenters, useCentersAsProviders } from "@/hooks/useCenters";
import type { Provider, Center } from "@/data/mockData";
import { Map, Search } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

type DirectoryTab = "practitioners" | "centers";

// ── Island / city lookup for smart search ─────────────────────────────────────

const TOWN_TO_ISLAND: Record<string, string> = {};

const ISLAND_TOWNS: Record<string, string[]> = {
  big_island: [
    'hilo', 'kailua-kona', 'kona', 'waimea', 'captain cook', 'pahoa', 'holualoa',
    'hawi', 'honokaa', 'volcano', 'waikoloa', 'keaau', 'ocean view', 'kapaau',
    'kawaihae', 'na alehu', 'milolii', 'napoopoo', 'kealakekua', 'kamuela',
  ],
  oahu: [
    'honolulu', 'waikiki', 'kailua', 'kaneohe', 'pearl city', 'aiea', 'mililani',
    'kapolei', 'ewa beach', 'haleiwa', 'waipahu', 'hawaii kai', 'manoa', 'nuuanu',
  ],
  maui: [
    'lahaina', 'kihei', 'wailea', 'kahului', 'wailuku', 'hana', 'makawao', 'paia',
    'haiku', 'kula', 'upcountry', 'pukalani', 'napili', 'kapalua', 'kaanapali',
    'lanai city',
  ],
  kauai: [
    'lihue', 'kapaa', 'hanalei', 'princeville', 'poipu', 'koloa', 'hanapepe',
    'waimea', 'eleele', 'kalaheo', 'lawai', 'anahola', 'kilauea', 'haena',
  ],
  molokai: ['kaunakakai', 'hoolehua', 'maunaloa', 'kualapuu', 'halawa', 'pukoo'],
};

for (const [isl, towns] of Object.entries(ISLAND_TOWNS)) {
  for (const town of towns) {
    TOWN_TO_ISLAND[town] = isl;
  }
}

function detectIslandFromText(text: string): string | null {
  const lower = text.toLowerCase();
  // Check explicit island name mentions first
  if (/\bbig island\b/.test(lower)) return 'big_island';
  if (/\boahu\b/.test(lower)) return 'oahu';
  if (/\bmaui\b/.test(lower)) return 'maui';
  if (/\bkauai\b/.test(lower)) return 'kauai';
  if (/\bmolokai\b/.test(lower)) return 'molokai';
  // Then check city names
  for (const [town, isl] of Object.entries(TOWN_TO_ISLAND)) {
    if (lower.includes(town)) return isl;
  }
  return null;
}

const ISLANDS = [
  { value: 'all', label: 'All Islands' },
  { value: 'big_island', label: 'Big Island' },
  { value: 'oahu', label: "Oʻahu" },
  { value: 'maui', label: 'Maui' },
  { value: 'kauai', label: "Kauaʻi" },
  { value: 'molokai', label: "Molokaʻi" },
];

// ── Smart filter with stemming ────────────────────────────────────────────────

// Simple stemmer — strips common English/Hawaiian suffixes to find root
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ing')) return word.slice(0, -3);
  if (word.endsWith('tion')) return word.slice(0, -4);
  if (word.endsWith('ation')) return word.slice(0, -5);
  if (word.endsWith('er')) return word.slice(0, -2);
  if (word.endsWith('ors')) return word.slice(0, -3);
  if (word.endsWith('or')) return word.slice(0, -2);
  if (word.endsWith('ist')) return word.slice(0, -3);
  if (word.endsWith('ists')) return word.slice(0, -4);
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('es')) return word.slice(0, -2);
  if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);
  return word;
}

function tokenMatch(target: string, queryToken: string): boolean {
  const targetLower = target.toLowerCase();
  const tokenLower = queryToken.toLowerCase();
  if (targetLower.includes(tokenLower)) return true;
  // Try stemmed match
  const stemmedToken = stem(tokenLower);
  if (stemmedToken.length >= 3) {
    // Match if any word in target starts with the stem
    const targetWords = targetLower.split(/[\s,\-\/]+/);
    return targetWords.some(w => w.startsWith(stemmedToken) || stem(w).startsWith(stemmedToken));
  }
  return false;
}

function smartFilter(target: string, query: string): boolean {
  if (!query.trim()) return true;
  // Split into tokens, ALL tokens must match (AND logic)
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
  if (tokens.length === 0) return true;
  return tokens.every(token => tokenMatch(target, token));
}

function filterProviders(items: Provider[], query: string): Provider[] {
  if (!query.trim()) return items;
  return items.filter(p =>
    smartFilter(`${p.name} ${p.modality} ${p.location || ''}`, query)
  );
}

function filterCenters(items: Center[], query: string): Center[] {
  if (!query.trim()) return items;
  return items.filter(c =>
    smartFilter(`${c.name} ${c.modality} ${c.location || ''}`, query)
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const Directory = () => {
  usePageMeta("Find Practitioners & Wellness Centers", "Browse certified practitioners, holistic health centers, and spas across the Big Island of Hawaiʻi. Filter by location and modality.");

  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get('q') || '';
  const urlLocation = searchParams.get('location') || '';
  const urlIsland = searchParams.get('island') || 'big_island';

  // Detect island from location/query text for smart search
  const detectedIsland = useMemo(() => {
    const combined = `${urlLocation} ${urlQ}`;
    return detectIslandFromText(combined);
  }, [urlLocation, urlQ]);

  const [tab, setTab] = useState<DirectoryTab>("practitioners");
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState(urlQ);
  const [island, setIsland] = useState(detectedIsland || urlIsland);

  // If smart detection found a different island than what was requested, use it
  useEffect(() => {
    if (detectedIsland && detectedIsland !== urlIsland) {
      setIsland(detectedIsland);
    } else {
      setIsland(urlIsland);
    }
  }, [detectedIsland, urlIsland]);

  // Fetch data for selected island (pass 'big_island' as fallback if 'all')
  const fetchIsland = island === 'all' ? 'big_island' : island;

  const { data: practitioners = [], isLoading: loadingPractitioners } = usePractitioners(fetchIsland);
  const { data: centers = [], isLoading: loadingCenters } = useCenters(fetchIsland);
  const { data: centersAsProviders = [] } = useCentersAsProviders(fetchIsland);

  const isLoading = tab === "practitioners" ? loadingPractitioners : loadingCenters;

  // Combine query text: URL query + location input
  const effectiveQuery = [searchQuery, urlLocation].filter(Boolean).join(' ');

  // Client-side filter
  const filteredPractitioners = useMemo(
    () => filterProviders(practitioners, effectiveQuery),
    [practitioners, effectiveQuery]
  );
  const filteredCenters = useMemo(
    () => filterCenters(centers, effectiveQuery),
    [centers, effectiveQuery]
  );

  // Map locations — only entries with real coordinates (lat != 0 means real)
  const mapLocations = useMemo(() => {
    const raw = tab === "practitioners" ? filteredPractitioners : filteredCenters;
    // Filter to entries with non-default coordinates
    return raw.filter(l => l.lat !== 0 && l.lng !== 0 && l.lat !== 19.8968);
  }, [tab, filteredPractitioners, filteredCenters]);

  const resultCount = tab === "practitioners" ? filteredPractitioners.length : filteredCenters.length;

  // Show cross-island note if smart detection overrode
  const crossIslandNote = detectedIsland && detectedIsland !== urlIsland
    ? `Showing results from ${ISLANDS.find(i => i.value === detectedIsland)?.label} based on your search location.`
    : null;

  return (
    <main className="flex flex-1 flex-col">
      {/* Tab Bar + Controls */}
      <div className="border-b border-border bg-background px-4 py-3">
        <div className="container flex flex-wrap items-center gap-2">
          {/* Island selector */}
          <Select value={island} onValueChange={setIsland}>
            <SelectTrigger className="w-36 flex-shrink-0 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISLANDS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={tab} onValueChange={(v) => setTab(v as DirectoryTab)} className="min-w-0 flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="practitioners" className="flex-1">Individual Practitioners</TabsTrigger>
              <TabsTrigger value="centers" className="flex-1">Spas &amp; Wellness Centers</TabsTrigger>
            </TabsList>
          </Tabs>
          {/* Mobile map toggle */}
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted lg:hidden"
          >
            <Map className="h-4 w-4" />
            {showMap ? "List" : "Map"}
          </button>
        </div>
      </div>

      {/* Split View */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* List */}
        <div className={`flex-1 overflow-y-auto p-4 lg:block lg:max-h-[calc(100vh-8rem)] lg:max-w-lg xl:max-w-xl ${showMap ? "hidden" : "block"}`}>
          {/* Inline search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter by name, modality, city…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {crossIslandNote && (
            <p className="mb-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
              🏝️ {crossIslandNote}
            </p>
          )}

          <p className="mb-4 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${resultCount} result${resultCount !== 1 ? "s" : ""} found`}
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {tab === "practitioners"
                ? filteredPractitioners.map((p) => (
                    <ProviderCard key={p.id} provider={p} />
                  ))
                : filteredCenters.map((c) => (
                    <CenterCard key={c.id} center={c} />
                  ))}

              {resultCount === 0 && (
                <div className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No listings match your search on {ISLANDS.find(i => i.value === island)?.label || 'this island'}.</p>
                  <p className="mt-2 text-xs text-muted-foreground">Try selecting "All Islands" or a different island above.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map */}
        <div className={`flex-1 lg:block ${showMap ? "block" : "hidden"}`} style={{ minHeight: showMap ? "calc(100vh-8rem)" : undefined }}>
          <div className="sticky top-0 h-[calc(100vh-8rem)]">
            <DirectoryMap locations={mapLocations} />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Directory;