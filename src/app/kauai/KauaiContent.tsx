'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, MapPin, Users, Heart, ArrowRight, Search } from 'lucide-react';

const FAQ_ITEMS = [
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
    answer: "Nature therapy uses the healing power of natural environments\u2014forests, beaches, waterfalls\u2014to promote mental and physical health. Kauai practitioners often incorporate nature walks, outdoor meditation, and forest bathing into their work. The island\u2019s lush landscapes make nature therapy particularly effective and accessible here.",
  },
  {
    question: "Should I book a local practitioner or a visiting expert on Kauai?",
    answer: "Both offer value. Local practitioners have deep roots in Kauai\u2019s healing community and understand the island\u2019s spiritual energy. Many visiting experts and teachers lead workshops and intensives. For ongoing care, choose a local practitioner. For special workshops or trainings, seek visiting teachers. Many locals have studied extensively elsewhere.",
  },
  {
    question: "Is it better to visit a wellness practitioner during a vacation or commit to local care?",
    answer: "A wellness visit during vacation can be deeply restorative and set intentions for continued health. However, ongoing care with a local practitioner creates lasting transformation. Consider a blended approach: book intensive sessions or retreats during visits, then continue with a local practitioner\u2019s guidance between trips for sustained healing and growth.",
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

export default function KauaiContent() {
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
            srcSet="/kauai_hero-640w.webp 640w, /kauai_hero-1024w.webp 1024w, /kauai_hero-1920w.webp 1920w, /kauai_hero.webp 4240w"
            sizes="100vw"
          />
          <img
            src="/kauai_hero.webp"
            alt="Kauai wellness landscape"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            loading="eager"
          />
        </picture>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center text-white">
          <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">
            Find a Wellness Practitioner on Kauai
          </h1>
          <p className="text-lg text-white/80">
            Browse holistic health providers in Hanalei, Kapaa, Poipu & across the Garden Isle
          </p>
          <Link
            href="/directory?island=kauai"
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
              href={`/directory?island=kauai&modality=${encodeURIComponent(mod)}`}
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
          Are You a Wellness Provider on Kauai?
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