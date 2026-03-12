import { IslandHome } from "./IslandHome";

const config = {
  island: 'oahu',
  displayName: "Oahu",
  heroImageUrl: "/oahu%20hero.jpg",
  heroTitle: "Oahu Wellness Directory",
  heroSubtitle: "Find holistic health practitioners, spas & wellness centers on the Gathering Place",
  pageTitle: "Oahu Wellness Directory – Holistic Health on Oahu",
  pageDescription: "Find acupuncture, massage, counseling & holistic health practitioners in Honolulu, Kailua & North Shore. Oahu's comprehensive wellness directory.",
};

export default function OahuHome() {
  return <IslandHome config={config} />;
}
