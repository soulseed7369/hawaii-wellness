---
name: website-designer
description: "Create beautiful, custom single-page websites for holistic health practitioners. Produces self-contained HTML files with Tailwind CSS, responsive design, and conversion-optimized layouts. Use when: design a website, build a practitioner site, create a landing page, make a wellness website, practitioner website, healer website, therapist website, yoga teacher website, spa website, wellness center website, portfolio site for practitioner. Also triggers on: design a page for, build a site for, website for my practice, create a web presence. MANDATORY: Use this skill for ANY request involving creating a website or web page for a wellness practitioner, health professional, or holistic healer."
---

# Website Designer for Wellness Practitioners

You design and build stunning, conversion-optimized single-page websites for holistic health practitioners. Each site is a self-contained HTML file that opens directly in a browser — no build step, no framework, no dependencies beyond a CDN link to Tailwind.

These websites are sold to practitioners through hawaiiwellness.net. They need to look custom and premium — never templated, never generic. Every practitioner's site should feel like it was designed by a boutique agency that deeply understands their modality.

---

## the core job

Given a practitioner's details (name, modality, location, bio, services, etc.), produce a single HTML file that:

1. Looks beautiful and professional — the kind of site a practitioner would proudly share
2. Feels custom to their specific modality and personality — not a cookie-cutter template
3. Converts visitors into clients — clear CTAs, trust signals, easy contact
4. Works flawlessly on mobile (60%+ of wellness traffic is mobile)
5. Loads fast — no heavy images, just smart CSS and layout

---

## before writing any code

Read `references/design-system.md` for the complete color palettes, typography systems, and layout patterns. The reference file contains specific hex codes, font pairings, section structures, and spacing values — use them. Do not improvise colors or fonts from memory.

Then, analyze the practitioner's information to make three design decisions:

### 1. Choose a color palette

Match the palette to the practitioner's modality and vibe. Read the full palette definitions in `references/design-system.md`, but here's the decision tree:

| Practitioner type | Palette | Why |
|---|---|---|
| Therapist, counselor, life coach, energy healer, meditation | **Mountain Air** (navy + teal + sage) | Trust + calm. The navy conveys authority, teal feels healing, sage connects to nature. |
| Spa, massage, Ayurveda, retreat center, luxury wellness | **Desert Dunes** (cream + rust + deep brown) | Warmth + premium. Earth tones signal luxury and grounding. |
| Yoga, fitness, nature therapy, sound healing, breathwork | **Serene Nature** (cream + ocean blue + moss green) | Accessible + welcoming. Blues and greens feel open and inviting. |
| Functional medicine, naturopath, clinical, dentistry | **Healthcare Neutral** (white + earth green + midnight) | Clean + credible. Clinical feel without being cold. |
| Hawaiian healing, Lomilomi, cultural practices | **Island Spirit** — custom | Use the Hawaii Wellness brand colors: terracotta `#c0562a`, sage `#5a7a5a`, ocean `#254B5A`, sand `#f5f0e8`. Weave in Hawaiian cultural warmth. |

If a practitioner spans multiple categories, lean toward the one that matches their primary clientele's expectations.

### 2. Choose a typography system

| Vibe | Heading font | Body font | Google Fonts import |
|---|---|---|---|
| Professional, modern | `Playfair Display` (700) | `Source Sans 3` (400, 600) | `family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;600` |
| Bold, grounded | `Oswald` (500, 700) | `Rubik` (400, 500) | `family=Oswald:wght@500;700&family=Rubik:wght@400;500` |
| Elegant, boutique | `Cormorant Garamond` (600, 700) | `Inter` (300, 400, 500) | `family=Cormorant+Garamond:wght@600;700&family=Inter:wght@300;400;500` |
| Energetic, active | `Montserrat` (700, 800) | `Open Sans` (400, 500) | `family=Montserrat:wght@700;800&family=Open+Sans:wght@400;500` |

Default to Playfair Display + Source Sans 3 when uncertain — it works for almost everyone.

### 3. Choose a hero style

| Style | When to use | Layout |
|---|---|---|
| **Full-bleed image overlay** | Practitioner has a great photo or wants drama | Full-width bg image + dark overlay + centered white text |
| **Split layout** | Practitioner wants to show their face prominently | 50/50 grid — photo on one side, text + CTA on the other |
| **Gradient hero** | No photo available, or clean modern feel | CSS gradient background using palette colors + bold typography |
| **Minimal text-only** | Minimalist practitioners, meditation, zen | Solid color bg + large serif headline + subtle accent |

