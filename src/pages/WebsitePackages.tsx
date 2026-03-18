import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Mail, ArrowRight, Star, Globe, Palette, TrendingUp, Puzzle, LifeBuoy, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  PACKAGES,
  ADD_ON_CATEGORIES,
  KAMAAINA_WEBSITE_SPOTS,
} from "@/lib/websitePackages";

const ICON_MAP: Record<string, React.ElementType> = {
  Paintbrush: Palette,
  TrendingUp: TrendingUp,
  Puzzle: Puzzle,
  LifeBuoy: LifeBuoy,
};

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Book a discovery call",
    description: "A free 20-minute conversation to understand your practice, goals, and what kind of site will work best for you.",
  },
  {
    step: "02",
    title: "Proposal & agreement",
    description: "We'll send a clear scope of work outlining deliverables, timeline, revision rounds, and payment terms. No surprises.",
  },
  {
    step: "03",
    title: "Design & build",
    description: "We build your site — typically 2–4 weeks depending on package. You'll review and approve before anything goes live.",
  },
  {
    step: "04",
    title: "Launch & list",
    description: "Your site goes live and your bonus directory listing tier activates. You show up in more places, looking more professional.",
  },
];

const FAQ = [
  {
    q: "How long does it take to build?",
    a: "Essentials sites typically take 1–2 weeks. Standard takes 2–3 weeks. Pro takes 3–4 weeks. Timelines depend on how quickly you can provide content (photos, copy) and approve drafts.",
  },
  {
    q: "Do I own the website?",
    a: "Yes — you own your domain and all content. If you ever want to move to another host, we'll help you migrate.",
  },
  {
    q: "What if I already have a domain?",
    a: "No problem. We'll connect your existing domain to your new site. If you don't have one yet, we'll help you choose and register one.",
  },
  {
    q: "Who writes the content?",
    a: "Copywriting is included in all packages — we'll write the copy for your site based on a short intake questionnaire about your practice, style, and offerings. You'll review and approve before anything goes live. We just ask that you provide your own photos; a professional headshot makes a significant difference.",
  },
  {
    q: "How many revisions are included?",
    a: "Essentials and Standard include 2 rounds of revisions. Pro includes 3. Additional major revisions are $149 each.",
  },
  {
    q: "What happens after the included Premium subscription?",
    a: "After your included subscription period ends, your Premium subscription continues at $49/mo (or your Kamaʻāina Rate if applicable). You can cancel anytime.",
  },
];

const DISCOVERY_MAILTO =
  "mailto:aloha@hawaiiwellness.net?subject=Website%20Discovery%20Call&body=Hi%2C%20I%27m%20interested%20in%20learning%20more%20about%20your%20website%20packages%20for%20my%20wellness%20practice.";

