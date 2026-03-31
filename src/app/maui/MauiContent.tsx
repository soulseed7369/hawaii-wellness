'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, MapPin, Users, Heart, ArrowRight, Search } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: "What makes Makawao such a wellness hub on Maui?",
    answer: "Makawao, nestled in Maui\u2019s upcountry, is known for its vibrant alternative and wellness community. The cooler climate, artistic vibe, and spiritual energy attract practitioners of yoga, somatic therapy, energy healing, and life coaching. Many visitors and residents are drawn to Makawao\u2019s holistic lifestyle and strong wellness network.",
  },
  {
    question: "What are the best wellness retreat centers on Maui?",
    answer: "Maui is home to several renowned retreat centers offering immersive wellness experiences. These centers offer yoga retreats, healing workshops, and multi-day programs combining meditation, massage, and nutrition coaching. Many are located near beaches or in the serene upcountry, providing the perfect setting for deep healing work.",
  },
  {
    question: "What\u2019s the difference between a spa and a wellness center?",
    answer: "A spa typically focuses on relaxation treatments like massage, facials, and body treatments in a luxury setting. A wellness center takes a more holistic approach, offering modalities like yoga, acupuncture, counseling, and functional medicine consultations alongside bodywork. Wellness centers emphasize overall health improvement, while spas prioritize pampering and relaxation.",
  },
  {
    question: "How do I book an appointment with a Maui wellness practitioner?",
    answer: "Use our directory to find practitioners by location and modality. Many have websites and online booking systems. You can call directly, email, or use platforms like Acuity Scheduling or Mindbody. We recommend reading reviews and checking the practitioner\u2019s qualifications before booking your first session.",
  },
  {
    question: "Are wellness services on Maui good for visitors?",
    answer: "Yes! Maui welcomes visitors seeking wellness experiences. Many practitioners specialize in working with visitors and offer flexible scheduling. Popular options include daily yoga classes, massage sessions, and energy healing treatments. Booking in advance is recommended, especially during peak season.",
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

export default function MauiContent() {
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
            srcSet="/maui_hero-640w.webp 640w, /maui_hero-1024w.webp 1024w, /maui_hero-1920w.webp 1920w, /maui_hero.webp 4240w"
            sizes="100vw"
          />
          <img
            src="/maui_hero.webp"
            alt="Maui wellness landscape"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            loading="eager"
          />
        </picture>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center text-white">
          <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">
            Find a Wellness Practitioner on Maui
          </h1>
          <p className="text-lg text-white/80">
            Browse holistic health providers in Lahaina, Kihei, Makawao & across the Valley Isle
          </p>
          <Link
            href="/directory?island=maui"
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
              href={`/directory?island=maui&modality=${encodeURIComponent(mod)}`}
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
          Are You a Wellness Provider on Maui?
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