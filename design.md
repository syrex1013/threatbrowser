---
version: '1.0.0'
name: 'ThreatVector'
site: 'https://threatvector.tech'
description: >-
  Canonical design system for ThreatVector: an enterprise cybersecurity and
  penetration-testing brand built around architectural precision, high-contrast
  red-and-white minimalism, disciplined typography, sparse ornamentation, and
  conversion-focused layouts.
status: 'canonical'
updated: '2026-09-08'

brand:
  archetype: 'Architectural Cybersecurity'
  attributes:
    - authoritative
    - precise
    - technical
    - controlled
    - credible
    - direct
  visualPrinciples:
    - 'Signal, not decoration'
    - 'Structure before effects'
    - 'Evidence before claims'
    - 'Whitespace creates authority'
    - 'Red marks priority'

colors:
  primary: '#ff0000'
  primaryHover: '#dc0000'
  primaryActive: '#c70000'
  primarySoft: '#fff1f1'
  onPrimary: '#ffffff'

  ink: '#212529'
  inkStrong: '#15171a'
  inkMuted: '#495057'
  inkSubtle: '#6c757d'
  inverseInk: '#ffffff'

  background: '#ffffff'
  surface: '#ffffff'
  surfaceSubtle: '#f8f9fa'
  surfaceMuted: '#f0f1f3'
  surfaceStrong: '#e9ecef'

  border: '#dee2e6'
  borderStrong: '#adb5bd'

  info: '#0d6efd'
  infoSoft: '#cfe2ff'
  success: '#198754'
  successSoft: '#d1e7dd'
  warning: '#b76e00'
  warningSoft: '#fff3cd'
  error: '#dc3545'
  errorSoft: '#f8d7da'

  focus: '#ff0000'
  selection: '#ffe3e3'

typography:
  family:
    brand: '"TT Mussels", "Inter", "Helvetica Neue", Arial, sans-serif'
    mono: '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace'

  display:
    desktop: 'clamp(3rem, 5vw, 4.5rem)'
    mobile: 'clamp(2.5rem, 11vw, 3.5rem)'
    weight: 700
    lineHeight: 0.98
    letterSpacing: '-0.045em'

  h1:
    size: 'clamp(2.5rem, 4.5vw, 3.75rem)'
    weight: 700
    lineHeight: 1.02
    letterSpacing: '-0.04em'

  h2:
    size: 'clamp(2rem, 3.5vw, 2.75rem)'
    weight: 600
    lineHeight: 1.08
    letterSpacing: '-0.03em'

  h3:
    size: 'clamp(1.5rem, 2.5vw, 2rem)'
    weight: 600
    lineHeight: 1.15
    letterSpacing: '-0.02em'

  h4:
    size: '1.25rem'
    weight: 600
    lineHeight: 1.3
    letterSpacing: '-0.01em'

  bodyLg:
    size: '1.125rem'
    weight: 400
    lineHeight: 1.6
    letterSpacing: '0'

  body:
    size: '1rem'
    weight: 400
    lineHeight: 1.55
    letterSpacing: '0'

  bodySm:
    size: '0.875rem'
    weight: 400
    lineHeight: 1.5
    letterSpacing: '0'

  label:
    size: '0.875rem'
    weight: 600
    lineHeight: 1.25
    letterSpacing: '0.015em'

  eyebrow:
    size: '0.75rem'
    weight: 600
    lineHeight: 1.25
    letterSpacing: '0.08em'
    transform: 'uppercase'

  metric:
    size: 'clamp(2.5rem, 5vw, 4rem)'
    weight: 600
    lineHeight: 1
    letterSpacing: '-0.04em'

spacing:
  '0': '0'
  '1': '0.25rem'
  '2': '0.5rem'
  '3': '0.75rem'
  '4': '1rem'
  '5': '1.25rem'
  '6': '1.5rem'
  '8': '2rem'
  '10': '2.5rem'
  '12': '3rem'
  '16': '4rem'
  '20': '5rem'
  '24': '6rem'
  '32': '8rem'
  sectionDesktop: 'clamp(5rem, 9vw, 8rem)'
  sectionMobile: '4rem'
  gutterDesktop: '1.5rem'
  gutterMobile: '1.25rem'

radii:
  none: '0'
  control: '0.25rem'
  panel: '0.5rem'
  badge: '9999px'

borders:
  hairline: '1px solid #dee2e6'
  strong: '1px solid #adb5bd'
  primary: '2px solid #ff0000'

elevation:
  none: 'none'
  hover: '0 3px 8px rgba(0, 0, 0, 0.10)'
  overlay: '0 1rem 3rem rgba(0, 0, 0, 0.16)'

motion:
  fast: '120ms'
  standard: '180ms'
  slow: '280ms'
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'

layout:
  maxWidth: '82.5rem'
  readingWidth: '46rem'
  narrowWidth: '38rem'
  gridColumns: 12
  gridGap: '1.5rem'
  heroMinHeight: 'calc(100svh - 5rem)'

breakpoints:
  sm: '30rem'
  md: '48rem'
  lg: '64rem'
  xl: '80rem'
  xxl: '90rem'

