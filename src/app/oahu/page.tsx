import type { Metadata } from 'next';
import OahuContent from './OahuContent';

export const metadata: Metadata = {
  title: "O\u02BBahu Wellness Directory \u2014 Honolulu, Kailua & More",
  description:
    "Discover holistic health practitioners and wellness centers across O\u02BBahu. Serving Honolulu, Waikiki, Kailua, Kaneohe & the North Shore.",
  openGraph: {
    title: "O\u02BBahu Wellness Directory \u2014 Honolulu, Kailua & More",
    description: "Discover holistic health practitioners and wellness centers across O\u02BBahu.",
    images: ['/oahu_hero.webp'],
  },
};

export default function OahuPage() {
  return <OahuContent />;
}