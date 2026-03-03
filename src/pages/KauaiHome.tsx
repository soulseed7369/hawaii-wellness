import { IslandHome } from "./IslandHome";

const config = {
  island: 'kauai',
  displayName: "Kauaʻi",
  heroImageUrl: "https://images.unsplash.com/photo-1559478586-c35e6c8b2c32?w=1920&q=80",
  heroTitle: "Kauaʻi Wellness Directory",
  heroSubtitle: "Discover holistic practitioners, healing centers & retreats on the Garden Isle",
  pageTitle: "Kauai Wellness Directory – Garden Isle Holistic Health",
  pageDescription: "Find holistic health practitioners, wellness centers, and retreats on Kauai, Hawaii.",
};

export default function KauaiHome() {
  return <IslandHome config={config} />;
}