---

## section structure

Every practitioner website follows this section order. This sequence is proven to convert — don't reorder it without good reason.

### Section 1: Hero
- Height: `min-h-[70vh]` desktop, `min-h-[50vh]` mobile
- Contains: headline (5-8 words), subtitle (10-20 words), primary CTA button
- The headline should capture what the practitioner does and for whom, not just their name
- CTA text should be specific: "Book Your Free Consultation" beats "Learn More"

### Section 2: Introduction / Value Proposition
- 2-3 short benefit cards in a row (icons or emoji + title + 1-2 sentence description)
- Or: a brief personal statement from the practitioner (2-3 sentences max)
- Background: white or very light tint from the palette

### Section 3: About / Bio
- Split layout: photo on one side, bio text on the other
- If no photo: full-width text with a decorative accent (colored left border, background tint)
- Bio should feel warm and human, not a resume. First person is fine.
- Include credentials/certifications as subtle trust signals (small text below bio)

### Section 4: Services / Modalities
- Card grid: 2-3 columns desktop, 1 column mobile
- Each card: service name, brief description (20-40 words), optional price or "from $X"
- Subtle hover effect: shadow increase or gentle scale
- If many services, group by category with section subheadings

### Section 5: Testimonials
- 2-3 testimonials max (quality over quantity)
- Large quote marks or italic styling
- Include client first name + context ("Sarah M., Kailua-Kona")
- Soft background color from palette to distinguish this section
- If no testimonials provided, omit this section entirely — never use placeholder quotes

### Section 6: Location & Hours (if applicable)
- Simple text layout: address, phone, email
- Working hours in a clean table or list
- "Serving [city/island]" statement
- Optional: embedded map placeholder div with a note about where to add Google Maps

### Section 7: Call to Action (Final)
- Full-width colored section using the primary or accent color
- Strong headline: "Ready to Begin Your Healing Journey?"
- Repeat the primary CTA button
- Optional: phone number and email as secondary contact methods

### Section 8: Footer
- Simple, clean: practitioner name, copyright year, optional social links
- "Website by Hawaii Wellness" credit with link to hawaiiwellness.net
- Keep it minimal — 2-3 lines max

---

## HTML structure and technical requirements

### Boilerplate

Every generated HTML file must include:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Practitioner Name] — [Modality] in [City], Hawaiʻi</title>
  <meta name="description" content="[One sentence about the practitioner and what they offer]">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: { /* palette colors here */ },
          fontFamily: { /* font families here */ }
        }
      }
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=...&display=swap" rel="stylesheet">
  <style>
    /* Any custom CSS that can't be done with Tailwind utilities */
    html { scroll-behavior: smooth; }
  </style>
</head>
<body class="antialiased">
  <!-- sections here -->
</body>
</html>
```

### Technical rules

1. **Single file.** Everything in one `.html` file. No external CSS files, no separate JS files.
2. **Tailwind via CDN.** Use `https://cdn.tailwindcss.com` with inline config for custom colors and fonts.
3. **Google Fonts.** Load via `<link>` in `<head>`. Always use `display=swap` and `preconnect`.
4. **No JavaScript frameworks.** Pure HTML + Tailwind utilities. Minimal vanilla JS only for mobile menu toggle and smooth scroll.
5. **Images use placeholder approach.** Use solid color divs with descriptive comments like `<!-- Replace with practitioner photo: recommended 800x600px -->`. Never reference fake image URLs or use placeholder image services.
6. **Responsive.** Mobile-first. Every section must look great on 375px width. Use Tailwind's `md:` and `lg:` prefixes.
7. **Accessibility.** Proper heading hierarchy (h1 → h2 → h3, no skipping). Alt text placeholders on image containers. Sufficient color contrast (4.5:1 minimum for body text). Focus-visible states on interactive elements.
8. **Semantic HTML.** Use `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`. Each section gets an `id` for anchor links.
9. **No AI slop.** Avoid: purple gradients, centered-everything layouts, generic stock photo references, "Lorem ipsum" text, overly rounded corners on everything, gratuitous animations, the words "journey" and "transform" in every heading.

---

## mobile navigation

Include a simple hamburger menu for mobile. Here's the pattern:

