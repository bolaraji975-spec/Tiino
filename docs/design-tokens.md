# Tino — Design System

This file is the single source of truth for visual design. Claude Code must follow it exactly. Do not invent colours, fonts, spacing, or components not listed here.

Reference HTML files for visual context:
- `tickets/fixtures/tino-landing-reference.html` — landing page (exact target)
- `tickets/fixtures/tino-app-screens-reference.html` — all app screens
- `tickets/fixtures/tino-v3-reference.html` — component variants

---

## Colours

### Core palette
```css
--teal:       #1BAAC1;   /* primary action, highlights, active states */
--teal-dim:   #0a2828;   /* text ON teal backgrounds (buttons, badges) */
--teal-12:    rgba(27,170,193,0.12);
--teal-20:    rgba(27,170,193,0.20);
--teal-30:    rgba(27,170,193,0.30);
```

### Dark mode (default)
```css
--bg:         #021e1e;   /* page background */
--bg-mid:     #032a2a;   /* slightly lighter sections */
--bg2:        #032828;
--bg3:        #033333;
--sidebar:    #011818;
--glass:      rgba(3,40,40,0.80);
--gborder:    rgba(255,255,255,0.10);

/* White opacity scale */
--w100: #ffffff;
--w90:  rgba(255,255,255,0.90);  /* primary text */
--w80:  rgba(255,255,255,0.80);
--w70:  rgba(255,255,255,0.70);
--w60:  rgba(255,255,255,0.60);  /* secondary text */
--w55:  rgba(255,255,255,0.55);
--w45:  rgba(255,255,255,0.45);
--w40:  rgba(255,255,255,0.40);  /* tertiary/muted */
--w35:  rgba(255,255,255,0.35);
--w20:  rgba(255,255,255,0.20);
--w10:  rgba(255,255,255,0.10);
--w06:  rgba(255,255,255,0.06);

/* Borders */
--brd:  rgba(255,255,255,0.09);
--brd2: rgba(255,255,255,0.14);
```

### Light mode overrides
```css
--bg:      #f7f8fa;
--bg2:     #ffffff;
--bg3:     #f0f1f4;
--sidebar: #ffffff;
--brd:     #e4e6ea;
--brd2:    #d0d3d9;
--w90:     #0f1117;
--w70:     #3a3d45;
--w55:     #5c6070;
--w45:     #7a7f8e;
--w35:     #9ea3b0;
/* Semantic colours — darker for white backgrounds */
--green:   #16a34a;
--amber:   #b45309;
--red:     #dc2626;
--teal:    #0891b2;
```

### Semantic colours (dark mode)
```css
--green:  #4ade80;   /* high score, positive outcome */
--amber:  #fbbf24;   /* medium score, warning, upcoming deadlines */
--red:    #ff6b6b;   /* low score, negative outcome, error */
```

---

## Typography

### Fonts
```css
--font: 'Plus Jakarta Sans', sans-serif;   /* all UI text */
--mono: 'DM Mono', monospace;              /* numbers, labels, badges, code */
```

Google Fonts import:
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
```

### Type scale
| Use | Size | Weight | Notes |
|-----|------|--------|-------|
| Hero heading | `clamp(3.4rem, 7vw, 7rem)` | 700 | Letter-spacing: -0.03em |
| Section heading | `clamp(2rem, 3.5vw, 3.4rem)` | 700 | Letter-spacing: -0.025em |
| Card title | 14–15px | 700 | Letter-spacing: -0.2px |
| Body | 13–15px | 400 | Line-height: 1.75 |
| Label / eyebrow | 10–11px | 300–500 | `font-family: var(--mono)`, uppercase, letter-spacing: 1.5–2px |
| Small / meta | 10–12px | 400–500 | |
| Stat number | 14–16px | 700–800 | `font-family: var(--mono)`, letter-spacing: -0.5px to -0.8px |

---

## Spacing & Layout

- Max content width: `1300px`
- Page horizontal padding: `60px` (desktop), `24px` (mobile)
- Nav height: `52px`
- Footer height: `72px`
- Card padding: `16px 18px` (standard), `10px 12px` (compact)
- Card gap: `8px`
- Section gap: `80px` (desktop split layout), `48px` (1100px breakpoint)

---

## Border Radius

| Element | Radius |
|---------|--------|
| Primary buttons | `0` (sharp — this is intentional, not a bug) |
| Cards / frames | `8–14px` |
| Badges / pills | `3–4px` |
| Score badges | `3px` |
| Stage pills | `20px` (rounded) |
| Avatar | `50%` |
| Company logo | `5–8px` |
| Input fields | `5px` |

**Note:** Primary CTAs and action buttons use `border-radius: 0` (sharp corners). This is a deliberate design choice — do not add border-radius to primary buttons.

---

## Components

### Primary button (CTA)
```css
background: var(--teal);
color: var(--teal-dim);      /* #0a2828 */
font-weight: 700;
border: none;
border-radius: 0;            /* sharp — intentional */
padding: 16px 36px;          /* large CTA */
padding: 7px 16px;           /* nav CTA */
```
Hover: `background: #21c8e2`

### Ghost button
```css
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.09);
color: rgba(255,255,255,0.50);
border-radius: 0;
```

### Teal outline button (Generate CV)
```css
background: rgba(27,170,193,0.10);
border: 1px solid rgba(27,170,193,0.28);
color: var(--teal);
font-size: 10–11px;
font-weight: 700;
border-radius: 3px;
```

### Glass card
```css
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.11–0.12);
border-radius: 8–14px;
backdrop-filter: blur(20px) saturate(1.4);
box-shadow:
  0 40px 80px rgba(0,0,0,0.50),
  0 0 0 1px rgba(27,170,193,0.08),
  inset 0 1px 0 rgba(255,255,255,0.10),
  inset 0 -1px 0 rgba(0,0,0,0.15);
```

