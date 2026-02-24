

# Hawaii Holistic Health Directory — Implementation Plan

## Design System & Theme
- **"Organic Luxury" aesthetic**: Earth tones (terracotta, sage green, deep ocean blue), warm off-whites, clean typography, generous white space
- Custom Tailwind color palette tuned to Hawaiian nature meets high-end spa
- Mobile-first responsive design throughout

## Global Navigation
- **Sticky Header**: Logo placeholder, center nav links (Directory, Retreats & Centers, Articles/News), island selector dropdown (default "Big Island"), "List Your Practice" CTA button, "Concierge Login" lock icon link
- **Footer**: Practitioner signup, support, privacy policy links, newsletter email subscription form

## Page 1: Homepage
- **Search Section**: Prominent dual-input search bar (service + location) with subtle tapa-cloth-inspired background texture
- **3 Horizontal Carousels** with mock data:
  1. "Featured Retreats & Wellness Centers" — 4-5 venue cards
  2. "Top-Rated Local Practitioners" — 5-6 profile cards
  3. "Latest from the Big Island Health Scene" — 3 article cards
- Each carousel uses dedicated modular components (`<RetreatCard />`, `<PractitionerCard />`, `<ArticleCard />`)

## Page 2: Directory & Map Split-View
- Split-screen layout: scrollable list (left) + interactive Leaflet map (right)
- **Filter tabs** at top: Practitioners / Wellness Centers / Retreats
- **`<ProviderCard />`** — flexible card component for people or venues (image, name, modality/type, location, "View Profile" CTA)
- Map pins with hover mini-card summaries
- Collapses to stacked view on mobile

## Page 3: Articles Hub
- **Featured article** hero section (full-width image, title, excerpt, "Read More")
- **3-column grid** of `<ArticleCard />` components below
- Responsive: 1-column on mobile, 2 on tablet, 3 on desktop

## Page 4: Practitioner Checkout & Onboarding
- **Left column**: Order summary (plan name, price $39/mo, benefits list)
- **Right column**: `<PaymentTabs />` component
  - Tab 1: Credit Card — styled card inputs (number, expiry, CVC)
  - Tab 2: Bitcoin/Lightning — QR code placeholder, address copy field, "Pay with Lightning Wallet" button, privacy note
- Clean, trustworthy multi-step feel

## Page 5: Universal Profile Detail Page
- **Header hero**: Cover image, profile photo overlay, name/title, verification badges
- **Left content**: About section, Services & Modalities list, image gallery
- **Right sticky sidebar**: Mini Leaflet map, address, contact info, prominent CTA ("Request Appointment" / "Visit Website")
- Works for both individual practitioners and wellness centers

## Page 6: Black Label Concierge Login
- Minimalist **dark-mode** login screen, visually distinct from the main site
- "Black Label Concierge Access" header
- Username/password inputs + "Secure Login" button
- Skeleton page ready for future auth integration

## Component Architecture (Supabase-Ready)
All key UI elements built as clean, self-contained components with props-driven interfaces:
- `<ProviderCard />`, `<RetreatCard />`, `<PractitionerCard />`, `<ArticleCard />`
- `<PaymentTabs />`, `<SearchBar />`, `<IslandSelector />`
- `<MapView />`, `<ProfileHero />`, `<ServicesList />`
- Mock data kept in separate files for easy swap to Supabase queries

## Routing
Six routes via React Router:
- `/` — Homepage
- `/directory` — Directory + Map split-view
- `/articles` — Articles hub
- `/list-your-practice` — Checkout/onboarding
- `/profile/:id` — Universal profile detail
- `/concierge` — Black Label login

