interface Profile {
  name?: string | null;
  bio?: string | null;
  photo_url?: string | null;
  modalities?: string[] | null;
  city?: string | null;
  island?: string | null;
  session_type?: string | null;
  website_url?: string | null;
}

/**
 * Calculates profile completeness as a percentage (0-100).
 *
 * Scoring breakdown:
 * - name: 15 points
 * - bio (>20 chars): 20 points
 * - photo_url: 15 points
 * - modalities (≥1): 15 points
 * - city: 10 points
 * - session_type: 10 points
 * - website_url: 10 points
 * - island: 5 points
 *
 * Total: 100 points
 */
export function calculateCompleteness(p: Profile): number {
  return [
    { weight: 15, pass: !!p.name },
    { weight: 20, pass: !!p.bio && (p.bio.trim().length ?? 0) > 20 },
    { weight: 15, pass: !!p.photo_url },
    { weight: 15, pass: !!p.modalities && p.modalities.length > 0 },
    { weight: 10, pass: !!p.city },
    { weight: 10, pass: !!p.session_type },
    { weight: 10, pass: !!p.website_url },
    { weight: 5, pass: !!p.island },
  ].reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0);
}

/**
 * Minimum completeness score required for search indexing and organic visibility.
 * Profiles below this threshold receive "noindex" meta tag.
 */
export const COMPLETENESS_THRESHOLD = 60;

/**
 * Determines if a profile is complete enough to be indexed by search engines.
 */
export function isIndexable(p: Profile): boolean {
  return calculateCompleteness(p) >= COMPLETENESS_THRESHOLD;
}
