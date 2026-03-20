import { IslandHome } from "./IslandHome";

const config = {
  island: 'oahu',
  displayName: "Oahu",
  heroImageUrl: "/oahu%20hero.jpg",
  heroTitle: "Find a Wellness Practitioner on Oahu",
  heroSubtitle: "Browse holistic health providers in Honolulu, Kailua, Haleiwa & across the Gathering Place",
  pageTitle: "Oʻahu Wellness Directory — Honolulu, Kailua & More | Hawaiʻi Wellness",
  pageDescription: "Discover holistic health practitioners and wellness centers across Oʻahu. Serving Honolulu, Waikiki, Kailua, Kaneohe & the North Shore.",
  faqItems: [
    {
      question: "What's the wellness scene like in Honolulu?",
      answer: "Honolulu has a thriving wellness community with practitioners spanning yoga, meditation, acupuncture, massage, functional medicine, and life coaching. The urban wellness landscape offers convenient scheduling and a diverse range of practitioners. From downtown studios to beachside retreats, Honolulu accommodates all wellness preferences and budgets.",
    },
    {
      question: "How do Waikiki spas differ from local wellness practitioners?",
      answer: "Waikiki spas cater to tourists and offer luxury experiences with resort-quality amenities, pools, and upscale services. Local wellness practitioners in residential neighborhoods often have deeper training, lower prices, and personalized approaches. Choose a spa for a pampering experience or a local practitioner for focused healing and ongoing care.",
    },
    {
      question: "What is Hawaiian healing and where can I find it on Oahu?",
      answer: "Hawaiian healing (lomilomi, ho'oponopono, and other traditional practices) is rooted in Native Hawaiian wisdom and emphasizes spiritual and physical balance. Several Oahu practitioners specialize in authentic Hawaiian healing. Seek practitioners who have trained in these traditions and honor Hawaiian culture. It's a deeply restorative and spiritually grounded healing approach.",
    },
    {
      question: "Should I choose online or in-person wellness sessions?",
      answer: "Both have benefits. In-person sessions with modalities like massage, acupuncture, or yoga offer hands-on healing and a stronger therapeutic relationship. Online sessions work well for counseling, life coaching, nutrition consultations, and meditation. Consider your goals, lifestyle, and the practitioner's expertise when deciding.",
    },
    {
      question: "What is functional medicine and how is it different from conventional medicine?",
      answer: "Functional medicine takes a systems-based approach, investigating the root causes of illness rather than just treating symptoms. Practitioners spend time understanding your complete health history, diet, and lifestyle. They may recommend targeted supplements, dietary changes, and stress management alongside conventional treatments. It's ideal for chronic conditions and preventive health.",
    },
  ],
};

export default function OahuHome() {
  return <IslandHome config={config} />;
}