components:
  buttonPrimary:
    height: '3.5rem'
    padding: '0 2rem'
    radius: '0'
    background: '#ff0000'
    foreground: '#ffffff'
    border: '2px solid #ff0000'
  buttonSecondary:
    height: '3.5rem'
    padding: '0 2rem'
    radius: '0'
    background: 'transparent'
    foreground: '#212529'
    border: '1px solid #adb5bd'
  input:
    minHeight: '3rem'
    radius: '0.25rem'
    background: '#ffffff'
    border: '1px solid #adb5bd'
  card:
    radius: '0'
    background: '#ffffff'
    border: '1px solid #dee2e6'
---

# ThreatVector Design System

This file is the **canonical visual and interaction specification** for `threatvector.tech`. It is intended to be usable directly by designers, frontend engineers, and coding agents. When an implementation conflicts with this file, this file wins unless a newer explicitly approved design decision supersedes it.

ThreatVector should look like a security firm that understands offensive security at a deep technical level while still being credible to enterprise buyers. It must not look like a gaming brand, crypto project, generic SaaS template, hacker-themed portfolio, or neon cyberpunk landing page.

---

## 1. Brand Direction

### 1.1 Core idea

**Architectural Cybersecurity**: a controlled, high-contrast visual system made from white space, dark typography, precise borders, sharp geometry, and signal red.

The visual tone should communicate:

- precision rather than spectacle;
- urgency without panic;
- technical depth without visual clutter;
- enterprise credibility without corporate blandness;
- offensive-security expertise without "hacker aesthetic" clichés.

### 1.2 Brand personality

ThreatVector is:

- **Authoritative** — confident wording and decisive hierarchy.
- **Technical** — specific terminology, evidence, metrics, and concrete deliverables.
- **Controlled** — disciplined spacing and deliberately limited color.
- **Direct** — short paths to important information and conversion actions.
- **Minimal** — every visual element must justify its existence.

ThreatVector is not:

- playful;
- futuristic for its own sake;
- gradient-heavy;
- glowing/neon;
- glassmorphic;
- over-rounded;
- illustration-driven;
- filled with decorative terminal noise, fake code, matrix rain, or stock padlock imagery.

### 1.3 Design principle hierarchy

When making a design decision, use this order:

1. **Clarity** — can the user immediately understand the content and action?
2. **Credibility** — does the UI look trustworthy enough for an enterprise security engagement?
3. **Hierarchy** — is the most important information visually dominant?
4. **Evidence** — are claims supported by concrete proof, process, metrics, credentials, or deliverables?
5. **Restraint** — can any decoration be removed without losing meaning?
6. **Brand expression** — use red and framing marks only after the previous conditions are satisfied.

---

## 2. Visual Language

### 2.1 Signature elements

The ThreatVector identity should be recognizable from a small set of repeatable visual devices:

- pure or near-pure white page surfaces;
- charcoal type;
- bright signal red `#ff0000` for priority;
- sharp primary CTAs;
- thin structural borders;
- red corner brackets / L-shaped framing marks;
- large, tightly tracked headlines;
- oversized proof metrics;
- generous empty space;
- sparse use of monospace labels for technical metadata.

Use these devices consistently. Do not invent a new visual gimmick for each section.

### 2.2 Red usage rule

Red is a **signal color**, not a fill color.

Use `#ff0000` for:

- the principal CTA;
- the active or most important interactive state;
- key brand marks;
- small structural accents;
- selected dividers;
- short eyebrow labels;
- high-priority links;
- critical security status where semantically appropriate.

Do **not** use red for:

- full-page or full-section backgrounds except for a rare high-impact CTA block;
- every icon;
- every heading;
- ordinary body copy;
- decorative gradients;
- large card collections;
- success states.

As a practical rule, a typical viewport should remain overwhelmingly white/neutral. Red should usually occupy **well under 10% of visible area**.

---

## 3. Color System

### 3.1 Core palette

| Token            |       Hex | Purpose                                     |
| ---------------- | --------: | ------------------------------------------- |
| `primary`        | `#ff0000` | Brand signal, primary CTA, important accent |
| `primary-hover`  | `#dc0000` | Primary hover                               |
| `primary-active` | `#c70000` | Primary pressed state                       |
| `primary-soft`   | `#fff1f1` | Rare subtle red-tinted support surface      |
| `ink`            | `#212529` | Main typography                             |
| `ink-strong`     | `#15171a` | Maximum-emphasis headings                   |
| `ink-muted`      | `#495057` | Secondary text                              |
| `ink-subtle`     | `#6c757d` | Captions / metadata                         |
| `background`     | `#ffffff` | Main page background                        |
| `surface-subtle` | `#f8f9fa` | Quiet alternate section                     |
| `surface-muted`  | `#f0f1f3` | Hover / utility surface                     |
| `surface-strong` | `#e9ecef` | Stronger structural fill                    |
| `border`         | `#dee2e6` | Default borders / dividers                  |
| `border-strong`  | `#adb5bd` | Interactive controls / stronger boundary    |
| `info`           | `#0d6efd` | Informational state only                    |
| `success`        | `#198754` | Verified / successful state                 |
| `warning`        | `#b76e00` | Warning state                               |
| `error`          | `#dc3545` | Error / destructive state                   |