### Compact glass card (`.gc`)
```css
background: rgba(255,255,255,0.055);
border: 1px solid rgba(255,255,255,0.11);
border-radius: 8px;
padding: 10px 12px;
backdrop-filter: blur(4px);
```

### Score badge — High
```css
background: rgba(74,222,128,0.12);
color: #4ade80;
font-size: 10px;
font-weight: 700;
padding: 2px 7px;
border-radius: 3px;
```

### Score badge — Medium
```css
background: rgba(251,191,36,0.12);
color: #fbbf24;
```

### Score badge — Low
```css
background: rgba(255,107,107,0.12);
color: #ff6b6b;
```

### Filter pill
```css
display: inline-flex;
padding: 3px 9px;
border-radius: 100px;
font-size: 10px;
font-weight: 500;
border: 1px solid rgba(255,255,255,0.14);
color: rgba(255,255,255,0.55);
/* Active */
background: rgba(27,170,193,0.10);
border-color: rgba(27,170,193,0.30);
color: var(--teal);
```

### Nav eyebrow / BETA badge
```css
font-family: var(--mono);
font-size: 9px;
letter-spacing: 1.5px;
text-transform: uppercase;
color: var(--teal);
border: 1px solid rgba(27,170,193,0.30);
padding: 3px 8px;
border-radius: 3px;
```

### Stage pill colours
```css
/* Saved */     background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.45);
/* Applied */   background: rgba(27,170,193,0.12);  color: #1BAAC1;
/* Acknowledged */ background: rgba(251,191,36,0.10); color: #fbbf24;
/* Interview */ background: rgba(139,92,246,0.12);  color: #a78bfa;
/* Offer */     background: rgba(74,222,128,0.12);   color: #4ade80;
/* Closed */    background: rgba(255,255,255,0.04);  color: rgba(255,255,255,0.30);
```

### Stat chip (landing page)
```css
display: inline-flex;
align-items: center;
gap: 8px;
font-size: 12px;
font-weight: 500;
color: rgba(255,255,255,0.60);
background: rgba(27,170,193,0.07);
border: 1px solid rgba(27,170,193,0.18);
padding: 7px 14px;
border-radius: 4px;
/* Strong numbers inside */
strong { color: var(--teal); font-weight: 700; }
```

### Progress bar (1-line metric)
```css
height: 2px;
background: rgba(255,255,255,0.07);
border-radius: 1px;
/* Fill */
background: var(--teal);
```

---

## App Frame (in-app mockup chrome)

App screens use a consistent chrome:
- **Title bar:** `height: 38px`, `background: rgba(2,22,22,0.70)`, `border-bottom: 1px solid rgba(255,255,255,0.09)`
- **Sidebar:** `width: 40px`, `background: rgba(2,14,14,0.65)`, `border-right: 1px solid rgba(255,255,255,0.08)`
- **Active sidebar icon:** `background: rgba(27,170,193,0.12)`, `color: var(--teal)`

---

## Logo (SVG — inline)

```svg
<svg width="54" height="22" viewBox="0 0 56 26" fill="none">
  <line x1="2" y1="3" x2="13" y2="3" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round"/>
  <line x1="7.5" y1="3" x2="7.5" y2="23" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round"/>
  <rect x="16" y="2" width="6" height="6" rx="1.8" fill="#1BAAC1"/>
  <line x1="19" y1="10" x2="19" y2="23" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round"/>
  <line x1="24" y1="10" x2="24" y2="23" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round"/>
  <path d="M24 13 Q24 10 27.5 10 Q31 10 31 13 L31 23" stroke="rgba(255,255,255,0.85)" stroke-width="2" stroke-linecap="round" fill="none"/>
  <rect x="34" y="10" width="11" height="13" rx="4.5" stroke="rgba(255,255,255,0.85)" stroke-width="2" fill="none"/>
</svg>
```

In light mode: replace `rgba(255,255,255,0.85)` with `rgba(15,17,23,0.80)`. The teal rect fill stays `#1BAAC1`.

---

## Nav

```css
position: fixed; top: 0; height: 52px;
background: rgba(2,20,20,0.55);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(255,255,255,0.07);
padding: 0 28px;
```

---

## Tone of voice

- Direct, not chirpy
- No emoji in product copy
- No "Welcome to your dashboard 🎉" or similar
- No exclamation marks in UI labels
- Numbers and stats use `DM Mono`
- Eyebrows/labels in ALL CAPS with letter-spacing
- Underline emphasis with `text-decoration-thickness: 1.5–2px; text-underline-offset: 5–8px`

---

## Breakpoints

```css
@media (max-width: 1100px) { /* reduce gaps */ }
@media (max-width: 860px)  { /* single column, hide split screen */ }
@media (max-width: 600px)  { /* hide footer links, hide nav links */ }
```

---

## Animations

- Default transition: `0.15s` ease for colour/background changes
- Hover lift: not used — hover is colour-only
- Scroll progress bar: fixed bottom, `height: 2px`, teal fill
- Theme toggle knob: `translateX(0px)` dark → `translateX(18px)` light
- Reduced motion: `@media (prefers-reduced-motion: reduce)` — disable all animations, set opacity/transform to final state

---

## What NOT to do

- Do not use `border-radius` on primary action buttons — they are sharp by design
- Do not use blue (`#3b82f6` etc.) — the primary colour is teal `#1BAAC1`
- Do not use System UI or Inter — fonts are Plus Jakarta Sans + DM Mono
- Do not add shadows to flat elements — shadows are reserved for glass cards
- Do not use emoji in UI labels, headings, or button text
- Do not lighten the dark background — `#021e1e` is the correct base, not `#1a1a2e` or similar
