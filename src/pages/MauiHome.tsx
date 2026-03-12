import { IslandHome } from "./IslandHome";

const config = {
  island: 'maui',
  displayName: "Maui",
  heroImageUrl: "/maui%20hero.jpg",
  heroTitle: "Maui Wellness Directory",
  heroSubtitle: "Discover holistic practitioners, spas & wellness centers across the Valley Isle",
  pageTitle: "Maui Wellness Directory – Valley Isle Holistic Health",
  pageDescription: "Find massage, yoga, acupuncture & holistic health practitioners in Lahaina, Kihei & Makawao. Maui's growing wellness directory — practitioners across the Valley Isle.",
};

export default function MauiHome() {
  return <IslandHome config={config} />;
}