### 3.2 Semantic color behavior

Do not overload brand red with every semantic state. A security site benefits from disciplined status semantics:

- **brand / priority:** `primary`
- **informational:** `info`
- **verified / success:** `success`
- **warning:** `warning`
- **error / destructive:** `error`

The brand red may visually resemble an error color, so semantic context must be explicit with text/icons rather than color alone.

### 3.3 Alternate sections

Preferred section treatments, in order:

1. white background + spacing;
2. white background + top border;
3. `surface-subtle` background;
4. charcoal inverse section for one strategic proof/CTA area;
5. red background only as a rare conversion punch.

Do not stripe every section with alternating backgrounds.

### 3.4 Selection

Text selection may use `#ffe3e3` with charcoal text.

---

## 4. Typography

### 4.1 Primary family

Use **TT Mussels** as the brand typeface where licensed and available.

Recommended stack:

```css
font-family: 'TT Mussels', 'Inter', 'Helvetica Neue', Arial, sans-serif;
```

If TT Mussels is self-hosted, ship optimized WOFF2 assets and use `font-display: swap`.

### 4.2 Monospace family

Use monospace only for technical metadata, endpoint examples, identifiers, service tags, small process labels, dates, and selected statistics.

```css
font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
```

Do not render entire paragraphs or primary navigation in monospace.

### 4.3 Type scale

#### Display / hero

```css
font-size: clamp(3rem, 5vw, 4.5rem);
font-weight: 700;
line-height: 0.98;
letter-spacing: -0.045em;
```

Target use: home-page hero only, or one exceptionally important campaign headline.

#### H1

```css
font-size: clamp(2.5rem, 4.5vw, 3.75rem);
font-weight: 700;
line-height: 1.02;
letter-spacing: -0.04em;
```

#### H2

```css
font-size: clamp(2rem, 3.5vw, 2.75rem);
font-weight: 600;
line-height: 1.08;
letter-spacing: -0.03em;
```

#### H3

```css
font-size: clamp(1.5rem, 2.5vw, 2rem);
font-weight: 600;
line-height: 1.15;
letter-spacing: -0.02em;
```

#### H4 / card title

```css
font-size: 1.25rem;
font-weight: 600;
line-height: 1.3;
letter-spacing: -0.01em;
```

#### Lead body

```css
font-size: 1.125rem;
line-height: 1.6;
```

#### Body

```css
font-size: 1rem;
line-height: 1.55;
```

#### Small copy

```css
font-size: 0.875rem;
line-height: 1.5;
```

#### Eyebrow / technical label

```css
font-size: 0.75rem;
font-weight: 600;
line-height: 1.25;
letter-spacing: 0.08em;
text-transform: uppercase;
```

### 4.4 Heading rules

- Use sentence case by default.
- Keep hero lines short enough to preserve visual authority.
- Avoid artificial all-caps headlines.
- Avoid weak single-word line wraps where possible.
- Aim for roughly 10–15 words maximum in an H1.
- Use negative tracking only on large headings, never body copy.
- Do not color entire headings red. At most, accent one short phrase if it materially improves hierarchy.

### 4.5 Measure

- Standard prose width: `46rem` maximum.
- Narrow explanatory copy: `38rem` maximum.
- Hero subcopy: approximately `40–44rem` maximum.
- Avoid long full-width text blocks inside the `82.5rem` container.

---

## 5. Spacing System

Use an 8px-derived rhythm with 4px available only for micro-adjustments.

| Token | Value |
| ----- | ----: |
| `1`   |   4px |
| `2`   |   8px |
| `3`   |  12px |
| `4`   |  16px |
| `5`   |  20px |
| `6`   |  24px |
| `8`   |  32px |
| `10`  |  40px |
| `12`  |  48px |
| `16`  |  64px |
| `20`  |  80px |
| `24`  |  96px |
| `32`  | 128px |

### 5.1 Section rhythm

Desktop section padding:

```css
padding-block: clamp(5rem, 9vw, 8rem);
```

Mobile section padding:

```css
padding-block: 4rem;
```

Use smaller values only for tightly connected subsections.

### 5.2 Internal rhythm

Typical component spacing:

- eyebrow → heading: 12–16px;
- heading → supporting copy: 20–24px;
- copy → CTA cluster: 28–32px;
- card title → copy: 12px;
- card internal blocks: 16–24px;
- grid rows: 24–32px;
- major content groups: 40–64px.

Whitespace is a structural element. Do not "fill" empty areas merely because they look unused.

---

## 6. Grid & Layout

### 6.1 Container

```css
width: min(100% - 3rem, 82.5rem);
margin-inline: auto;
```

On small screens:

```css
width: min(100% - 2.5rem, 82.5rem);
```

### 6.2 Grid

Use a 12-column desktop grid with a `1.5rem` gap.

Common compositions:

- hero: 7/5 or centered 8-column content;
- service section: 4/4/4;
- proof + narrative: 5/7;
- case study teaser: 7/5;
- footer: 4/2/2/4;
- long-form article: 8 columns centered or 3/6/3.

