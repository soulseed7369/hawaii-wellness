import { IslandHome } from "./IslandHome";

const config = {
  island: 'kauai',
  displayName: "Kauai",
  heroImageUrl: "/kauai%20hero.jpg",
  heroTitle: "Kauai Wellness Directory",
  heroSubtitle: "Discover holistic practitioners, healing centers & retreats on the Garden Isle",
  pageTitle: "Kauai Wellness Directory – Garden Isle Holistic Health",
  pageDescription: "Find yoga, massage, energy healing & holistic practitioners in Hanalei, Kapaa & Poipu. Kauai's Garden Isle wellness directory.",
};

export default function KauaiHome() {
  return <IslandHome config={config} />;
}
