/**
 * Breadcrumb generation utilities for practitioner and center profiles.
 * Provides both navigational breadcrumbs and schema.org BreadcrumbList schemas.
 */

export const ISLAND_LABEL: Record<string, string> = {
  big_island: 'Big Island',
  maui: 'Maui',
  oahu: 'Oʻahu',
  kauai: 'Kauaʻi',
};

export const ISLAND_SLUG: Record<string, string> = {
  big_island: 'big-island',
  maui: 'maui',
  oahu: 'oahu',
  kauai: 'kauai',
};

export interface BreadcrumbItem {
  name: string;
  url: string;
  position: number;
}

/**
 * Generates a breadcrumb path for a practitioner profile.
 * Home > Directory > [Island] > [Top Modality] > [Practitioner Name]
 */
export function generateProfileBreadcrumb(p: {
  id: string;
  name: string;
  island: string;
  modalities?: string[] | null;
}): BreadcrumbItem[] {
  const islandName = ISLAND_LABEL[p.island] ?? 'Hawaiʻi';
  const islandSlug = ISLAND_SLUG[p.island] ?? p.island.replace('_', '-');
  const topModality = p.modalities?.[0] || 'Wellness';

  return [
    { name: 'Home', url: '/', position: 1 },
    { name: 'Directory', url: '/directory', position: 2 },
    { name: islandName, url: `/${islandSlug}`, position: 3 },
    {
      name: topModality,
      url: `/directory?modality=${encodeURIComponent(topModality)}&island=${p.island}`,
      position: 4,
    },
    { name: p.name, url: `/profile/${p.id}`, position: 5 },
  ];
}

/**
 * Generates a breadcrumb path for a wellness center profile.
 * Home > Directory > [Island] > [Center Type] > [Center Name]
 */
export function generateCenterBreadcrumb(c: {
  id: string;
  name: string;
  island: string;
  center_type?: string | null;
}): BreadcrumbItem[] {
  const islandName = ISLAND_LABEL[c.island] ?? 'Hawaiʻi';
  const islandSlug = ISLAND_SLUG[c.island] ?? c.island.replace('_', '-');
  const typeLabel = c.center_type
    ? c.center_type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Wellness Center';

  return [
    { name: 'Home', url: '/', position: 1 },
    { name: 'Directory', url: '/directory', position: 2 },
    { name: islandName, url: `/${islandSlug}`, position: 3 },
    {
      name: typeLabel,
      url: `/directory?island=${c.island}`,
      position: 4,
    },
    { name: c.name, url: `/center/${c.id}`, position: 5 },
  ];
}

/**
 * Converts breadcrumb items into a schema.org BreadcrumbList structured data object.
 */
export function breadcrumbSchema(
  items: BreadcrumbItem[],
  siteUrl = 'https://hawaiiwellness.net'
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      item: `${siteUrl}${item.url}`,
    })),
  };
}