### 6.3 Breakpoints

| Name  |  Width |
| ----- | -----: |
| `sm`  |  480px |
| `md`  |  768px |
| `lg`  | 1024px |
| `xl`  | 1280px |
| `xxl` | 1440px |

Use content-driven breakpoints if a component breaks earlier. Do not depend on breakpoint values as a substitute for testing.

### 6.4 Mobile layout

Below `768px`:

- collapse multi-column sections to one column unless two columns remain clearly legible;
- align text left by default;
- keep tap targets at least 44×44px;
- maintain 20px side gutters minimum;
- stack CTA buttons vertically when labels no longer fit naturally;
- hide or simplify non-essential framing marks;
- never require horizontal scrolling.

---

## 7. Shape Language

### 7.1 Primary geometry

The signature shape is **sharp**.

Use `0px` radius for:

- primary CTA buttons;
- major secondary CTA buttons;
- hero framing marks;
- service tiles when used as brand-signature blocks;
- major proof panels;
- prominent logo containers.

### 7.2 Functional rounding

Use restrained rounding only where it improves usability:

- inputs: 4px;
- small utility controls: 4px;
- passive information panels: 8px maximum;
- pills/badges: fully rounded only when they are genuinely tags/status tokens.

Do not mix 0px, 4px, 8px, 12px, 16px, and 24px radii arbitrarily on one page.

### 7.3 Borders

Borders are preferred over shadows.

Default:

```css
border: 1px solid #dee2e6;
```

Interactive/strong:

```css
border-color: #adb5bd;
```

Brand-emphasis border:

```css
border: 2px solid #ff0000;
```

---

## 8. Elevation

ThreatVector is fundamentally flat.

Use this hierarchy:

1. whitespace;
2. border;
3. background tone;
4. small shadow;
5. large overlay shadow only for true overlays.

### Allowed shadows

```css
/* Hover only, optional */
box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);

/* Dialog / overlay only */
box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.16);
```

Never use:

- colored glows;
- neon shadows;
- diffuse floating-card shadows across the entire page;
- glass blur as a hierarchy device.

---

## 9. Motion & Interaction

Motion should feel mechanical, quick, and deliberate.

### 9.1 Durations

- hover: `120ms`;
- standard component transition: `180ms`;
- drawer/modal/large reveal: `280ms` maximum.

Preferred easing:

```css
cubic-bezier(0.2, 0.8, 0.2, 1)
```

### 9.2 Allowed movement

Use:

- subtle color transitions;
- 1–2px translate on deliberate hover states if needed;
- underline expansion;
- border-color transition;
- opacity/transform entrance for content once, sparingly.

Avoid:

- bouncing;
- parallax-heavy hero sections;
- looping animations;
- animated fake terminals;
- cursor-following effects;
- long scroll-jacking sequences;
- rotating 3D cybersecurity objects.

### 9.3 Reduced motion

Respect:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Component System

## 10.1 Header / Navigation

### Desktop

- height: roughly 72–80px;
- white background;
- no default shadow;
- optional 1px bottom border after scroll;
- logo left;
- navigation centered or right-balanced;
- primary CTA at far right;
- navigation labels: 14–16px, semibold;
- inactive links: `ink-muted`;
- active/hover links: `ink` or red underline/accent.

Do not place every nav item inside a button.

### Sticky behavior

Sticky header is acceptable if it remains compact. On scroll, use white + subtle border, not blur-heavy glassmorphism.

### Mobile

- logo left;
- menu toggle right;
- 44×44px minimum toggle hit area;
- menu may open as a full-width white drawer;
- preserve the principal CTA inside the menu.

---

## 10.2 Primary Button

Primary buttons are the strongest conversion control and therefore use the sharp brand geometry.

```css
.tv-button-primary {
  min-height: 3.5rem;
  padding-inline: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  border: 2px solid #ff0000;
  border-radius: 0;
  background: #ff0000;
  color: #ffffff;
  font: inherit;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  transition:
    background-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 120ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.tv-button-primary:hover {
  background: #dc0000;
  border-color: #dc0000;
}

.tv-button-primary:active {
  background: #c70000;
  border-color: #c70000;
  transform: translateY(1px);
}
```

Use one dominant primary CTA per local decision area.

Good labels:

- `Request a penetration test`
- `Book a security assessment`
- `Discuss your scope`
- `View penetration testing services`

Avoid generic labels such as `Learn more` when a specific action is available.

---

## 10.3 Secondary Button

```css
.tv-button-secondary {
  min-height: 3.5rem;
  padding-inline: 2rem;
  border: 1px solid #adb5bd;
  border-radius: 0;
  background: transparent;
  color: #212529;
  font-weight: 600;
}

.tv-button-secondary:hover {
  border-color: #212529;
  background: #f8f9fa;
}
```

For a red outlined secondary button, use it only when it remains clearly subordinate to the solid-red action.

---

## 10.4 Text Link

Default body links must be visually identifiable without relying solely on color.

```css
color: #c70000;
text-decoration: underline;
text-underline-offset: 0.18em;
```

Navigation links may omit the underline until hover/focus.

---

## 10.5 Cards / Service Tiles

