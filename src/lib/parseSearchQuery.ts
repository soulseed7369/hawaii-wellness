export interface TaxonomyTerm {
  id: number;
  slug: string;
  label: string;
  axis: 'modality' | 'concern' | 'approach' | 'format' | 'audience';
}

/** Lowercased alias string → TaxonomyTerm */
export type AliasMap = Map<string, TaxonomyTerm>;

export interface SearchIntent {
  freeText: string;           // residual text for FTS
  modalities: number[];       // term IDs
  concerns: number[];
  approaches: number[];
  formats: number[];
  audiences: number[];
  island: string | null;      // e.g. 'big_island', 'maui'
  city: string | null;        // e.g. 'Kailua-Kona', 'Hilo'
}

const TOWN_TO_ISLAND: Record<string, { island: string; city: string }> = {
  'kona': { island: 'big_island', city: 'Kailua-Kona' },
  'kailua-kona': { island: 'big_island', city: 'Kailua-Kona' },
  'kailua kona': { island: 'big_island', city: 'Kailua-Kona' },
  'hilo': { island: 'big_island', city: 'Hilo' },
  'waimea': { island: 'big_island', city: 'Waimea/Kamuela' },
  'kamuela': { island: 'big_island', city: 'Waimea/Kamuela' },
  'pahoa': { island: 'big_island', city: 'Pahoa' },
  'captain cook': { island: 'big_island', city: 'Captain Cook' },
  'volcano': { island: 'big_island', city: 'Volcano' },
  'waikoloa': { island: 'big_island', city: 'Waikoloa' },
  'lahaina': { island: 'maui', city: 'Lahaina' },
  'kihei': { island: 'maui', city: 'Kihei' },
  'wailea': { island: 'maui', city: 'Wailea' },
  'kahului': { island: 'maui', city: 'Kahului' },
  'wailuku': { island: 'maui', city: 'Wailuku' },
  'makawao': { island: 'maui', city: 'Makawao' },
  'paia': { island: 'maui', city: 'Paia' },
  'haiku': { island: 'maui', city: 'Haiku' },
  'hana': { island: 'maui', city: 'Hana' },
  'honolulu': { island: 'oahu', city: 'Honolulu' },
  'waikiki': { island: 'oahu', city: 'Waikiki' },
  'kailua': { island: 'oahu', city: 'Kailua' },
  'kaneohe': { island: 'oahu', city: 'Kaneohe' },
  'kapolei': { island: 'oahu', city: 'Kapolei' },
  'haleiwa': { island: 'oahu', city: 'Haleiwa' },
  'hawaii kai': { island: 'oahu', city: 'Hawaii Kai' },
  'lihue': { island: 'kauai', city: 'Lihue' },
  'kapaa': { island: 'kauai', city: 'Kapaa' },
  'hanalei': { island: 'kauai', city: 'Hanalei' },
  'princeville': { island: 'kauai', city: 'Princeville' },
  'poipu': { island: 'kauai', city: 'Poipu' },
  'koloa': { island: 'kauai', city: 'Koloa' },
  'big island': { island: 'big_island', city: '' },
  'maui': { island: 'maui', city: '' },
  'oahu': { island: 'oahu', city: '' },
  'kauai': { island: 'kauai', city: '' },
};

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'for', 'of', 'to', 'and', 'or',
  'near', 'with', 'my', 'me', 'i', 'need', 'want', 'looking', 'find',
  'help', 'something', 'someone', 'around',
]);

/**
 * Parse a natural language query into a structured SearchIntent.
 *
 * Algorithm:
 * 1. Normalize & tokenize
 * 2. Try 3-gram → 2-gram → 1-gram matching against alias map (taxonomy terms)
 * 3. Match remaining tokens against geography (island/city)
 * 4. Any leftover tokens become freeText for Postgres FTS
 */
export function parseSearchQuery(query: string, aliasMap: AliasMap): SearchIntent {
  const intent: SearchIntent = {
    freeText: '',
    modalities: [],
    concerns: [],
    approaches: [],
    formats: [],
    audiences: [],
    island: null,
    city: null,
  };

  // Normalize: lowercase, strip punctuation except hyphens (for multi-word slugs)
  const normalized = query.toLowerCase().replace(/[^\w\s-]/g, '').trim();
  if (!normalized) return intent;

  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return intent;

  // Track consumed token indices
  const consumed = new Set<number>();

  // ── Phase 1: Geography detection (check multi-word first) ──────────
  // Check 2-grams for geography (e.g., "big island", "captain cook", "hawaii kai")
  for (let i = 0; i < tokens.length - 1; i++) {
    const phrase = `${tokens[i]} ${tokens[i + 1]}`;
    const geo = TOWN_TO_ISLAND[phrase];
    if (geo && !intent.island) {
      intent.island = geo.island;
      if (geo.city) intent.city = geo.city;
      consumed.add(i);
      consumed.add(i + 1);
    }
  }
  // Check 1-grams for geography
  for (let i = 0; i < tokens.length; i++) {
    if (consumed.has(i)) continue;
    const geo = TOWN_TO_ISLAND[tokens[i]];
    if (geo && !intent.island) {
      intent.island = geo.island;
      if (geo.city) intent.city = geo.city;
      consumed.add(i);
    }
  }

  // ── Phase 2: Remove stop words from remaining tokens ───────────────
  // (Mark them consumed so they don't appear in freeText or alias matching)
  for (let i = 0; i < tokens.length; i++) {
    if (!consumed.has(i) && STOP_WORDS.has(tokens[i])) {
      consumed.add(i);
    }
  }

  // ── Phase 3: Alias matching (3-gram → 2-gram → 1-gram) ────────────
  const addToAxis = (term: TaxonomyTerm) => {
    const arr = intent[`${term.axis === 'modality' ? 'modalities' :
      term.axis === 'concern' ? 'concerns' :
      term.axis === 'approach' ? 'approaches' :
      term.axis === 'format' ? 'formats' : 'audiences'}`] as number[];
    if (!arr.includes(term.id)) {
      arr.push(term.id);
    }
  };

  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i <= tokens.length - n; i++) {
      // Skip if any token in this n-gram is already consumed
      let anyConsumed = false;
      for (let j = i; j < i + n; j++) {
        if (consumed.has(j)) { anyConsumed = true; break; }
      }
      if (anyConsumed) continue;

      const phrase = tokens.slice(i, i + n).join(' ');
      const term = aliasMap.get(phrase);
      if (term) {
        addToAxis(term);
        for (let j = i; j < i + n; j++) consumed.add(j);
      }
    }
  }

  // ── Phase 4: Remaining tokens → freeText ───────────────────────────
  const remaining = tokens.filter((_, i) => !consumed.has(i));
  intent.freeText = remaining.join(' ');

  return intent;
}
