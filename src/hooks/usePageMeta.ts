import { useEffect } from 'react';

const SITE_NAME = "Hawa'i Wellness";
const DEFAULT_DESCRIPTION =
  "Discover top practitioners, wellness centers, and retreats on Hawaiʻi's Big Island.";

/**
 * Lightweight per-route title + meta-description setter.
 * No external dependency — works with Vite SPA + Googlebot JS rendering.
 *
 * @param title     Page-level title (site name appended automatically unless already present)
 * @param description  Meta description string (falls back to site default)
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    // Title
    document.title = title.includes(SITE_NAME)
      ? title
      : `${title} | ${SITE_NAME}`;

    // Meta description
    const desc = description ?? DEFAULT_DESCRIPTION;
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', desc);

    // OG title + description sync
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', document.title);
    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    return () => {
      document.title = `${SITE_NAME} — Big Island Wellness Directory`;

    };
  }, [title, description]);
}