Cards should feel like structural modules, not floating SaaS cards.

Default service tile:

```css
border: 1px solid #dee2e6;
border-radius: 0;
background: #ffffff;
padding: clamp(1.5rem, 3vw, 2rem);
```

Optional hover:

```css
border-color: #adb5bd;
background: #f8f9fa;
```

Use shadows only if the interaction needs additional affordance.

### Card anatomy

1. small index / service code / category;
2. concise title;
3. 1–3 sentence description;
4. concrete deliverables or scope bullets;
5. text CTA;
6. optional small red rule or corner accent.

Do not put a large decorative icon above every card by default.

---

## 10.6 Inputs

```css
.tv-input {
  min-height: 3rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #adb5bd;
  border-radius: 0.25rem;
  background: #ffffff;
  color: #212529;
}

.tv-input:hover {
  border-color: #6c757d;
}

.tv-input:focus-visible {
  outline: 2px solid #ff0000;
  outline-offset: 2px;
  border-color: #ff0000;
}
```

### Form rules

- visible labels are mandatory;
- placeholder text never replaces a label;
- error copy appears adjacent to the field;
- error state uses icon/text in addition to color;
- helper copy uses `ink-subtle`;
- textarea minimum height: ~140px;
- forms should ask only for information required to qualify the engagement.

---

## 10.7 Badges / Status Chips

Badges are allowed for:

- `Web Application`
- `External Assessment`
- `API Security`
- `Verified`
- `Report Included`
- standards / technology taxonomy.

Badges are not decorative confetti.

Recommended:

```css
font-size: 0.75rem;
font-weight: 600;
padding: 0.3rem 0.65rem;
border: 1px solid #dee2e6;
border-radius: 9999px;
background: #ffffff;
color: #495057;
```

Use a semantic background only for actual statuses.

---

## 10.8 Metrics / Trust Proof

Metrics should be unusually prominent but never fabricated.

Recommended structure:

```text
[large metric]
[short proof label]
[optional qualification/source]
```

Metric typography:

```css
font-size: clamp(2.5rem, 5vw, 4rem);
font-weight: 600;
line-height: 1;
letter-spacing: -0.04em;
```

Examples of valid proof categories:

- years of combined experience;
- confirmed findings;
- assessment turnaround ranges;
- remediation verification;
- service coverage;
- client testimonials;
- certifications;
- public research;
- responsible disclosures.

Only publish claims that can be substantiated.

---

## 10.9 Dividers & Framing Marks

Red L-shaped corner brackets are a signature visual device.

Use them for:

- hero framing;
- one featured proof block;
- a major CTA section;
- selected callout modules.

Do not put brackets around every card.

Recommended bracket characteristics:

- 2px line;
- 24–48px arm length depending on scale;
- `#ff0000`;
- zero radius;
- no glow;
- not animated continuously.

---

## 10.10 Code / Technical Evidence Blocks

Technical snippets should feel like evidence, not cosplay.

Use monospace for:

- sanitized HTTP excerpts;
- vulnerability taxonomy;
- example endpoint paths;
- CVSS vectors;
- methodology labels;
- remediation verification states.

Default code block:

```css
background: #15171a;
color: #f8f9fa;
border-radius: 0;
border-left: 3px solid #ff0000;
padding: 1.25rem 1.5rem;
overflow-x: auto;
```

Never expose real client secrets or sensitive assessment data in visual examples.

---

## 10.11 Accordion / FAQ

- one-pixel dividers;
- no card shadow;
- full-row hit target;
- minimum 48px interactive height;
- plus/minus or chevron icon;
- animation optional and under 180ms;
- question text semibold;
- answer text constrained to readable width.

---

## 10.12 Modal / Dialog

Dialogs are reserved for focused tasks, not ordinary marketing copy.

- white surface;
- 0–8px radius maximum;
- strong accessible heading;
- visible close control;
- keyboard focus trap;
- Escape closes when safe;
- overlay shadow allowed;
- background overlay should be neutral dark transparency, not blur-first glass.

---

## 11. Home Page Architecture

The homepage should make the service, credibility, and next action clear within seconds.

Recommended sequence:

### 11.1 Header

Logo, Services, Approach, Research/Insights, About, Contact, plus one dominant CTA.

### 11.2 Hero

Required elements:

- short eyebrow or category label;
- strong H1 describing the security outcome/service;
- concise supporting copy;
- one primary CTA;
- one secondary CTA or proof link;
- red architectural brackets;
- optional compact trust proof row.

The hero should not depend on a stock photo to communicate credibility.

### 11.3 Trust / Proof Strip

Use real, verifiable proof such as:

- scope types;
- certifications;
- recognized methodologies;
- client sectors;
- response/turnaround facts;
- research/disclosure credentials.

If logos are used, keep them monochrome or low-emphasis so they do not compete with the brand.

### 11.4 Core Services

Display the highest-value services in a structured grid. Prefer specific labels over broad marketing categories.

Potential categories:

- Web Application Penetration Testing
- API Security Testing
- External Infrastructure Assessment
- Internal Network Penetration Testing
- Cloud Security Assessment
- Adversary Simulation / Red Teaming
- Vulnerability Assessment
- Remediation Verification

