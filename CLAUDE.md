# CLAUDE.md — Tino (SponsorTrack)

You are building Tino: a UK job board that filters every listing against the Home Office sponsor register and layers on a sponsorship likelihood score, AI-tailored CVs, and an application tracker.

Read this file before starting any ticket. Do not deviate from these conventions without asking first.

---

## What this product does

Every job shown on Tino is from an employer holding an active Worker / Skilled Worker sponsor licence on the official Home Office register. No other UK job site does this automatically.

Core loop:
1. User uploads CV → Claude extracts structured profile
2. User sees a filtered, scored job feed (only verified sponsors)
3. User generates a tailored CV + cover letter for a specific job (Claude)
4. User applies via deep-link to employer site
5. User tracks the application through 8 stages
6. Outcome data feeds back into the scoring model

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 App Router, Tailwind CSS |
| Backend | Convex (DB, queries, mutations, actions, cron, file storage) |
| Auth | Convex Auth (email magic links + Google OAuth) |
| Payments | Stripe Checkout + webhooks |
| Email | Resend + React Email templates |
| AI | Anthropic Claude API (claude-sonnet-4-5 for CV tailoring, claude-haiku-4-5 for parsing/scoring) |
| Job feeds | RapidAPI (LinkedIn via Fantastic Jobs, Indeed + Glassdoor via Jobs Search Realtime) |
| Sponsor data | Home Office register CSV (gov.uk), refreshed weekly |
| Observability | Sentry (frontend) + Convex built-in logs |
| Hosting | Vercel (frontend), Convex cloud (backend) |

**Never add a new npm package without asking first.** New packages should be a separate message: "I want to add X because Y, OK?"

---

## Repo structure

```
/
├── app/
│   ├── (marketing)/        # Public pages: landing, pricing, login, privacy, terms
│   └── (app)/              # Authenticated app: feed, tracker, onboarding, settings
├── components/             # Shared UI components
├── convex/
│   ├── schema.ts           # Single source of truth for the data model
│   ├── auth.config.ts
│   ├── auth.ts
│   ├── crons.ts
│   ├── http.ts             # HTTP action endpoints (Stripe webhook)
│   ├── lib/                # Pure helpers: normalisation, matching, scoring
│   ├── sponsors/           # Sponsor register fetch + mutations
│   ├── jobs/               # Job ingestion + scoring
│   ├── profiles/           # CV parsing + role generation
│   ├── applications/       # Application tracker mutations
│   ├── email/              # Email actions
│   └── stripe/             # Stripe checkout + webhook handler
├── docs/
│   ├── SponsorTrack_PRD.docx
│   ├── design-tokens.md    # Full design system reference
│   └── decisions/          # ADRs — one file per architectural decision
├── tests/
│   └── lib/                # Unit tests for pure helpers
│       └── fixtures/       # Sample data for tests
└── tickets/
    └── fixtures/           # API response samples, sample CVs, reference HTML
        ├── tino-landing-reference.html     # Exact landing page to replicate
        ├── tino-app-screens-reference.html # All app screens
        ├── tino-v3-reference.html          # Component variants
        ├── cvs/                            # Sample CVs for testing
        ├── linkedin-sample.json            # Real API response shape
        ├── indeed-sample.json
        └── glassdoor-sample.json
```

---

## Convex conventions

- All backend logic lives in `convex/`. Never call the Anthropic API or RapidAPI from the Next.js frontend or API routes — only from Convex actions.
- Queries are read-only. Mutations write to the DB. Actions call external services.
- Backend env vars are set with `npx convex env set NAME value` — they never go in `.env`.
- Frontend env vars go in `.env.local` (prefixed `NEXT_PUBLIC_`).
- The schema in `convex/schema.ts` is the single source of truth. Do not add fields to documents that aren't in the schema.
- Run `npx convex dev --once` to check schema validity without starting the watcher.

---

## Environment variables

### Frontend (`.env.local`)
```
NEXT_PUBLIC_CONVEX_URL=https://amicable-eagle-954.eu-west-1.convex.cloud
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_SITE_URL=https://tiino.app
```

### Backend (Convex env — set with `npx convex env set`)
```
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM_TRANSACTIONAL=hello@tiino.app
EMAIL_FROM_MARKETING=hello@tiino.app
RAPIDAPI_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
COMPANIES_HOUSE_API_KEY
```

---

## Data model summary

9 tables. Full schema in `convex/schema.ts`.

| Table | Purpose |
|---|---|
| `users` | Auth, plan, Stripe customer ID, credits |
| `profiles` | CV data, parsed skills, role variations |
| `sponsors` | Home Office register (~130k rows), normalised names |
| `jobs` | Ingested jobs with score, dedup hash, source IDs |
| `applications` | Per-user job applications, 8-stage tracker |
| `searches` | Saved search criteria per user |
| `events` | Audit log for analytics |
| `sponsorSnapshots` | Weekly register refresh metadata |
| `tradingNames` | Trading name → legal name lookup |

---

## Sponsorship scoring model

Score is a weighted sum, 0–100. See PRD section 6 for full weights.