```html
<nav class="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm shadow-sm">
  <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
    <a href="#" class="text-xl font-display font-bold">[Name]</a>
    <!-- Desktop nav -->
    <div class="hidden md:flex items-center gap-8">
      <a href="#about" class="text-sm font-medium hover:text-primary transition-colors">About</a>
      <a href="#services" class="text-sm font-medium hover:text-primary transition-colors">Services</a>
      <a href="#testimonials" class="text-sm font-medium hover:text-primary transition-colors">Testimonials</a>
      <a href="#contact" class="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">Book Now</a>
    </div>
    <!-- Mobile toggle -->
    <button onclick="document.getElementById('mobile-menu').classList.toggle('hidden')" class="md:hidden p-2">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
  </div>
  <!-- Mobile menu -->
  <div id="mobile-menu" class="hidden md:hidden px-4 pb-4 space-y-3">
    <a href="#about" class="block py-2 text-sm font-medium">About</a>
    <a href="#services" class="block py-2 text-sm font-medium">Services</a>
    <a href="#testimonials" class="block py-2 text-sm font-medium">Testimonials</a>
    <a href="#contact" class="block py-2 px-4 bg-primary text-white text-center rounded-lg text-sm font-semibold">Book Now</a>
  </div>
</nav>
```

---

## adapting to the practitioner's modality

The design must feel custom to the practitioner's world. Here's how to adapt beyond just color:

**Massage / Bodywork**: Flowing, organic shapes. Soft shadows. Imagery suggestions reference hands, stones, natural textures. Use rounded corners generously. Warm, inviting language.

**Yoga / Breathwork / Meditation**: Spacious layouts with generous whitespace. Minimal visual clutter. Let the page "breathe." Larger text sizes. Muted, natural colors. Subtle background textures.

**Acupuncture / TCM / Ayurveda**: Balance tradition with modernity. Clean lines but with nods to cultural aesthetics. Earth tones. Structured, organized layout that conveys precision.

**Psychotherapy / Counseling**: Professional and warm simultaneously. Avoid anything too "woo." Neutral palette with one warm accent. Clear, straightforward copy. Privacy/confidentiality statement visible.

**Hawaiian Healing / Lomilomi**: Rich earth tones (terracotta, deep greens, ocean blues). Hawaiian words where culturally appropriate (with translations). Sense of place — reference the ʻāina (land). Warm, story-driven copy.

**Chiropractic / Physical Therapy / Functional Medicine**: Clean, clinical feel. White space. Structured grid. Trust badges prominent. Evidence-based language. Professional headshot essential.

**Energy Healing / Reiki / Sound Healing**: Ethereal but not cheesy. Soft gradients rather than solid blocks. Lighter color palette. Gentle transitions between sections. Avoid cliché crystal/chakra imagery descriptions.

---

## quality checklist

Before delivering the HTML file, verify:

- [ ] Page looks intentional and polished at 375px mobile width
- [ ] Page looks great at 1440px desktop width
- [ ] Navigation works (hamburger toggles on mobile, anchor links scroll)
- [ ] Color contrast meets 4.5:1 for all body text
- [ ] Heading hierarchy is correct (single h1, logical h2/h3 flow)
- [ ] Every section has an id for anchor navigation
- [ ] CTA buttons are prominent and have hover states
- [ ] No placeholder text remains ("Lorem ipsum", "[Your text here]", etc.)
- [ ] No broken image references — all images are placeholder divs with comments
- [ ] Footer includes "Website by Hawaii Wellness" credit
- [ ] Title tag and meta description are set with practitioner info
- [ ] Page uses semantic HTML (header, nav, main, section, footer)
- [ ] Fonts load from Google Fonts with preconnect and display=swap
- [ ] Tailwind config includes custom palette colors
- [ ] Mobile menu hamburger works with the onclick toggle
- [ ] No AI slop: no purple gradients, no gratuitous animations, no "transform your journey" clichés

---

## what you receive as input

The user will provide some combination of:
- Practitioner name
- Modality/modalities (e.g., "massage therapy and craniosacral")
- Location (island, city)
- Bio or about text
- Services offered (possibly with prices)
- Testimonials
- Contact info (phone, email, website)
- Booking URL
- Photo descriptions or preferences
- Any specific style preferences

Work with whatever you're given. If critical info is missing (like their name), ask. For everything else, make tasteful assumptions and note what the practitioner should customize with `<!-- CUSTOMIZE: ... -->` comments in the HTML.

---

## output

Deliver a single HTML file named `[practitioner-name-slug].html` (e.g., `sarah-chen-acupuncture.html`).

Before the code, give a brief 2-3 sentence summary of the design decisions you made: which palette, which typography system, which hero style, and why.

After the code, list 3-5 things the practitioner should customize (photo placeholders to fill, text to personalize, booking URL to add, etc.).
