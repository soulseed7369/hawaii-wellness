import { IslandHome } from "./IslandHome";

const config = {
  island: 'maui',
  displayName: "Maui",
  heroImageUrl: "/maui%20hero.jpg",
  heroTitle: "Maui Wellness Directory",
  heroSubtitle: "Discover holistic practitioners, spas & wellness centers across the Valley Isle",
  pageTitle: "Maui Wellness Directory – Valley Isle Holistic Health",
  pageDescription: "Find holistic health practitioners, wellness centers, and retreats on Maui, Hawaii.",
};

export default function MauiHome() {
  return <IslandHome config={config} />;
}
