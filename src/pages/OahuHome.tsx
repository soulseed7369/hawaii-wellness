import { IslandHome } from "./IslandHome";

const config = {
  island: 'oahu',
  displayName: "Oʻahu",
  heroImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80",
  heroTitle: "Oʻahu Wellness Directory",
  heroSubtitle: "Find holistic health practitioners, spas & wellness centers on the Gathering Place",
  pageTitle: "Oahu Wellness Directory – Holistic Health on Oahu",
  pageDescription: "Find holistic health practitioners, wellness centers, and retreats on Oahu, Hawaii.",
};

export default function OahuHome() {
  return <IslandHome config={config} />;
}