export default function WebsitePackages() {
  usePageMeta(
    "Website Packages",
    "Custom websites built for Hawaiʻi wellness providers. Done-for-you sites starting at $497 with Kamaʻāina Rate pricing.",
  );

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <main className="min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ocean-light/60 to-secondary/30 py-20">
        <div className="container max-w-3xl text-center">
          <Badge className="mb-5 bg-ocean/10 text-ocean border-ocean/20 text-xs tracking-wide uppercase px-3 py-1">
            Built for Hawaiʻi Wellness Providers
          </Badge>
          <h1 className="mb-5 font-display text-4xl font-bold tracking-tight md:text-5xl">
            A website that works as hard as you do
          </h1>
          <p className="text-lg text-muted-foreground md:text-xl leading-relaxed">
            Your directory listing helps people discover you. Your website helps them{" "}
            <em>choose</em> you. We build both — designed specifically for Hawaiʻi wellness providers.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 text-base px-8" asChild>
              <a href={DISCOVERY_MAILTO}>
                <Mail className="h-5 w-5" />
                Book a Free Discovery Call
              </a>
            </Button>
            <Button size="lg" variant="outline" className="gap-2 text-base" asChild>
              <a href="#packages">
                View Packages
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Kamaʻāina Rate banner ─────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 border-y border-amber-200 py-8">
        <div className="container max-w-3xl text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Sparkles className="h-6 w-6 text-amber-500" />
            <h2 className="font-display text-2xl font-bold text-amber-900 md:text-3xl">Kamaʻāina Rate</h2>
            <Sparkles className="h-6 w-6 text-amber-500" />
          </div>
          <p className="text-base text-amber-800 leading-relaxed max-w-lg mx-auto">
            Our earliest supporters get special pricing — <strong>for life</strong>.
            <br className="hidden sm:block" />
            Lock in your rate before spots fill up.
          </p>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Kamaʻāina Rate — first {KAMAAINA_WEBSITE_SPOTS} websites
            </span>
          </div>
        </div>
      </section>

      {/* ── Package cards ──────────────────────────────────────────────────── */}
      <section id="packages" className="container max-w-5xl py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold md:text-3xl flex items-center justify-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Done-for-You Websites
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
            A professional website + your directory listing, built by the team that knows Hawaiʻi wellness.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <Card
              key={pkg.id}
              className={`flex flex-col ${pkg.highlight ? "ring-2 ring-primary relative" : ""}`}
            >
              {pkg.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardContent className={`flex flex-col flex-1 p-6 gap-5 ${pkg.highlight ? "pt-7" : ""}`}>
                <div>
                  <p className={`text-sm font-medium uppercase tracking-wider mb-1 ${pkg.highlight ? "text-primary" : "text-muted-foreground"}`}>
                    {pkg.name}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl font-bold">${pkg.kamaaiaPrice.toLocaleString()}</span>
                    <span className="text-muted-foreground text-lg line-through">${pkg.price.toLocaleString()}</span>
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      <Sparkles className="h-3 w-3" />
                      Kamaʻāina Rate
                    </span>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${pkg.highlight ? "text-primary" : "text-sage"}`} />
                      {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm">
                    <Star className={`h-4 w-4 shrink-0 mt-0.5 text-amber-500`} />
                    <span className="font-medium text-amber-800">{pkg.includedSubscription}</span>
                  </li>
                </ul>

                <Button
                  className={`w-full mt-auto gap-2`}
                  variant={pkg.highlight ? "default" : "outline"}
                  asChild
                >
                  <a href={pkg.mailto}>
                    <Mail className="h-4 w-4" />
                    Get Started
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer notes */}
        <div className="mt-8 space-y-1.5 text-center">
          <p className="text-xs text-muted-foreground">
            After the included subscription period, your Premium subscription continues at $49/mo (or your Kamaʻāina Rate if applicable). Cancel anytime.
          </p>
          <p className="text-xs text-muted-foreground">
            Need changes after your included revisions? Additional major revisions are $149 each.
          </p>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="bg-secondary/30 py-16">
        <div className="container max-w-4xl">
          <h2 className="mb-10 text-center font-display text-2xl font-bold md:text-3xl">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="text-center sm:text-left">
                <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                  {step.step}
                </span>
                <h3 className="mb-1.5 font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Add-ons ────────────────────────────────────────────────────────── */}
      <section className="container max-w-5xl py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Need more?</h2>
          <p className="text-muted-foreground mt-2">Add these to any package — just let us know during your discovery call.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ADD_ON_CATEGORIES.map((cat) => {
            const Icon = ICON_MAP[cat.icon] ?? Globe;
            return (
              <Card key={cat.title}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-secondary p-2">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                    <h3 className="font-semibold text-sm">{cat.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {cat.items.map((item) => (
                      <li key={item.name} className="flex items-start justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="font-medium text-foreground whitespace-nowrap">{item.price}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="bg-secondary/30 py-16">
        <div className="container max-w-2xl">
          <h2 className="mb-8 text-center font-display text-2xl font-bold md:text-3xl">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {FAQ.map((faq, i) => (
              <Card key={i} className="overflow-hidden">
                <button
                  className="flex w-full items-center justify-between p-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm font-semibold pr-4">{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  }
                </button>
                {openFaq === i && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────────────────── */}
      <section className="bg-primary py-14 text-primary-foreground">
        <div className="container max-w-2xl text-center">
          <h2 className="mb-4 font-display text-2xl font-bold md:text-3xl">
            Ready to get started?
          </h2>
          <p className="mb-8 text-primary-foreground/80 text-lg">
            Book a free 20-minute discovery call. We&apos;ll talk about your practice, your goals, and which package makes sense.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="gap-2 bg-white text-primary hover:bg-white/90 text-base px-8" asChild>
              <a href={DISCOVERY_MAILTO}>
                <Mail className="h-5 w-5" />
                Book a Discovery Call
              </a>
            </Button>
            <Button size="lg" variant="outline" className="gap-2 border-white/40 text-primary-foreground/90 hover:bg-white/10 text-base" asChild>
              <Link to="/list-your-practice">
                View Directory Pricing
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
