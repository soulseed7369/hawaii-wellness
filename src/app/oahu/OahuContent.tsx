'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, MapPin, Users, Heart, ArrowRight, Search } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: "What\u2019s the wellness scene like in Honolulu?",
    answer: "Honolulu has a thriving wellness community with practitioners spanning yoga, meditation, acupuncture, massage, functional medicine, and life coaching. The urban wellness landscape offers convenient scheduling and a diverse range of practitioners. From downtown studios to beachside retreats, Honolulu accommodates all wellness preferences and budgets.",
  },
  {
    question: "How do Waikiki spas differ from local wellness practitioners?",
    answer: "Waikiki spas cater to tourists and offer luxury experiences with resort-quality amenities, pools, and upscale services. Local wellness practitioners in residential neighborhoods often have deeper training, lower prices, and personalized approaches. Choose a spa for a pampering experience or a local practitioner for focused healing and ongoing care.",
  },
  {
    question: "What is Hawaiian healing and where can I find it on Oahu?",
    answer: "Hawaiian healing (lomilomi, ho\u2019oponopono, and other traditional practices) is rooted in Native Hawaiian wisdom and emphasizes spiritual and physical balance. Several Oahu practitioners specialize in authentic Hawaiian healing. Seek practitioners who have trained in these traditions and honor Hawaiian culture. It\u2019s a deeply restorative and spiritually grounded healing approach.",
  },
  {
    question: "Should I choose online or in-person wellness sessions?",
    answer: "Both have benefits. In-person sessions with modalities like massage, acupuncture, or yoga offer hands-on healing and a stronger therapeutic relationship. Online sessions work well for counseling, life coaching, nutrition consultations, and meditation. Consider your goals, lifestyle, and the practitioner\u2019s expertise when deciding.",
  },
  {
    question: "What is functional medicine and how is it different from conventional medicine?",
    answer: "Functional medicine takes a systems-based approach, investigating the root causes of illness rather than just treating symptoms. Practitioners spend time understanding your complete health history, diet, and lifestyle. They may recommend targeted supplements, dietary changes, and stress management alongside conventional treatments. It\u2019s ideal for chronic conditions and preventive health.",
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

export default function OahuContent() {
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
            srcSet="/oahu_hero-640w.webp 640w, /oahu_hero-1024w.webp 1024w, /oahu_hero-1920w.webp 1920w, /oahu_hero.webp 4032w"
            sizes="100vw"
          />
          <img
            src="/oahu_hero.webp"
            alt="Oahu wellness landscape"
            className="absolute inset-0 h-full w-full object-cover opacity-60"
            loading="eager"
          />
        </picture>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center text-white">
          <h1 className="mb-4 font-display text-4xl font-bold md:text-5xl">
            Find a Wellness Practitioner on Oahu
          </h1>
          <p className="text-lg text-white/80">
            Browse holistic health providers in Honolulu, Kailua, Haleiwa & across the Gathering Place
          </p>
          <Link
            href="/directory?island=oahu"
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
              href={`/directory?island=oahu&modality=${encodeURIComponent(mod)}`}
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
          Are You a Wellness Provider on Oahu?
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