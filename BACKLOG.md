# SponsorTrack — task backlog

80 tickets sized for a focused 2–4 hour Claude Code session each, ordered roughly by dependency. Each ticket has the same shape — paste them straight into Linear / GitHub Issues / Notion.

**Conventions:**
- `[P0]` = must-have for MVP launch · `[P1]` = should-have for launch or first month · `[P2]` = post-launch
- Dependencies are listed by ticket number — don't start a ticket until its deps are done.
- "DOD" = Definition of Done. If any line fails, the ticket is not done.

---

## Phase 0 — Foundation (week 1)

### 001 — Repo + tooling [P0]
**Goal:** Standing repo with Next.js, Convex, TypeScript, ESLint, Prettier, vitest, all wired and green.
**Files:** `package.json`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc`, `vitest.config.ts`, `next.config.mjs`, `convex.json`
**Deps:** none
**DOD:**
- `pnpm install` succeeds clean
- `pnpm dev` runs both `next dev` and `convex dev`
- `pnpm typecheck` and `pnpm lint` exit 0 on empty repo
- `pnpm test` runs (no tests yet, but no crash)
- `.gitignore` excludes `.env.local`, `node_modules`, `.next`, `convex/_generated`

### 002 — Domains, accounts, env scaffolding [P0]
**Goal:** All third-party accounts created, domains registered, env vars set up for dev.
**Tasks:**
- Register `sponsortrack.co.uk` and `sponsortrack.app`
- Create accounts: Convex, Vercel, Stripe (test mode), Resend, Anthropic, RapidAPI, Sentry
- Set up Cloudflare or Google Workspace for email
- Populate `.env.example` (already done) with every key needed; users runs `npx convex env set` for backend keys
**Deps:** 001
**DOD:**
- All listed accounts created
- All env vars set in dev Convex deployment
- `.env.local` exists locally with frontend keys
- A printed list of all subscriptions and renewal dates

### 003 — Schema commit [P0]
**Goal:** `convex/schema.ts` deployed to dev Convex, all indexes created.
**Files:** `convex/schema.ts` (already drafted)
**Deps:** 001, 002
**DOD:**
- `npx convex dev --once` succeeds with no schema errors
- All 9 tables visible in Convex dashboard
- Indexes match the schema file

### 004 — CLAUDE.md committed and reviewed [P0]
**Goal:** Conventions doc in place; entire team (you + Claude Code) reads it.
**Files:** `CLAUDE.md`
**Deps:** 001
**DOD:** File committed to repo root.

### 005 — `convex/lib/` pure helpers + tests [P0]
**Goal:** Sponsor-matching helpers committed with green tests. (This is the vertical-slice prep.)
**Files:** `convex/lib/normaliseName.ts`, `matchCompanyToSponsor.ts`, `parseSponsorRow.ts`, `parseSponsorCsv.ts`; matching tests in `tests/lib/`
**Deps:** 001
**DOD:**
- `pnpm test` shows 51 passing tests
- `pnpm typecheck` clean

---

## Phase 1 — Sponsor data layer (week 2)

### 006 — Sponsor refresh action [P0]
**Goal:** Working `refreshSponsorRegister` action + internal mutations.
**Files:** `convex/sponsors/refresh.ts`, `convex/crons.ts`
**Deps:** 003, 005
**DOD:**
- `npx convex run sponsors/refresh:refreshSponsorRegister '{}'` succeeds in dev
- Sponsors table populated with ~130k rows (verify via Convex dashboard)
- A `sponsorSnapshots` row recorded with status="ok"
- Cron registered and visible in dashboard

### 007 — Trading-name lookup table seed [P1]
**Goal:** Hand-curated map of common trading names (M&S, Amazon, etc.) → legal names. Seed with 50–100 entries; expose as a Convex query.
**Files:** `convex/sponsors/tradingNames.ts`, `convex/sponsors/seedTradingNames.ts`
**Deps:** 006
**DOD:**
- `tradingNames` table with 50+ seeded entries
- Internal query `getTradingNameMap` returns a Map ready for `matchCompanyToSponsor`
- A unit test in `tests/lib/` that confirms 5 well-known trading names resolve correctly

### 008 — Companies House enrichment (decision) [P2]
**Goal:** Decide and document — do we use Companies House Direct (~£0.01/lookup) for trading-name resolution, or stay manual?
**Files:** `docs/decisions/008-companies-house.md`
**Deps:** 007
**DOD:** Architecture decision record (ADR) committed; if "yes," create follow-up ticket with implementation; if "no," document the alternative manual workflow.

### 009 — Snapshot diff stats [P1]
**Goal:** `sponsorSnapshots.addedSinceLast` and `removedSinceLast` populated correctly by comparing against the previous snapshot.
**Files:** `convex/sponsors/refresh.ts`
**Deps:** 006
**DOD:**
- After two refreshes, the second snapshot's diff fields are non-zero and match a manual diff
- Test added to confirm the diff calculation

### 010 — Sponsor refresh observability [P1]
**Goal:** Slack or email alert when a refresh fails, or when active-sponsor count drops by >20% week-over-week.
**Files:** `convex/sponsors/refresh.ts`, `convex/lib/alerts.ts`
**Deps:** 006, 009
**DOD:**
- Resend email sent to admin address on failed refresh
- Same on >20% drop, with the actual delta numbers
- Test that simulates a 25% drop and confirms alert fires

### 011 — Sponsor name-matching benchmark [P0]
**Goal:** Labelled fixture set + benchmark that measures precision/recall of `matchCompanyToSponsor`.
**Files:** `tests/lib/fixtures/sponsor-matching.json`, `tests/lib/matchCompanyToSponsor.bench.ts`
**Deps:** 005
**DOD:**
- 100 known sponsors + 100 non-sponsors labelled
- Bench script reports precision and recall
- Current precision ≥95%; if not, fix before ticket-013

---

## Phase 2 — Auth + onboarding (week 3)

### 012 — Convex Auth setup (email magic link) [P0]
**Goal:** Working email magic-link auth via Convex Auth, integrated with Resend.
**Files:** `convex/auth.config.ts`, `convex/auth.ts`, frontend `app/(marketing)/login/page.tsx`
**Deps:** 003
**DOD:**
- User enters email → receives magic link → clicks → logged in
- A `users` row created on first login with plan="free", payPerCvCredits=0
- Logout works

### 013 — Google OAuth [P0]
**Goal:** Add Google as second auth provider.
**Deps:** 012
**DOD:** Sign in with Google works end to end; first-time Google users get a `users` row.

### 014 — Onboarding profile form [P0]
**Goal:** After first login, user fills visa status, location, salary range, right-to-work toggle.
**Files:** `app/(app)/onboarding/page.tsx`, `convex/users.ts` (mutation `updateProfile`)
**Deps:** 012
**DOD:**
- Form posts to a Convex mutation
- Required fields enforced client-side and server-side
- Returning user with profile filled is redirected past onboarding

### 015 — CV upload [P0]
**Goal:** PDF/DOCX upload to Convex file storage, max 10MB, single file per user.
**Files:** `app/(app)/onboarding/cv/page.tsx`, `convex/profiles.ts`
**Deps:** 014
**DOD:**
- File uploads to `_storage`, `cvFileId` set on profile
- Replacing existing CV deletes the old file
- Reject files >10MB or non-PDF/DOCX

### 016 — CV parsing action [P0]
**Goal:** Action `parseCv` calls Claude (Haiku) to extract structured profile from the uploaded CV.
**Files:** `convex/profiles/parseCv.ts`
**Deps:** 015
**DOD:**
- Action runs on CV upload, populates `currentRoleTitle`, `yearsExperience`, `skills`, `qualifications`, `industrySector`, `languages`
- Failures don't crash — they leave fields empty and record an event
- Test with 3 sample CVs (one PDF, one DOCX, one short)

### 017 — Role variations generation [P0]
**Goal:** After CV parse, action `generateRoleVariations` calls Claude to produce exact + adjacent role title arrays.
**Files:** `convex/profiles/generateRoleVariations.ts`
**Deps:** 016
**DOD:**
- 6–10 titles produced, stored on profile
- User can edit the lists in the UI (next ticket)

### 018 — Role variations editor UI [P0]
**Goal:** UI for the user to add / remove / reorder role titles.
**Files:** `app/(app)/onboarding/roles/page.tsx`
**Deps:** 017
**DOD:**
- Add, remove, drag-to-reorder all work
- Saves on every edit (debounced)

---

## Phase 3 — Job ingestion (week 3-4)

### 019 — RapidAPI LinkedIn fetcher (probe) [P0]
**Goal:** A throwaway action that pulls 10 jobs from RapidAPI LinkedIn endpoint and prints the raw response shape — confirms field names before writing real ingestion.
**Files:** `convex/jobs/probeLinkedIn.ts`
**Deps:** 002
**DOD:** Output pasted into a comment on this ticket so the field shape is permanently captured. Action removed before merge.

### 020 — Job ingestion: LinkedIn [P0]
**Goal:** Action that pulls jobs from LinkedIn (last 7 days), normalises to our `jobs` schema, dedupes via dedupeHash, inserts.
**Files:** `convex/jobs/ingestLinkedIn.ts`, `convex/lib/dedupeHash.ts`
**Deps:** 003, 019
**DOD:**
- Running the action ingests >100 jobs in dev
- All jobs have a `dedupeHash`, `companyNormalised`, `sourceIds[]`
- Re-running doesn't create duplicates — `sourceIds` array grows instead

### 021 — Job ingestion: Indeed via Realtime API [P0]
**Goal:** Same as 020 but for Indeed.
**Files:** `convex/jobs/ingestIndeed.ts`
**Deps:** 020
**DOD:** Indeed jobs ingested; cross-source dedup confirmed (a job present in both sources becomes one row with two `sourceIds`).

### 022 — Job ingestion: Glassdoor [P1]
**Goal:** Same as 021 but Glassdoor.
**Files:** `convex/jobs/ingestGlassdoor.ts`
**Deps:** 021
**DOD:** Glassdoor jobs ingested.

### 023 — Adzuna failover [P1]
**Goal:** Adzuna ingestion as failover when RapidAPI sources fail.
**Files:** `convex/jobs/ingestAdzuna.ts`
**Deps:** 020
**DOD:** Action runs when LinkedIn ingestion fails 2 times in 1h.

### 024 — Daily ingestion cron [P0]
**Goal:** Wire up the 04:00 UTC daily full ingest covering top 100 role+location combos.
**Files:** `convex/crons.ts`, `convex/jobs/dailyIngest.ts`
**Deps:** 020, 021
**DOD:**
- Cron registered
- Action seeds the top combos from saved searches and runs each
- Telemetry: count ingested per source per run

### 025 — Hourly user-search ingestion (Pro only) [P1]
**Goal:** For each Pro user with active saved searches, hourly fetch of new jobs.
**Files:** `convex/crons.ts`, `convex/jobs/userSearchIngest.ts`
**Deps:** 024, 049
**DOD:** Pro user with a saved search sees new jobs surface within an hour of being posted.

### 026 — Job pruning (60-day rule) [P1]
**Goal:** Daily job that strips full JD from jobs older than 60 days, keeping only title + company + apply URL.
**Files:** `convex/crons.ts`, `convex/jobs/prune.ts`
**Deps:** 024
**DOD:** A job older than 60 days has its `description` truncated to 200 chars and `isActive` flipped to false.

---

## Phase 4 — Scoring (week 4)

### 027 — Score signals helper [P0]
**Goal:** Pure module that computes the score breakdown for a job given its data + matched sponsor.
**Files:** `convex/lib/scoreSignals.ts`, `tests/lib/scoreSignals.test.ts`
**Deps:** 005
**DOD:**
- All 10 signals from PRD §6.1 implemented
- Tests covering each signal individually and a few combined cases
- Constants (salary threshold, weights) documented inline

### 028 — Scoring on ingest [P0]
**Goal:** Every job inserted from RapidAPI is scored and gets `sponsorshipScore`, `sponsorshipBand`, `scoreBreakdown`, `sponsorId`.
**Files:** `convex/jobs/score.ts`, hooks into 020/021/022
**Deps:** 020, 027
**DOD:** New jobs always have a non-null score and band. No nulls in the dashboard.

### 029 — Re-score on register refresh [P0]
**Goal:** After sponsor register refresh, re-score all jobs from the last 14 days.
**Files:** `convex/sponsors/refresh.ts`, `convex/jobs/rescore.ts`
**Deps:** 006, 028
**DOD:** A sponsor that becomes inactive between snapshots flips its open jobs to lower bands.

### 030 — Negative-signal Claude pass [P1]
**Goal:** For jobs whose regex check is uncertain about "no sponsorship" phrasing, pass JD body to Claude (Haiku) for a confidence call.
**Files:** `convex/jobs/detectNegativeSignal.ts`
**Deps:** 028
**DOD:**
- Only ambiguous JDs (e.g. "right to work in the UK is essential" without explicit "no sponsorship") are sent
- Cost capped at 100 calls/day
- Test confirms a known negative is caught

---

## Phase 5 — Job feed UI (week 5)

### 031 — Authenticated app shell [P0]
**Goal:** Layout for the authenticated app: nav, profile dropdown, "Sign out".
**Files:** `app/(app)/layout.tsx`, `components/AppNav.tsx`
**Deps:** 012
**DOD:** Logged-in user sees the shell on every `/app/*` route.

### 032 — Job feed page (basic) [P0]
**Goal:** List view of jobs filtered to user's role variations, ranked by score then posted date.
**Files:** `app/(app)/jobs/page.tsx`, `convex/jobs/queries.ts` (query `listForUser`)
**Deps:** 028, 031
**DOD:**
- Page renders 20 jobs, paginated
- Each row: title, company, location, posted date, score band (Pro) or band only (free)
- "Apply" button deep-links to source

### 033 — Job feed filters [P0]
**Goal:** Filter by location, salary range, posted-within (24h, 7d, 30d), source, score band.
**Files:** `app/(app)/jobs/page.tsx`
**Deps:** 032
**DOD:** All filters work in URL state (deep-linkable).

### 034 — Job detail view [P0]
**Goal:** Full JD, score breakdown, employer info card, apply button.
**Files:** `app/(app)/jobs/[id]/page.tsx`
**Deps:** 032
**DOD:**
- Free users see band only on detail; Pro users see numeric score + breakdown
- Score breakdown lists matched signals with weights
- "Save" button works

### 035 — Save / unsave [P0]
**Goal:** Toggle a job into the user's tracker at stage "saved".
**Files:** `convex/applications.ts`, UI in 034
**Deps:** 003, 034
**DOD:**
- Free user blocked at 3 saves with upsell
- Pro user unlimited
- Saved state persists and reflects on feed

### 036 — Score band visual treatment [P0]
**Goal:** Polished visual for score bands — colour-coded pill, hover tooltip, accessible.
**Files:** `components/ScoreBand.tsx`
**Deps:** 032
**DOD:** Component used in feed and detail; passes a11y check.

---

## Phase 6 — CV / cover letter generation (week 6)

### 037 — Generate-application action [P0]
**Goal:** Action that takes (userId, jobId), runs Claude tailoring prompt, returns structured JSON.
**Files:** `convex/applications/generate.ts`
**Deps:** 016, 028
**DOD:**
- Returns the tailored CV JSON matching the schema in PRD §10.3
- Hallucination check: any new employer/date/qualification not in source profile causes a regeneration with sharper prompt
- Test with 3 fixture pairs

### 038 — DOCX builder [P0]
**Goal:** Build a Word doc from the tailored CV JSON.
**Files:** `convex/applications/buildCvDocx.ts`
**Deps:** 037
**DOD:**
- DOCX uploaded to Convex file storage, returns storage ID
- Test confirms the file opens cleanly in Word and contains expected sections

### 039 — Cover letter generation [P0]
**Goal:** Same flow but for cover letter, 200–280 words.
**Files:** `convex/applications/generateCoverLetter.ts`
**Deps:** 037
**DOD:** Cover letter DOCX produced and saved.

### 040 — Generation rate-limit + caching [P0]
**Goal:** Free=1/month, Pro=50/day soft cap. Same (user, job) within 24h returns cached result.
**Files:** `convex/applications/generate.ts`
**Deps:** 037
**DOD:**
- Rate limits enforced server-side
- Cache hit logged, no Claude call made on second click within 24h

### 041 — Generation UI [P0]
**Goal:** "Generate tailored CV" button with progress (streaming) and download.
**Files:** UI in `app/(app)/jobs/[id]/page.tsx` and `app/(app)/applications/[id]/page.tsx`
**Deps:** 037, 038, 039
**DOD:** Click → spinner → preview → download buttons for both files.

---

## Phase 7 — Tracker (week 7)

### 042 — Application stage transitions [P0]
**Goal:** Mutation `advanceApplicationStage` enforces valid transitions between the 8 stages and appends to `stageHistory`.
**Files:** `convex/applications.ts`
**Deps:** 003
**DOD:**
- All 8 stages reachable through valid transitions
- Invalid transition (e.g. saved → offer_received) throws ConvexError
- Tests for each valid transition

### 043 — Tracker page [P0]
**Goal:** Kanban-style tracker showing applications by stage.
**Files:** `app/(app)/tracker/page.tsx`
**Deps:** 042
**DOD:** Drag-or-click to advance stage; works.

### 044 — Stage detail forms [P0]
**Goal:** Per-stage forms for capturing the data each stage requires (interview date, format, outcome notes, salary, etc.).
**Files:** `app/(app)/tracker/[id]/*`
**Deps:** 043
**DOD:** Each stage has a form; required fields enforced.

### 045 — Tracker dashboard [P1]
**Goal:** Summary view: total apps, response rate, avg time-to-interview, top-converting role types.
**Files:** `app/(app)/dashboard/page.tsx`, `convex/applications.ts` (query `summaryForUser`)
**Deps:** 043
**DOD:** Numbers match a hand-computed sample for a test user.

### 046 — Outcome capture flow [P0]
**Goal:** When user closes an application, prompt for outcome + sponsorship-confirmed bool + salary offered.
**Files:** UI in 044
**Deps:** 042
**DOD:** Captured fields populate `applications.outcome`, `sponsorshipConfirmed`, `salaryOffered`.

### 047 — Outcome → events log [P1]
**Goal:** Every outcome is also written as an `events` row for analytics.
**Files:** `convex/applications.ts`
**Deps:** 046
**DOD:** Events table has a row per outcome; analytics query (next ticket) can roll them up.

### 048 — Score recalibration job [P1]
**Goal:** Weekly job that computes per-employer adjustment from outcome data, applies to scoring (PRD §6.4).
**Files:** `convex/jobs/recalibrateScores.ts`, `convex/crons.ts`
**Deps:** 029, 047
**DOD:** Employer with low sponsorship-confirmed rate has score adjusted; reflected in next re-score pass.

---

## Phase 8 — Saved searches + alerts (week 7)

### 049 — Saved-search CRUD [P1]
**Goal:** Create / list / edit / delete saved searches.
**Files:** `app/(app)/searches/*`, `convex/searches.ts`
**Deps:** 003
**DOD:** All four operations work; saved search affects the feed.

### 050 — Daily digest builder [P1]
**Goal:** For each Pro user, build the top 5 new High-band jobs since their last digest.
**Files:** `convex/email/digest.ts`
**Deps:** 028, 049
**DOD:** Internal action returns a list ready for email rendering.

### 051 — Daily digest email send [P1]
**Goal:** Daily 07:00 UTC cron sends digest via Resend.
**Files:** `convex/crons.ts`, `convex/email/digest.ts`, React Email template
**Deps:** 050
**DOD:**
- Email arrives in test inbox
- One-click unsubscribe link works
- A user with 0 new High-band jobs gets no email

### 052 — Score-change alert [P1]
**Goal:** Email when a saved-job employer drops off the register or downgrades.
**Files:** `convex/sponsors/refresh.ts`, `convex/email/alerts.ts`
**Deps:** 029, 035
**DOD:** Test that simulates a sponsor being deactivated triggers the email to all users with a saved app for that employer.

---

## Phase 9 — Stripe + monetisation (week 8)

### 053 — Stripe products + webhooks setup [P0]
**Goal:** Three Stripe products created (Pro Monthly, Pro Annual, Pay-per-CV); webhook endpoint registered on Convex.
**Files:** `convex/stripe/checkout.ts`, `convex/http.ts`
**Deps:** 002
**DOD:**
- Products visible in Stripe dashboard
- Webhook endpoint URL configured
- A test webhook ping arrives and is logged

### 054 — Checkout action [P0]
**Goal:** Action `createCheckoutSession` returns a Stripe Checkout URL for the requested plan.
**Files:** `convex/stripe/checkout.ts`
**Deps:** 053
**DOD:** User clicks "Upgrade" → Stripe Checkout opens → completes test payment → returns to app.

### 055 — Stripe webhook handler [P0]
**Goal:** HTTP action that receives and validates Stripe webhooks; handles `customer.subscription.*` and `checkout.session.completed`; updates `users.plan` and `users.payPerCvCredits` accordingly.
**Files:** `convex/http.ts`, `convex/stripe/webhook.ts`
**Deps:** 053, 054
**DOD:**
- Test events (Stripe CLI) update the user's plan correctly
- `webhookEvents` table prevents duplicate processing on retries
- Signature verification rejects unsigned requests

### 056 — Plan gating [P0]
**Goal:** Server-side enforcement of free vs Pro feature limits across CV gen, save count, score visibility, daily digest.
**Files:** `convex/lib/planGates.ts`, hooks into all relevant mutations/queries
**Deps:** 055
**DOD:** Free user hitting any Pro-only feature gets a structured error; UI shows upgrade CTA.

### 057 — Stripe customer portal [P1]
**Goal:** Redirect to Stripe-hosted portal for plan changes/cancellation.
**Files:** `convex/stripe/portal.ts`
**Deps:** 054
**DOD:** "Manage subscription" button works.

### 058 — Pricing page [P0]
**Goal:** Public pricing page with three tiers + pay-per-CV.
**Files:** `app/(marketing)/pricing/page.tsx`
**Deps:** 058 (visual design)
**DOD:** Page live at /pricing, all CTAs go to checkout for the right plan.

### 059 — Pay-per-CV credit accounting [P0]
**Goal:** Credits decrement atomically on use, replenish on Stripe refund webhook.
**Files:** `convex/applications/generate.ts`, `convex/stripe/webhook.ts`
**Deps:** 040, 055
**DOD:**
- Credit decrement is in the same mutation that creates the application — no race
- Refund test (via Stripe CLI) replenishes the credit

---

## Phase 10 — Polish + lifecycle (week 9)

### 060 — Marketing landing page [P0]
**Goal:** Public landing page with hero, "how it works", testimonials placeholder, pricing CTA, sign-up.
**Files:** `app/(marketing)/page.tsx`
**Deps:** 058
**DOD:** Lighthouse score ≥90 on mobile, all sections render, sign-up CTA works.

### 061 — Welcome email + day-2 nudge [P1]
**Goal:** Day 0 welcome (immediately after verification) and Day 2 nudge ("upload your CV") via Resend.
**Files:** `convex/email/lifecycle.ts`, React Email templates, scheduled functions
**Deps:** 012, 015
**DOD:** New test user receives both at the right times.

### 062 — Day 7 + Day 14 lifecycle emails [P1]
**Goal:** "Jobs you might've missed" (free, no return) and "see all matches" (Pro upgrade prompt).
**Files:** `convex/email/lifecycle.ts`
**Deps:** 061
**DOD:** Sent to the right cohorts; opt-out works.

### 063 — Account settings + GDPR export/delete [P0]
**Goal:** User can export all their data as JSON and delete their account.
**Files:** `app/(app)/settings/page.tsx`, `convex/users.ts`
**Deps:** 003
**DOD:**
- Export downloads a JSON file with all user-scoped data
- Delete soft-deletes the user (sets `deletedAt`); a follow-up cron purges 30 days later
- Stripe subscription cancelled on delete

### 064 — Privacy policy + ToS pages [P0]
**Goal:** Live privacy and terms pages at `/privacy` and `/terms` with the correct sub-processor list.
**Files:** `app/(marketing)/privacy/page.tsx`, `app/(marketing)/terms/page.tsx`
**Deps:** none
**DOD:** Pages live; reviewed once by a human (not a lawyer, but a human read).

### 065 — ICO registration [P0]
**Goal:** Register as a data controller with the ICO.
**Deps:** 064
**DOD:** Registration confirmed by email. Cost: ~£40/year. (Process happens off-platform.)

### 066 — Sentry frontend setup [P1]
**Goal:** Sentry capturing all unhandled frontend errors.
**Files:** `sentry.client.config.ts`, `sentry.server.config.ts`
**Deps:** 002
**DOD:** Throwing an error in dev shows up in Sentry within 10s.

### 067 — Empty states + loading skeletons [P1]
**Goal:** Every list, detail, and dashboard view has a polished empty state and loading skeleton.
**Files:** all `app/(app)/*` pages
**Deps:** 032, 043, 045
**DOD:** Audit pass — no plain "Loading..." or blank pages.

### 068 — Mobile responsive pass [P0]
**Goal:** Every page works at 375px width.
**Files:** Tailwind audit across all pages
**Deps:** all UI tickets
**DOD:** Manual sweep on iPhone-size viewport; nav usable, no horizontal scroll, forms readable.

---

## Phase 11 — Beta launch (weeks 9–10)

### 069 — Waitlist mailout [P0]
**Goal:** Send invite emails to the 200 waitlist signups in batches of 50.
**Files:** `convex/email/waitlistInvite.ts` (one-shot script)
**Deps:** 060
**DOD:** Inv ites sent; sign-ups tracked via UTM.

### 070 — Beta feedback widget [P1]
**Goal:** "Send feedback" button in app, posts to a Convex mutation that emails support.
**Files:** `components/FeedbackWidget.tsx`, `convex/feedback.ts`
**Deps:** 031
**DOD:** Submission arrives in support inbox with user context attached.

### 071 — Activation funnel analytics [P1]
**Goal:** Dashboard showing the 5 funnel steps (signup → onboarding → CV upload → first feed view → first application) with drop-offs.
**Files:** `app/(admin)/funnel/page.tsx`, `convex/admin/funnel.ts`
**Deps:** 047
**DOD:** Page restricted to admin emails; numbers cross-check against manual SQL-ish queries.

### 072 — Top-5 friction fixes [P0]
**Goal:** Address the 5 most-reported friction points from beta. Specifics depend on data — open ticket numbers 072a–072e at the time.
**Deps:** 069, 070, 071
**DOD:** All 5 fixed and re-tested by a beta user.

---

## Phase 12 — Public launch (week 11)

### 073 — Public launch announcement [P0]
**Goal:** Posts on LinkedIn, r/IWantOut, r/UKVisa, Twitter, The Student Room.
**Deps:** 069, 072
**DOD:** Posted; UTM-tagged; analytics confirm traffic.

### 074 — Support inbox + 24h SLA [P0]
**Goal:** support@sponsortrack.co.uk monitored; auto-acknowledge within 1h, human reply within 24h.
**Deps:** 070
**DOD:** Auto-ack working; first 10 tickets responded within SLA.

### 075 — Status page [P1]
**Goal:** Lightweight status page (Convex, RapidAPI, Stripe, Resend) at /status.
**Files:** `app/(marketing)/status/page.tsx`
**Deps:** 010
**DOD:** Page shows green/red for each dependency.

---

## Phase 13 — Post-launch (months 3–6)

### 076 — Featured employer listings (admin-placed) [P2]
**Goal:** Admin can mark an employer as "featured" — their open roles surface at top of relevant searches with a badge.
**Files:** `convex/admin/featured.ts`, schema addition for `featuredSponsors` table
**Deps:** 028
**DOD:** Featured employer's jobs rank above non-featured at equal score band.

### 077 — SOC code → salary threshold lookup [P2]
**Goal:** Map jobs to SOC codes and apply going-rate salary checks in scoring.
**Files:** `convex/lib/socCodes.ts` (with seed data), `convex/lib/scoreSignals.ts` updates
**Deps:** 028
**DOD:** Jobs below the SOC-specific threshold get the −20 hit.

### 078 — Self-serve employer dashboard [P2]
**Goal:** Verified employers can claim their company page, edit description, post jobs directly.
**Files:** new module `convex/employers/`
**Deps:** 076
**DOD:** Employer signs up → verifies via DNS/email → posts a job → it appears in feed.

### 079 — Talent pool search (employer-side) [P2]
**Goal:** Paying employers search anonymised candidate profiles by visa type and skills.
**Files:** new module
**Deps:** 078
**DOD:** Search returns anonymous cards; "request intro" sends an in-app message.

### 080 — Outcome-based score recalibration v2 [P2]
**Goal:** Move from per-employer to per-(employer, role-type) adjustments once data volume supports it.
**Files:** `convex/jobs/recalibrateScores.ts`
**Deps:** 048
**DOD:** Recalibration produces meaningfully different scores for different role types at the same employer where data supports it.

### 081 — Chrome Extension [P2]
**Goal:** Browser extension that overlays Tino sponsorship scores on LinkedIn, Indeed, Reed, and Totaljobs job listings. Shows score band badge on each job card. Click badge opens a sidebar with full score breakdown, save to Tino button, and generate CV button.
**Files:** New repo `tiino-extension/` — Manifest V3, content scripts per job board, background service worker, sidebar panel.
**Deps:** 060 (app launched), public API endpoint on Convex HTTP router.
**DOD:**
- Extension installs from Chrome Web Store
- Score badges appear on LinkedIn and Indeed job listings
- Clicking badge opens Tino sidebar
- Save and Generate CV work from the sidebar
- Auth syncs with tiino.app session

---

## How to use this list

1. Pick the lowest-numbered ticket whose dependencies are all done.
2. Open it as a Linear / GitHub issue with the body of this section.
3. Hand to Claude Code with: "Work on ticket NNN. Read CLAUDE.md and the PRD before starting. Ask before deviating from the DOD."
4. Don't open ticket N+1 until N's DOD is fully met and merged.

If you skip dependencies, things will break in non-obvious ways. The hardest cases (sponsor matching precision, Stripe webhook idempotency, score recalibration) are deliberately separated from quick UI wins so you can ship the easy stuff fast and slow down for the load-bearing pieces.
