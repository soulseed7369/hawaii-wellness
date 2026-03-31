import type { Metadata } from 'next';
import MauiContent from './MauiContent';

export const metadata: Metadata = {
  title: 'Maui Wellness Practitioners & Holistic Health',
  description:
    "Find massage therapists, yoga instructors, acupuncturists & holistic healers in Lahaina, Kihei, Wailea, Makawao & across Maui. Browse Maui's growing wellness directory.",
  openGraph: {
    title: 'Maui Wellness Practitioners & Holistic Health',
    description:
      'Find massage therapists, yoga instructors, acupuncturists & holistic healers across Maui.',
    images: ['/maui_hero.webp'],
  },
};

export default function MauiPage() {
  return <MauiContent />;
}