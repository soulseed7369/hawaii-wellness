'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, MapPin, Users, Heart, ArrowRight, Search } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: "What wellness practices are most popular on the Big Island?",
    answer: "The Big Island has a thriving wellness community with practitioners specializing in yoga, massage, lomilomi (traditional Hawaiian massage), acupuncture, and naturopathic medicine. Many island residents and visitors seek these modalities for stress relief, physical recovery, and spiritual growth. The island's natural healing energy and connection to Hawaiian culture make it an ideal destination for holistic wellness practices.",
  },
  {
    question: "What should I expect from a Lomilomi session?",
    answer: "Lomilomi is a traditional Hawaiian healing massage that incorporates spiritual and healing elements. A typical session involves rhythmic, flowing strokes using the practitioner's hands, forearms, and elbows to release tension and restore balance. Sessions usually last 60-90 minutes and leave clients feeling deeply relaxed. Many practitioners begin with a spiritual practice to honor the healing tradition.",
  },
  {
    question: "Are there differences between practitioners in Kona and Hilo?",
    answer: "Both areas have excellent practitioners, but they differ slightly. Kona (west side) draws more tourists and has wellness centers with amenities like spas and retreats. Hilo (east side) has a more local, traditional wellness community with practitioners deeply rooted in Hawaiian healing practices. Choose based on your location and preference for a tourist-friendly or local experience.",
  },
  {
    question: "How much do wellness sessions typically cost on the Big Island?",
    answer: "Prices vary by modality and practitioner experience. Massage and yoga sessions typically range from $60-150 per hour, while specialized services like acupuncture or functional medicine consultations may cost $100-250. Many practitioners offer package discounts for multiple sessions. Always confirm pricing before booking.",
  },
  {
    question: "How do I choose the right wellness practitioner for my needs?",
    answer: "Start by identifying your wellness goal (stress relief, physical healing, spiritual growth, etc.) and the modality that resonates with you. Check practitioner bios, testimonials, and qualifications on our directory. Many offer free phone consultations to discuss your needs. Trust your intuition — a good practitioner-client relationship is essential for healing.",
  },
];

const BROWSE_MODALITIES = [
  'Yoga', 'Massage', 'Reiki', 'Acupuncture', 'Breathwork', 'Meditation',
  'Sound Healing', 'Life Coaching', 'Naturopathic', 'Energy Healing',
  'Somatic Therapy', 'Nutrition', 'Fitness', 'Functional Medicine',
  'Lomilomi / Hawaiian Healing', 'Counseling', 'Ayurveda', 'Chiropractic',
];

function FAQAccordion({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-4 text-sm text-muted-foreground leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function BigIslandContent() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ_ITEMS.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }),
        }}
      />

      {/* Hero */}
      <section className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-stone-900">
        <picture>
          <source
            type="image/webp"
            srcSet="/big_island_pololu-640w.webp 640w, /big_island_pololu-1024w.webp 1024w, /big_island_pololu-1920w.webp 1920w, /big_island_pololu.webp 2560w"
            sizes="100vw"
          />
          <img
            src="/big_island_pololu.webp"
            alt="Big Island wellness landscape"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            loading="eager"
          />
        </picture>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center text-white">
          <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">
            Your Wellness Journey on the Big Island Starts Here
          </h1>
          <p className="text-lg text-white/80">
            Connect with practitioners and wellness centers across the Big Island
          </p>
          <Link
            href="/directory?island=big_island"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Search className="h-4 w-4" />
            Browse Directory
          </Link>
        </div>
      </section>

      {/* Browse by Modality */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <h2 className="mb-6 font-display text-2xl font-semibold">Browse by Specialty</h2>
        <div className="flex flex-wrap gap-2">
          {BROWSE_MODALITIES.map((mod) => (
            <Link
              key={mod}
              href={`/directory?island=big_island&modality=${encodeURIComponent(mod)}`}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {mod}
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-4 py-12">
        <h2 className="mb-6 font-display text-2xl font-semibold">
          Frequently Asked Questions
        </h2>
        <div className="rounded-lg border border-border bg-card px-4">
          {FAQ_ITEMS.map((item) => (
            <FAQAccordion key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-4 py-12 text-center">
        <h2 className="mb-3 font-display text-2xl font-semibold">
          Are You a Wellness Provider on the Big Island?
        </h2>
        <p className="mb-6 text-muted-foreground">
          Join hundreds of practitioners already listed in our directory.
        </p>
        <Link
          href="/list-your-practice"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          List Your Practice
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}