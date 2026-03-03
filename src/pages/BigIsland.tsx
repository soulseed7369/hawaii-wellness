import { IslandHome } from "./IslandHome";
import heroImage from "@/assets/hero-homepage.jpg";

const config = {
  island: 'big_island',
  displayName: "Hawaiʻi Island",
  heroImageUrl: heroImage,
  heroTitle: "Find Your Path to Wellness",
  heroSubtitle: "Discover holistic practitioners, retreats & wellness centers on the Big Island",
  pageTitle: "Big Island Wellness Directory – Hawaiʻi Island",
  pageDescription: "Find holistic health practitioners, wellness centers, and retreats on the Big Island of Hawaiʻi.",
};

export default function BigIsland() {
  return <IslandHome config={config} />;
}