Only show services actually offered.

### 11.5 Method / Engagement Process

Use a clear numbered sequence, e.g.:

`01 Scope → 02 Test → 03 Validate → 04 Report → 05 Remediate → 06 Retest`

This section should reduce buyer uncertainty.

### 11.6 Featured Evidence / Case Study

Prefer an anonymized, factual engagement narrative over generic testimonial fluff:

- context;
- scope;
- finding class;
- impact;
- remediation outcome;
- what changed after the engagement.

### 11.7 Why ThreatVector

Use 3–5 specific differentiators. Avoid statements any pentesting company could claim.

Strong differentiator types:

- manual depth;
- reproducible evidence;
- remediation-oriented reporting;
- senior tester involvement;
- clear communication;
- realistic attack paths;
- retesting / verification;
- fast escalation for critical findings.

### 11.8 Final CTA

Strong headline + concise risk/outcome statement + one action.

A dark inverse section can work here, with one red CTA.

### 11.9 Footer

Include:

- service navigation;
- legal/privacy;
- contact route;
- social/professional profiles if maintained;
- company/legal information where required;
- copyright;
- optional security contact / disclosure link.

---

## 12. Service Page Template

Every major service page should follow a predictable structure.

1. Eyebrow + precise H1
2. Outcome-focused introduction
3. Ideal use cases / when to run the assessment
4. Scope examples
5. What is tested
6. Methodology / standards
7. Deliverables
8. Example finding anatomy
9. Engagement process
10. Retest / remediation support
11. FAQ
12. CTA

A service page should answer procurement and technical questions without requiring the user to decode marketing language.

---

## 13. Case Study / Research Template

### Case study

- Context
- Objective
- Scope
- Constraints
- Approach
- Key finding(s)
- Business/security impact
- Remediation
- Verification
- Outcome

### Research / technical article

- concise thesis;
- clear date and author;
- optional severity/technology tags;
- readable 46rem text measure;
- anchored headings;
- code/evidence blocks where necessary;
- references;
- related research;
- CTA after the article, not repeatedly inside it.

---

## 14. Iconography

Use icons only when they make scanning faster.

Preferred style:

- outline or simple solid geometry;
- 1.5–2px stroke;
- square / technical proportions;
- charcoal by default;
- red only for high-priority emphasis.

Avoid:

- glossy 3D icons;
- colored icon bubbles for every feature;
- cartoon shields;
- generic locks everywhere;
- skulls or anonymous-mask imagery as brand shorthand.

---

## 15. Imagery

ThreatVector should not rely on clichéd cybersecurity stock photography.

Preferred visual evidence:

- cropped/redacted report pages;
- sanitized attack-chain diagrams;
- real conference/research photography;
- infrastructure/topology diagrams;
- clean screenshots of proprietary tooling if relevant;
- abstract geometric threat maps only when derived from real data;
- close technical photography with restrained treatment.

If photography is used:

- keep it editorial and credible;
- avoid blue "hacker hoodie" lighting;
- avoid giant lock overlays;
- avoid binary-code stock art;
- do not apply red gradients merely to force brand alignment.

---

## 16. Data Visualization

If charts appear in research or reports:

- prioritize readable labels over decorative styling;
- use charcoal for default series;
- use red to highlight the series/point being discussed;
- use blue/green only where semantically useful;
- avoid rainbow palettes;
- show values directly when feasible;
- use subtle grid lines;
- do not use 3D charts;
- maintain accessible contrast.

---

## 17. Content & Voice

### 17.1 Voice

ThreatVector copy is:

- direct;
- technical;
- specific;
- calm;
- evidence-led;
- action-oriented.

### 17.2 Writing style

Prefer:

> We identify exploitable attack paths, demonstrate impact safely, and provide remediation guidance your engineering team can act on.

Avoid:

> In today’s ever-evolving digital landscape, cyber threats are more sophisticated than ever and businesses need next-generation protection.

### 17.3 Vocabulary

Use concrete security language where accurate:

- attack surface;
- exploitability;
- authentication;
- authorization;
- privilege escalation;
- lateral movement;
- attack path;
- business impact;
- evidence;
- remediation;
- retest;
- scope;
- rules of engagement;
- severity;
- CVSS;
- OWASP;
- PTES;
- MITRE ATT&CK;
- compliance requirement.

Do not force jargon into executive-facing paragraphs when plain language is stronger.

### 17.4 Claims

Avoid unsupported phrases such as:

- `military-grade`;
- `unhackable`;
- `100% secure`;
- `world-leading` without evidence;
- `trusted worldwide` without substantiation;
- exaggerated fear language.

Security credibility is strengthened by specificity and weakened by inflated claims.

---

## 18. Accessibility

Target **WCAG 2.2 AA** as a baseline.

### 18.1 Keyboard

- every action must be keyboard reachable;
- focus order follows visual order;
- no keyboard traps except correctly implemented modal focus containment;
- skip-to-content link is required;
- menu and accordion controls expose correct expanded state.

### 18.2 Focus

Use a visible red focus ring with sufficient offset:

