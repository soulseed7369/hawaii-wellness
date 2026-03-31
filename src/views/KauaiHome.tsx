import { IslandHome } from "./IslandHome";

const config = {
  island: 'kauai',
  displayName: "Kauai",
  heroImageUrl: "/kauai%20hero.jpg",
  heroImages: {
    srcSet: "/kauai_hero-640w.webp 640w, /kauai_hero-1024w.webp 1024w, /kauai_hero-1920w.webp 1920w, /kauai_hero.webp 4240w",
    sizes: "100vw",
    src: "/kauai_hero.webp",
  },
  heroTitle: "Find a Wellness Practitioner on Kauai",
  heroSubtitle: "Browse holistic health providers in Hanalei, Kapaa, Poipu & across the Garden Isle",
  pageTitle: "Kauaʻi Holistic Health Practitioners & Centers | Hawaiʻi Wellness",
  pageDescription: "Browse wellness practitioners and holistic healers on the Garden Isle. Serving Lihue, Kapaa, Hanalei, Princeville, Poipu & Koloa.",
  faqItems: [
    {
      question: "What makes Kauai such a special wellness destination?",
      answer: "Kauai, known as the Garden Isle, offers a unique wellness environment shaped by pristine nature, strong spiritual energy, and a tight-knit alternative community. The island attracts seekers of natural healing, retreat experiences, and transformative wellness practices. Practitioners often integrate nature-based and Hawaiian healing traditions into their work.",
    },
    {
      question: "Are there wellness retreat centers on Kauai for visitors?",
      answer: "Yes, Kauai hosts several retreat centers and wellness lodges offering multi-day programs combining yoga, meditation, massage, nutrition, and nature immersion. These retreats attract visitors from around the world. Many centers feature organic meals, garden settings, and integrative healing modalities. Book in advance as retreats fill quickly.",
    },
    {
      question: "What is nature therapy and how prevalent is it on Kauai?",
      answer: "Nature therapy uses the healing power of natural environments—forests, beaches, waterfalls—to promote mental and physical health. Kauai practitioners often incorporate nature walks, outdoor meditation, and forest bathing into their work. The island's lush landscapes make nature therapy particularly effective and accessible here.",
    },
    {
      question: "Should I book a local practitioner or a visiting expert on Kauai?",
      answer: "Both offer value. Local practitioners have deep roots in Kauai's healing community and understand the island's spiritual energy. Many visiting experts and teachers lead workshops and intensives. For ongoing care, choose a local practitioner. For special workshops or trainings, seek visiting teachers. Many locals have studied extensively elsewhere.",
    },
    {
      question: "Is it better to visit a wellness practitioner during a vacation or commit to local care?",
      answer: "A wellness visit during vacation can be deeply restorative and set intentions for continued health. However, ongoing care with a local practitioner creates lasting transformation. Consider a blended approach: book intensive sessions or retreats during visits, then continue with a local practitioner's guidance between trips for sustained healing and growth.",
    },
  ],
};

export default function KauaiHome() {
  return <IslandHome config={config} />;
}
