import type { Metadata } from 'next';
import HelpContent from './HelpContent';

export const metadata: Metadata = {
  title: 'Help Center',
  description:
    'Get answers to common questions about finding practitioners, listing your practice, billing, and using Hawaiʻi Wellness.',
};

export default function HelpPage() {
  return <HelpContent />;
}