```css
:focus-visible {
  outline: 2px solid #ff0000;
  outline-offset: 3px;
}
```

Do not remove focus outlines without a replacement.

### 18.3 Color

- never communicate status with color alone;
- verify text contrast programmatically;
- do not use bright red for small body text on white unless contrast is sufficient for the specific size/weight;
- prefer darker red (`#c70000`) for inline text links when needed for contrast.

### 18.4 Targets

Interactive targets should be at least 44×44 CSS pixels where practical.

### 18.5 Semantics

- one logical H1 per page;
- headings must not skip levels for styling reasons;
- use native `button`, `a`, `nav`, `main`, `section`, `form`, `label`, `dialog` semantics before ARIA;
- images require useful alt text or empty alt when decorative;
- decorative brackets must be hidden from assistive technology.

---

## 19. Responsive Behavior

### Desktop (>1024px)

- preserve generous whitespace;
- use 12-column compositions;
- allow headline scale to reach full size;
- keep hero proof and CTA clusters visually separated;
- show framing elements at full scale.

### Tablet (768–1024px)

- reduce section spacing modestly;
- convert 3-column service grids to 2 columns when required;
- simplify hero side content;
- maintain full-width readable controls.

### Mobile (<768px)

- single-column content by default;
- left-align hero and service copy unless a centered composition clearly works;
- display headline at no more than ~56px and usually 40–52px;
- use compact framing accents;
- stack button groups when necessary;
- cards should not feel cramped; preserve at least 20–24px padding;
- avoid ultra-large empty areas inherited from desktop spacing;
- never clip technical snippets; make them horizontally scrollable.

---

## 20. Performance & Implementation Quality

The design should feel fast as well as look precise.

### Required implementation behavior

- optimize TT Mussels font files and preload only essential weights;
- use responsive image formats (`avif` / `webp`) where appropriate;
- lazy-load below-the-fold imagery;
- reserve image dimensions to avoid layout shift;
- avoid large animation libraries for minor effects;
- prefer CSS for transitions and framing marks;
- keep client-side JavaScript minimal on marketing pages;
- render meaningful HTML before enhancement;
- optimize for Core Web Vitals.

### Security-site implementation detail

Do not load unnecessary third-party scripts. A cybersecurity site that leaks excessive telemetry or ships a bloated dependency surface undermines its own credibility.

---

## 21. SEO / Content Structure

Design and document structure should support technical SEO without visually degrading the page.

- one descriptive H1;
- semantic H2/H3 hierarchy;
- concise title and meta description;
- canonical URL;
- descriptive internal link labels;
- structured data where applicable;
- visible author/date for research content;
- meaningful service page copy rather than thin hero-only pages;
- FAQ schema only when the FAQ is genuinely present and eligible;
- breadcrumb navigation on deep pages where useful.

---

## 22. CSS Variable Reference

Use this as the default implementation layer.

```css
:root {
  /* Brand */
  --tv-red: #ff0000;
  --tv-red-hover: #dc0000;
  --tv-red-active: #c70000;
  --tv-red-soft: #fff1f1;

  /* Ink */
  --tv-ink: #212529;
  --tv-ink-strong: #15171a;
  --tv-ink-muted: #495057;
  --tv-ink-subtle: #6c757d;

  /* Surfaces */
  --tv-bg: #ffffff;
  --tv-surface: #ffffff;
  --tv-surface-subtle: #f8f9fa;
  --tv-surface-muted: #f0f1f3;
  --tv-surface-strong: #e9ecef;

  /* Structure */
  --tv-border: #dee2e6;
  --tv-border-strong: #adb5bd;

  /* Semantic */
  --tv-info: #0d6efd;
  --tv-success: #198754;
  --tv-warning: #b76e00;
  --tv-error: #dc3545;

  /* Typography */
  --tv-font-sans: 'TT Mussels', 'Inter', 'Helvetica Neue', Arial, sans-serif;
  --tv-font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;

  /* Layout */
  --tv-container: 82.5rem;
  --tv-reading: 46rem;
  --tv-gutter: 1.5rem;

  /* Radius */
  --tv-radius-none: 0;
  --tv-radius-control: 0.25rem;
  --tv-radius-panel: 0.5rem;
  --tv-radius-pill: 9999px;

  /* Motion */
  --tv-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --tv-fast: 120ms;
  --tv-standard: 180ms;
  --tv-slow: 280ms;
}
```

---

## 23. Tailwind Mapping (Optional)

If using Tailwind, map tokens instead of scattering literal values throughout components.

```js
// conceptual mapping; adapt to your Tailwind version/config
{
  colors: {
    tv: {
      red: '#ff0000',
      'red-hover': '#dc0000',
      'red-active': '#c70000',
      ink: '#212529',
      muted: '#495057',
      subtle: '#6c757d',
      surface: '#ffffff',
      'surface-subtle': '#f8f9fa',
      border: '#dee2e6',
      'border-strong': '#adb5bd'
    }
  },
  borderRadius: {
    'tv-control': '0.25rem',
    'tv-panel': '0.5rem'
  },
  maxWidth: {
    'tv-container': '82.5rem',
    'tv-reading': '46rem'
  }
}
```

