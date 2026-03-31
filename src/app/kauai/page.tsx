import type { Metadata } from 'next';
import KauaiContent from './KauaiContent';

export const metadata: Metadata = {
  title: "Kauaʻi Holistic Health Practitioners & Centers",
  description:
    "Browse wellness practitioners and holistic healers on the Garden Isle. Serving Lihue, Kapaa, Hanalei, Princeville, Poipu & Koloa.",
  openGraph: {
    title: "Kauaʻi Holistic Health Practitioners & Centers",
    description: "Browse wellness practitioners and holistic healers on the Garden Isle.",
    images: ['/kauai_hero.webp'],
  },
};

export default function KauaiPage() {
  return <KauaiContent />;
}