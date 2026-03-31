import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import '../index.css';
import { RootLayoutClient } from '@/components/RootLayoutClient';

// siteConfig.ts now uses (import.meta as any).env?.VITE_SITE_URL with a
// process.env.NEXT_PUBLIC_SITE_URL fallback, making it safe in server components.
// We still inline here to avoid the import.meta.env optional-chaining overhead
// at the root layout level where we know only process.env vars are available.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.hawaiiwellness.net';
const SITE_NAME = 'Hawaiʻi Wellness';
const SITE_DESCRIPTION =
  "Hawaiʻi's holistic health directory — find certified practitioners and wellness centers across all islands.";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Playfair Display font for headings (serif) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground font-sans">
        <RootLayoutClient>
          {children}
        </RootLayoutClient>
        <Analytics />
      </body>
    </html>
  );
}
