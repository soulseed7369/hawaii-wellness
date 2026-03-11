import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, LocateFixed, X, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-homepage.jpg";
import { useAliasMap } from "@/hooks/useSearchListings";

const ISLAND_OPTIONS = [
  { value: 'all', label: 'All Islands' },
  { value: 'big_island', label: 'Big Island' },
  { value: 'oahu', label: "Oʻahu" },
  { value: 'maui', label: 'Maui' },
  { value: 'kauai', label: "Kauaʻi" },
];

// Popular searches grouped by theme — shown as quick-tap chips below the search box
const POPULAR_SEARCHES: { label: string; emoji: string }[] = [
  { label: 'Yoga', emoji: '🧘' },
  { label: 'Massage', emoji: '💆' },
  { label: 'Reiki', emoji: '✨' },
  { label: 'Breathwork', emoji: '🌬️' },
  { label: 'Sound Healing', emoji: '🎵' },
  { label: 'Acupuncture', emoji: '🪡' },
  { label: 'Life Coaching', emoji: '🌱' },
  { label: 'Naturopathic', emoji: '🌿' },
];

const AXIS_LABELS: Record<string, string> = {
  modality: 'Modality',
  concern: 'Concern',
  approach: 'Approach',
  format: 'Format',
  audience: 'Audience',
};

const LOCATION_STORAGE_KEY = 'aloha_user_location';

interface Suggestion {
  id: number;
  label: string;
  axis: string;
}

interface SearchBarProps {
  island?: string;
  heroImageUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
}

