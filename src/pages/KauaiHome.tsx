import { IslandHome } from "./IslandHome";

const config = {
  island: 'kauai',
  displayName: "Kauai",
  heroImageUrl: "/kauai%20hero.jpg",
  heroTitle: "Find a Wellness Practitioner on Kauai",
  heroSubtitle: "Browse holistic health providers in Hanalei, Kapaa, Poipu & across the Garden Isle",
  pageTitle: "Kauai Wellness Directory – Garden Isle Holistic Health",
  pageDescription: "Find yoga, massage, energy healing & holistic practitioners in Hanalei, Kapaa & Poipu. Kauai's Garden Isle wellness directory.",
};

export default function KauaiHome() {
  return <IslandHome config={config} />;
}