Do not let framework defaults redefine the brand geometry.

---

## 24. Design Decisions: Canonical Conflict Resolution

Previous ThreatVector design notes contained two different component scales. This canonical system resolves them as follows:

### Buttons

- **Primary / major secondary CTAs:** 56px minimum height, 0px radius.
- **Compact utility controls / nav-adjacent controls:** may use 40–48px height when appropriate, but should not replace the main conversion CTA pattern.

Reason: the larger sharp CTA has stronger brand recognition, stronger hierarchy, and better touch ergonomics.

### Cards

- default brand/service tile radius: `0px`;
- passive utility/information panel: up to `8px` radius;
- no automatic shadows.

Reason: architectural sharpness is the core visual signature, but light functional rounding remains useful for form and utility surfaces.

### Inputs

- 48px minimum standard height;
- 4px radius;
- explicit focus ring;
- neutral white surface rather than a permanently gray field.

### Typography

- preserve the more expressive 60px+ large-heading direction on desktop;
- use fluid `clamp()` sizing rather than fixed 40px/60px values;
- maintain negative tracking on large display type only.

### Spacing

- preserve the wide, premium layout from the spacious version;
- use a regular 8px-derived scale internally;
- large hero/section whitespace should be fluid rather than a hard-coded `190px` token.

---

## 25. Do / Don't

### Do

- use white as the dominant surface;
- reserve signal red for important decisions and brand-defining accents;
- use sharp primary CTAs;
- use borders before shadows;
- keep large headings tight and confident;
- use generous spacing between major content groups;
- show concrete security evidence and real deliverables;
- use red bracket framing sparingly and consistently;
- ensure all interactions are keyboard and touch accessible;
- keep copy specific and technically credible;
- verify every published metric and trust claim;
- make responsive behavior intentional rather than merely stacked.

### Don't

- do not use gradients as a default brand treatment;
- do not use glassmorphism;
- do not add neon red glows;
- do not turn the site into a fake terminal;
- do not use matrix rain, skulls, hooded hackers, or giant lock imagery;
- do not round primary CTAs into pills;
- do not use red for every element;
- do not place shadows on every card;
- do not mix unrelated typefaces;
- do not use enormous paragraphs inside the hero;
- do not use unsupported claims or fear-based copy;
- do not invent fake metrics, client logos, certifications, or testimonials;
- do not hide focus indicators;
- do not use animations that delay access to content;
- do not make mobile a compressed desktop layout.

---

## 26. Acceptance Checklist for Coding Agents

Before considering a page visually complete, verify all of the following.

### Brand

- [ ] White/neutral background dominates the page.
- [ ] `#ff0000` is used sparingly and intentionally.
- [ ] Main CTAs use sharp corners.
- [ ] No gradients, glassmorphism, neon glow, or cyberpunk clichés were introduced.
- [ ] TT Mussels or the approved fallback stack is used consistently.
- [ ] Red framing marks are sparse and structurally placed.

### Layout

- [ ] Desktop content respects the `82.5rem` maximum container.
- [ ] Long-form copy is constrained to ~`46rem`.
- [ ] Major sections have generous vertical spacing.
- [ ] Grid alignment is consistent across neighboring sections.
- [ ] Mobile has at least 20px horizontal gutters.
- [ ] No unintended horizontal overflow exists at 320px width.

### Components

- [ ] Primary buttons are at least 56px high unless explicitly compact.
- [ ] Standard mobile tap targets are at least 44×44px.
- [ ] Cards use borders before shadows.
- [ ] Inputs have visible labels and focus states.
- [ ] Links are distinguishable on hover/focus and in body content.
- [ ] Status colors are not the only status indicator.

### Typography

- [ ] One H1 per page.
- [ ] Heading hierarchy is semantic.
- [ ] Hero display type uses responsive `clamp()` sizing.
- [ ] No body text uses negative letter spacing.
- [ ] Paragraphs remain readable and are not excessively wide.

### Accessibility

- [ ] Keyboard navigation works end to end.
- [ ] Focus states are clearly visible.
- [ ] `prefers-reduced-motion` is respected.
- [ ] Decorative visual marks are ignored by assistive technology.
- [ ] Form errors are described in text.
- [ ] Color contrast is checked against WCAG 2.2 AA.

### Content credibility

- [ ] No fabricated numbers, logos, certifications, clients, or testimonials.
- [ ] Every major service communicates concrete scope/deliverables.
- [ ] CTA labels are specific rather than generic.
- [ ] Security terminology is used accurately.
- [ ] Claims are evidence-led and restrained.

### Performance

- [ ] No unnecessary third-party scripts.
- [ ] Fonts are optimized and only necessary weights load.
- [ ] Below-fold images are lazy-loaded.
- [ ] Images reserve layout dimensions.
- [ ] Animations do not require a heavy library unless justified.

---

## 27. Final Design Rule

If a proposed visual treatment is attractive but makes ThreatVector feel **less precise, less credible, less legible, or less controlled**, remove it.

The ideal ThreatVector page should feel like a high-quality penetration-test report translated into an enterprise web experience: **clear structure, strong evidence, decisive priority, zero visual noise.**