export function SearchBar({
  island: initialIsland = 'big_island',
  heroImageUrl,
  heroTitle = "Find Your Path to Wellness",
  heroSubtitle = "Discover holistic practitioners, retreats & wellness centers across Hawai'i",
}: SearchBarProps = {}) {
  const navigate = useNavigate();
  const [what, setWhat] = useState('');
  const [island, setIsland] = useState(initialIsland);
  const [debouncedWhat, setDebouncedWhat] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Geolocation state ──────────────────────────────────────────────────────
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);

  // Restore saved location on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (saved) {
        const { lat, lng } = JSON.parse(saved);
        if (typeof lat === 'number' && typeof lng === 'number') {
          setUserLat(lat);
          setUserLng(lng);
        }
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLng(longitude);
        localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify({ lat: latitude, lng: longitude }));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const handleClearLocation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUserLat(null);
    setUserLng(null);
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  };

  // ── Autocomplete ────────────────────────────────────────────────────────────
  const { aliasMap } = useAliasMap();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedWhat(what), 200);
    return () => clearTimeout(t);
  }, [what]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!aliasMap || debouncedWhat.length < 2) return [];
    const q = debouncedWhat.toLowerCase();
    const seen = new Set<number>();
    const results: Suggestion[] = [];

    for (const [key, term] of aliasMap) {
      if (seen.has(term.id)) continue;
      if (key.includes(q) || term.label.toLowerCase().includes(q)) {
        seen.add(term.id);
        results.push({ id: term.id, label: term.label, axis: term.axis });
      }
      if (results.length >= 8) break;
    }
    return results;
  }, [aliasMap, debouncedWhat]);

  const grouped = useMemo(() => {
    const groups: Record<string, Suggestion[]> = {};
    for (const s of suggestions) {
      if (!groups[s.axis]) groups[s.axis] = [];
      groups[s.axis].push(s);
    }
    return groups;
  }, [suggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((label: string) => {
    setWhat(label);
    setIsOpen(false);
    setHighlightIdx(-1);
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleSearch = (overrideWhat?: string) => {
    setIsOpen(false);
    const params = new URLSearchParams();
    const q = overrideWhat ?? what.trim();
    if (q) params.set('q', q);
    if (island && island !== 'all') params.set('island', island);
    if (userLat !== null && userLng !== null) {
      params.set('ulat', String(userLat));
      params.set('ulng', String(userLng));
    }
    navigate(`/directory?${params.toString()}`);
  };

  const handleChipClick = (label: string) => {
    setWhat(label);
    handleSearch(label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setIsOpen(false); return; }
    if (e.key === 'Enter') {
      if (highlightIdx >= 0 && highlightIdx < suggestions.length) {
        handleSelect(suggestions[highlightIdx].label);
        e.preventDefault();
        return;
      }
      handleSearch();
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
  };

  const hasLocation = userLat !== null && userLng !== null;
  const bgImage = heroImageUrl || heroImage;
  const showDropdown = isOpen && suggestions.length > 0;

  return (
    // overflow-x-hidden keeps the bg image edges clipped horizontally
    // but does NOT clip the autocomplete dropdown vertically
    <section className="relative overflow-x-hidden py-20 md:py-28">
      <img
        src={bgImage}
        alt="Hawaii wellness"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-foreground/45" />
      <div className="container relative z-10">
        <h1 className="mb-2 text-center font-display text-3xl font-bold text-primary-foreground md:text-5xl">
          {heroTitle}
        </h1>
        <p className="mb-6 text-center text-lg text-primary-foreground/85">
          {heroSubtitle}
        </p>

        {/* ── Search box ─────────────────────────────────────── */}
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-3 rounded-xl bg-background/80 p-5 shadow-xl backdrop-blur-md sm:flex-row sm:items-center">

            {/* What — with autocomplete */}
            <div className="relative flex-1" ref={wrapperRef}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Modality, concern, or name…"
                className="h-12 border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0"
                value={what}
                onChange={e => { setWhat(e.target.value); setIsOpen(true); setHighlightIdx(-1); }}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
                autoComplete="off"
              />
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto rounded-lg border bg-background shadow-xl">
                  {Object.entries(grouped).map(([axis, items]) => (
                    <div key={axis}>
                      <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {AXIS_LABELS[axis] || axis}
                      </div>
                      {items.map(item => {
                        const flatIdx = suggestions.indexOf(item);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${flatIdx === highlightIdx ? 'bg-accent' : ''}`}
                            onMouseDown={() => handleSelect(item.label)}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden h-10 w-px bg-border sm:block" />

            {/* Near me button */}
            <button
              type="button"
              onClick={hasLocation ? undefined : handleLocate}
              disabled={locating}
              title={hasLocation ? "Location set — click × to clear" : "Use my current location"}
              className={`flex flex-shrink-0 items-center gap-2 rounded-lg px-4 h-12 text-sm font-medium transition-colors border
                ${hasLocation
                  ? 'border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                  : 'border-input bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground'
                }
              `}
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasLocation ? (
                <MapPin className="h-4 w-4 flex-shrink-0 text-green-600" />
              ) : (
                <LocateFixed className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {locating ? 'Locating…' : hasLocation ? 'Near me ✓' : 'Near me'}
              </span>
              {hasLocation && (
                <span
                  role="button"
                  aria-label="Clear location"
                  onClick={handleClearLocation}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-green-200 dark:hover:bg-green-800"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>

            <div className="hidden h-10 w-px bg-border sm:block" />

            {/* Island selector */}
            <Select value={island} onValueChange={setIsland}>
              <SelectTrigger className="h-12 border-0 bg-transparent text-sm shadow-none focus:ring-0 w-36 flex-shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISLAND_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button className="h-12 sm:px-8 flex-shrink-0" onClick={() => handleSearch()}>
              Search
            </Button>
          </div>

          {/* ── Popular search chips ──────────────────────────── */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-primary-foreground/60 font-medium">Try:</span>
            {POPULAR_SEARCHES.map(({ label, emoji }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleChipClick(label)}
                className="flex items-center gap-1 rounded-full bg-background/20 px-3 py-1 text-xs font-medium text-primary-foreground backdrop-blur-sm transition-colors hover:bg-background/35 border border-primary-foreground/20"
              >
                <span>{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
