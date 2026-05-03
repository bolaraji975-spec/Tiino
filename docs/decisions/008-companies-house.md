# 008 — Companies House enrichment for trading-name resolution

**Status:** Accepted  
**Date:** 2026-05-03  
**Deciders:** Bola Raji  

---

## Context

The Home Office sponsor register lists employers by their legal name. Job boards (LinkedIn, Indeed, Glassdoor) list employers by their trading name. These names frequently differ — "M&S" vs "Marks And Spencer PLC", "BT" vs "British Telecommunications PLC", "Deliveroo" vs "Roofoods Limited".

Ticket 007 seeded a hand-curated `tradingNames` table with ~97 entries covering the most prominent UK employers. This covers the long tail of high-traffic job listings but will miss less well-known employers, newly rebranded companies, and any employer whose trading name diverges from their legal name in a way not captured manually.

**Companies House Direct API** provides a `/company/search` endpoint that resolves a company name to its registered legal name and Companies House number at ~£0.01 per lookup. Lookups are billed only on successful matches, and the API is rate-limited to 600 requests/minute.

### Options considered

| Option | Cost | Coverage | Maintenance |
|--------|------|----------|-------------|
| Hand-curated list only (ticket 007) | £0 | ~97 entries; misses long tail | Manual PR per new entry |
| Companies House enrichment on demand | ~£0.01/lookup | Near-complete; matches any registered UK company | Automated; periodic re-check when confidence is low |
| Scrape Companies House website | £0 | Same coverage as API | Fragile; ToS risk |

---

## Decision

**Use Companies House Direct enrichment.**

When `matchCompanyToSponsor` returns `confidence: "none"` or `confidence: "fuzzy"` for a job's company name, queue a one-off Companies House lookup to resolve the legal name. Store the result in `tradingNames` with `source: "companies_house"` so the match is cached for future jobs from the same employer.

Cost estimate at MVP scale (1,000 unique companies/month × £0.01): **~£10/month** — negligible against infrastructure costs and well within budget.

---

## Consequences

- **Follow-up ticket required** (see below) to implement the `enrichCompanyName` action and wire it into the ingestion pipeline.
- The `tradingNames` table already has `source: "companies_house"` as a valid enum value — no schema change needed.
- Lookups are cached permanently in `tradingNames` — cost is incurred once per novel company name, not per job ingestion run.
- Rate limiting: max 600 req/min from Companies House Direct. At MVP ingestion volumes this is not a constraint.
- The `COMPANIES_HOUSE_API_KEY` env var is already defined in CLAUDE.md and must be set via `npx convex env set COMPANIES_HOUSE_API_KEY <key>`.

---

## Alternative manual workflow (if API is unavailable)

If the Companies House API is down or the key is not configured, fall back to:
1. Log company names that failed to match into the `events` table with `type: "sponsor_match_miss"`.
2. Admin reviews the miss log weekly and adds missing entries manually to `tradingNames` via a dashboard mutation.
3. Re-score affected jobs after the manual additions.

---

## Follow-up ticket

Create ticket **008a — Companies House enrichment action** with:

- **Goal:** Convex action `enrichCompanyName(companyName)` that calls Companies House `/company/search`, finds the best legal-name match, and upserts into `tradingNames` with `source: "companies_house"`.
- **Files:** `convex/sponsors/enrichCompanyName.ts`
- **Trigger:** Called from ingestion when match confidence is "none" after the sponsor-matching pass.
- **DOD:**
  - Action resolves "Deliveroo" → "Roofoods Limited" against live Companies House API
  - Result written to `tradingNames` and confirmed via Convex dashboard
  - Deduplication: does not re-query if `normalisedTrading` already exists in the table
  - `COMPANIES_HOUSE_API_KEY` documented in CLAUDE.md env section (already done)