Key signals:
- Employer on active A-rated sponsor register: **+40**
- JD explicitly mentions sponsorship: **+20**
- JD says "no sponsorship" / "must have RTW": **−50** (hard signal)
- Salary below £41,700 threshold: **−20**
- B-rated sponsor: **−15**

Score bands:
- 75–100: High (default shown)
- 50–74: Medium (default shown)
- 25–49: Low (shown with warning)
- 0–24: Very low (hidden by default)

Free users see band only. Pro users see numeric score + breakdown.

---

## Pricing

| Tier | Price |
|---|---|
| Free | £0 — 3 saved jobs, 1 CV/month, band only |
| Pro Monthly | £9.99/mo — unlimited, numeric score, daily digest |
| Pro Annual | £79/yr — everything in Pro Monthly |
| Pay-per-CV | £3.99 — single CV generation, credits never expire |

**These prices are locked. Do not change them without an explicit instruction.**

---

## AI usage rules

- CV tailoring + cover letters: `claude-sonnet-4-5`
- CV parsing, role generation, short explanations: `claude-haiku-4-5`
- All Claude calls run from Convex actions, never from the client
- Never pass one user's data to Claude when processing another user
- Cache generated CVs — re-clicking "generate" on the same job within 24h returns cached output
- Per-user daily cap: free = 1/month, Pro = 50/day
- Hard cap: if any single user exceeds 100 Claude calls in 1 hour, block and alert admin

---

## Name-matching algorithm

Steps:
1. Normalise both sides: lowercase, trim, strip T/A trading name, expand legal-form abbreviations (Ltd→limited, plc→plc, LLP→llp), strip leading articles
2. Exact match first (confidence: "exact")
3. Fuzzy match: Levenshtein ≤ 3 on strings ≥ 8 chars, OR token-set ratio ≥ 92 (confidence: "fuzzy")
4. Trading name lookup (hand-curated + auto-extracted from register T/A patterns)

Benchmark target: ≥95% precision on 200-item test set (ticket 011). Do not ship ingestion before this passes.

---

## Design system

**Full token reference:** `docs/design-tokens.md` — read it before writing any UI.
**Reference screens:** `tickets/fixtures/tino-landing-reference.html` — the exact landing page to replicate for ticket 060. Open it in a browser to see the target.
**App screens:** `tickets/fixtures/tino-app-screens-reference.html` — all authenticated screens.

### Quick reference

| Token | Value |
|-------|-------|
| Primary colour | `#1BAAC1` (teal) |
| Text on teal | `#0a2828` |
| Page background | `#021e1e` (dark default) |
| Primary font | Plus Jakarta Sans |
| Mono font | DM Mono (numbers, labels, badges) |
| Default mode | Dark (light mode supported) |

### Non-negotiable design rules
- Primary buttons use `border-radius: 0` — sharp corners, intentional
- Teal is `#1BAAC1` — never substitute blue
- Fonts are Plus Jakarta Sans + DM Mono — never use Inter or System UI
- No emoji in any UI copy, labels, or button text
- No exclamation marks in UI labels
- Numbers and stats always use `font-family: var(--mono)`
- Eyebrow labels: `font-family: var(--mono)`, uppercase, letter-spacing 1.5–2px
- Dark background is `#021e1e` — do not lighten it

### For ticket 060 (landing page)
Replicate `tickets/fixtures/tino-landing-reference.html` exactly. The HTML is the spec. Do not invent a new visual style — match colours, typography, spacing, and components from that file. Any deviation requires explicit approval.

---

## Coding standards

- TypeScript strict mode. No `any` unless absolutely necessary and commented.
- All Convex functions must have explicit argument validators (`v.string()` etc.) — never skip validation.
- Tests live in `tests/lib/` for pure helpers. Use vitest.
- Test file naming: `featureName.test.ts` for unit tests, `featureName.bench.ts` for benchmarks.
- No console.log in production code — use Convex's built-in logging (`ctx.log`) or structured events.
- Errors thrown from actions should be typed: `new ConvexError({ code: "...", message: "..." })`.

---

## Definition of Done (applies to every ticket)

A ticket is done when ALL of the following are true:
1. `pnpm typecheck` exits 0
2. `pnpm lint` exits 0
3. `pnpm test` passes — existing tests still green, new tests added if the ticket touched logic
4. The specific DOD items in the ticket are met
5. No new npm packages added without prior approval

---

## Decisions log

Every architectural decision goes in `docs/decisions/`. File format: `NNN-short-title.md`.

Already made:
- Convex over Supabase
- Weekly sponsor refresh cadence (daily available as admin override)
- Pricing locked: £9.99 / £79 / £3.99
- No recruiter-side product in v1
- gov.uk register as sole sponsor data source (Companies House enrichment is P2, ticket 008)
- Companies House enrichment: YES, pay ~£0.01/lookup
- Community features: scoped to v2 (Phase 14 in backlog)

---

## What to ask before doing

Ask before:
- Adding any npm package
- Changing the schema
- Deviating from the ticket DOD
- Making any architectural decision not covered above
- Writing a migration (there's no migration system — schema changes affect the live DB)
- Deviating from the design system in `docs/design-tokens.md`

Do not ask about:
- Which model to use for which Claude task (defined above)
- Pricing (locked)
- Which env var name to use (defined above)
- Design tokens (defined in `docs/design-tokens.md`)