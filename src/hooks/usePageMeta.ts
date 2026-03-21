import { useEffect } from 'react';
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '@/lib/siteConfig';

const DEFAULT_OG_IMAGE = 'https://hawaiiwellness.net/hawaii-wellness-logo-OG.png';

/**
 * Lightweight per-route SEO tag manager.
 * Sets <title>, <meta description>, <link rel="canonical">, Open Graph, and Twitter Card tags.
 * No external dependency — works with Vite SPA + Googlebot JS rendering.
 *
 * @param title        Page-level title (site name appended automatically)
 * @param description  Meta description (falls back to site default)
 * @param image        Optional OG/Twitter image URL. Falls back to site logo.
 * @param type         og:type — defaults to 'website'. Use 'profile' on practitioner pages.
 */
export function usePageMeta(
  title: string,
  description?: string,
  image?: string | null,
  type: 'website' | 'profile' | 'article' = 'website',
) {
  useEffect(() => {
    // ── Title ──────────────────────────────────────────────────────────────
    const fullTitle = title.includes(SITE_NAME)
      ? title
      : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    // ── Meta description ───────────────────────────────────────────────────
    const desc = description ?? SITE_DESCRIPTION;
    let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', desc);

    // ── Canonical ──────────────────────────────────────────────────────────
    const canonicalHref = `${SITE_URL}${window.location.pathname === '/' ? '' : window.location.pathname}`;
    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalHref);

    // ── Open Graph ─────────────────────────────────────────────────────────
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', fullTitle);

    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', canonicalHref);

    const ogType = document.querySelector<HTMLMetaElement>('meta[property="og:type"]');
    if (ogType) ogType.setAttribute('content', type);

    const resolvedImage = image || DEFAULT_OG_IMAGE;
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', resolvedImage);

    const ogImageAlt = document.querySelector<HTMLMetaElement>('meta[property="og:image:alt"]');
    if (ogImageAlt) ogImageAlt.setAttribute('content', fullTitle);

    // ── Twitter Card ───────────────────────────────────────────────────────
    const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute('content', fullTitle);

    const twitterDesc = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twitterDesc) twitterDesc.setAttribute('content', desc);

    const twitterImage = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.setAttribute('content', resolvedImage);

    // ── Cleanup: restore defaults on unmount ───────────────────────────────
    return () => {
      document.title = `${SITE_NAME} — Holistic Health Directory`;

      if (ogImage) ogImage.setAttribute('content', DEFAULT_OG_IMAGE);
      if (twitterImage) twitterImage.setAttribute('content', DEFAULT_OG_IMAGE);
      if (ogType) ogType.setAttribute('content', 'website');
    };
  }, [title, description, image, type]);
}
