// ── Website Package definitions (Kamaʻāina Rate pricing) ─────────────────────

export interface Package {
  id: 'essentials' | 'standard' | 'pro';
  name: string;
  price: number;
  kamaaiaPrice: number;
  features: string[];
  includedSubscription: string;
  highlight?: boolean;
  mailto: string;
}

export const PACKAGES: Package[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    price: 597,
    kamaaiaPrice: 497,
    features: [
      '3–4 page site (Home, About, Services, Contact)',
      'Mobile-responsive design',
      'Contact form',
      'Linked to your Hawaiʻi Wellness directory profile',
    ],
    includedSubscription: 'Includes 6 months Premium subscription ($294 value)',
    mailto: 'mailto:aloha@hawaiiwellness.net?subject=Website%20Bundle%20—%20Essentials',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 997,
    kamaaiaPrice: 897,
    features: [
      '5-page site',
      'Booking integration (Calendly / Acuity embed)',
      'Google Business Profile setup',
      'Basic SEO optimization (meta tags, local schema, Google indexing)',
      '2 rounds of revisions',
    ],
    includedSubscription: 'Includes 12 months Premium subscription ($588 value)',
    highlight: true,
    mailto: 'mailto:aloha@hawaiiwellness.net?subject=Website%20Bundle%20—%20Standard',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 1497,
    kamaaiaPrice: 1397,
    features: [
      'Everything in Standard, plus:',
      'Blog page',
      'Advanced SEO (keyword research, internal linking, image optimization, sitemap)',
      'AI search optimization (FAQ schema, service schema, LocalBusiness structured data)',
      'Social media header graphics',
      '3 rounds of revisions',
    ],
    includedSubscription: 'Includes 12 months Premium subscription ($588 value)',
    mailto: 'mailto:aloha@hawaiiwellness.net?subject=Website%20Bundle%20—%20Pro',
  },
];

// ── Add-on categories ────────────────────────────────────────────────────────

export interface AddOn {
  name: string;
  price: string;
}

export interface AddOnCategory {
  title: string;
  icon: string;
  items: AddOn[];
}

export const ADD_ON_CATEGORIES: AddOnCategory[] = [
  {
    title: 'Content & Design',
    icon: 'Paintbrush',
    items: [
      { name: 'Extra page', price: '$100' },
      { name: 'Copywriting', price: 'Included' },
      { name: 'Gallery section', price: 'Included' },
      { name: 'Logo design', price: '$150–$300' },
    ],
  },
  {
    title: 'Marketing',
    icon: 'TrendingUp',
    items: [
      { name: 'Local SEO boost', price: '$250–$500' },
      { name: 'Google Business Profile optimization', price: '$150' },
      { name: 'Email signup setup', price: '$150–$300' },
      { name: 'Lead magnet setup', price: '$150' },
    ],
  },
  {
    title: 'Functionality',
    icon: 'Puzzle',
    items: [
      { name: 'Booking integration', price: '$100' },
      { name: 'Payments integration', price: '$150' },
      { name: 'Intake form setup', price: '$150–$300' },
      { name: 'Events or workshop page', price: '$150' },
    ],
  },
  {
    title: 'Ongoing Support',
    icon: 'LifeBuoy',
    items: [
      { name: 'Monthly content updates', price: '$50–$150/mo' },
      { name: 'SEO & content support', price: '$99–$299/mo' },
      { name: 'Additional major revision', price: '$149' },
    ],
  },
];

// Kamaʻāina Rate spots
export const KAMAAINA_WEBSITE_SPOTS = 10;

// Legacy exports for compatibility — kept so DashboardHome doesn't break
export interface EarlyBirdStatus {
  eligible: boolean;
  daysRemaining: number;
  hoursRemaining: number;
}

export function getEarlyBirdStatus(_createdAt: string | null | undefined): EarlyBirdStatus {
  return { eligible: false, daysRemaining: 0, hoursRemaining: 0 };
}
