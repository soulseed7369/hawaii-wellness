import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Generate a stable session hash for deduplication (no PII)
function getSessionHash(): string {
  let hash = sessionStorage.getItem('aloha_session_hash');
  if (!hash) {
    hash = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem('aloha_session_hash', hash);
  }
  return hash;
}

/** Track a profile/center page view. Call once on mount. */
export function useTrackView(listingId: string | undefined, listingType: 'practitioner' | 'center', referrer?: string) {
  const tracked = useRef(false);
  useEffect(() => {
    if (!listingId || tracked.current || !supabase) return;

    // Client-side dedup: skip if already counted this listing in this browser session
    const dedupKey = `tracked_view_${listingId}`;
    if (sessionStorage.getItem(dedupKey)) { tracked.current = true; return; }

    tracked.current = true;
    sessionStorage.setItem(dedupKey, '1');

    supabase.from('listing_views').insert({
      listing_id: listingId,
      listing_type: listingType,
      referrer: referrer || document.referrer || 'direct',
      session_hash: getSessionHash(),
    }).then(() => {}); // fire and forget — analytics must never break the app
  }, [listingId, listingType, referrer]);
}

/** Returns a callback to track contact CTA clicks (website, booking, etc.). */
export function useTrackClick(listingId: string | undefined, listingType: 'practitioner' | 'center') {
  return useCallback((clickType: 'phone' | 'email' | 'website' | 'booking' | 'discovery_call') => {
    if (!listingId || !supabase) return;
    supabase.from('contact_clicks').insert({
      listing_id: listingId,
      listing_type: listingType,
      click_type: clickType,
    }).then(() => {}); // fire and forget
  }, [listingId, listingType]);
}

/**
 * Standalone (non-hook) version for use inside async component handlers.
 * Used by ContactReveal to log phone/email reveals.
 */
export function trackContactClick(
  listingId: string,
  listingType: 'practitioner' | 'center',
  clickType: 'phone' | 'email' | 'website' | 'booking' | 'discovery_call',
) {
  if (!supabase) return;
  supabase.from('contact_clicks').insert({
    listing_id: listingId,
    listing_type: listingType,
    click_type: clickType,
  }).then(() => {}); // fire and forget
}

/** Track batch impressions (for directory/homepage). */
export function trackImpressions(items: Array<{ listing_id: string; listing_type: string; impression_type: string }>) {
  if (!supabase || items.length === 0) return;
  supabase.from('listing_impressions').insert(items).then(() => {}); // fire and forget
}
