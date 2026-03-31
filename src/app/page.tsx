import type { Metadata } from 'next';
import BigIslandContent from './big-island/BigIslandContent';

export const metadata: Metadata = {
  title: 'Big Island Wellness Directory – Hawaiʻi Island',
  description:
    "Find acupuncture, massage, yoga, reiki & naturopathic practitioners in Kona, Hilo & Waimea. Hawaiʻi Island's largest holistic wellness directory — 500+ practitioners, 34 specialties.",
  openGraph: {
    title: 'Big Island Wellness Directory – Hawaiʻi Island',
    description:
      "Find acupuncture, massage, yoga, reiki & naturopathic practitioners in Kona, Hilo & Waimea.",
    images: ['/big_island_pololu.webp'],
  },
};

export default function HomePage() {
  return <BigIslandContent />;
}
