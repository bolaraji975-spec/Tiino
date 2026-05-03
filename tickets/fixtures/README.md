# Test fixtures

Real-world inputs captured from live sources. Tests in `tests/` and Convex actions reference these to validate parsers and scoring against real data, not synthetic guesses.

**Rule:** if a test or parser depends on a third-party API's response shape, the corresponding fixture lives here. No exceptions.

---

## Inventory

| File | Source | Captured | Used by | Notes |
|---|---|---|---|---|
| `sponsor-register-snapshot.csv` | gov.uk Register of Licensed Sponsors (Worker & Temporary Worker) | YYYY-MM-DD | `tests/lib/parseSponsorRow.test.ts`, `tests/lib/parseSponsorCsv.test.ts` | 500-row stratified sample. 450 Skilled Worker A-rated, 16 B-rated (all of them in the full register), 21 Temporary/Global, 15 other routes. CRLF line endings. Embedded commas in some fields. |
| `sponsor-register-FULL.csv` | gov.uk Register of Licensed Sponsors | YYYY-MM-DD | `tests/lib/matchCompanyToSponsor.bench.ts` (ticket 011) | Full snapshot (~141k rows, 10.4MB). Used by the precision/recall benchmark only. NOT used in unit tests (too slow). |
| `linkedin-sample.json` | RapidAPI — Fantastic Jobs `linkedin-job-search-api` endpoint `active-jb-7d` | YYYY-MM-DD | `convex/jobs/ingestLinkedIn.ts` (ticket 020) | 10 jobs, UK Skilled Worker filter. ⚠️ `external_apply_url` was unreliable as of March 2026 — confirm whether it's populated in this sample. |
| `indeed-sample.json` | RapidAPI — JSearch `jsearch.p.rapidapi.com` (filter `job_publisher == "Indeed"`) | YYYY-MM-DD | `convex/jobs/ingestIndeed.ts` (ticket 021) | 10 jobs. JSearch aggregates multiple sources; we filter to Indeed. |
| `glassdoor-sample.json` | RapidAPI — JSearch (filter `job_publisher == "Glassdoor"`) OR dedicated Glassdoor API | YYYY-MM-DD | `convex/jobs/ingestGlassdoor.ts` (ticket 022) | If JSearch returned no Glassdoor results, this file may be empty `[]`. Glassdoor coverage is P1, not P0 — fine to defer if data is patchy. |
| `adzuna-sample.json` | api.adzuna.com (direct, not RapidAPI) | YYYY-MM-DD | `convex/jobs/ingestAdzuna.ts` (ticket 023) | UK GB endpoint. 10 jobs. Free tier; 100 calls/day per IP. |
| `cvs/sample-cv-1.pdf` | Anonymised real CV | YYYY-MM-DD | `tests/profiles/parseCv.test.ts` (ticket 016), `tests/applications/generate.test.ts` (ticket 037) | Software engineer profile, 5 years experience. PII removed. |
| `cvs/sample-cv-2.docx` | Anonymised real CV | YYYY-MM-DD | same | Marketing manager profile, 8 years experience. PII removed. |
| `cvs/sample-cv-3.pdf` | Anonymised real CV | YYYY-MM-DD | same | Recent graduate, no commercial experience yet. Edge case for parser. |

> **Replace YYYY-MM-DD** with actual capture date when you commit each file.

---

## Refresh policy

These are **not** automatically refreshed. They're snapshots at a point in time, deliberately frozen so tests are reproducible.

Refresh manually when:
- A third-party API's schema changes and tests start failing
- The sponsor register format changes (gov.uk has done this rarely but it happens)
- A test uncovers an edge case the current fixture doesn't cover — add a new fixture, don't replace the old one

When refreshing:
1. Capture the new fixture (see `CAPTURE_COMMANDS.md`)
2. Update the "Captured" column above with today's date
3. Run the full test suite to confirm nothing else broke
4. Commit with message `fixtures: refresh <name> from <source>`

---

## What goes in fixtures vs. what doesn't

**In fixtures:**
- Real API responses (JSON / CSV / etc.) used by parsers
- Anonymised real CVs used by Claude prompts
- Labelled benchmark data (e.g. `sponsor-matching.json` for ticket 011)

**NOT in fixtures:**
- Synthetic test data invented in test files — those stay inline in the `.test.ts` file
- API keys, tokens, or any secret material
- Data tied to a specific user account that hasn't been anonymised
- Anything over ~10MB that isn't strictly necessary (the full sponsor register is the only exception)

---

## Anonymisation checklist for CV fixtures

Before committing any CV fixture file:

- [ ] Replace personal name with a realistic alias (e.g. `Priya Sharma`, `Daniel Lee`)
- [ ] Replace email address with `firstname.lastname@example.com`
- [ ] Replace phone number with a fake UK mobile (`07700 900xxx` is reserved for fiction)
- [ ] Replace home address with a fictional one
- [ ] Replace national insurance number, date of birth (if present), passport details
- [ ] Replace reference contact details
- [ ] Keep employer names and dates real — or replace with realistic equivalents (don't replace with "Company A, Company B" — Claude needs realistic context to test against)
- [ ] Confirm with the source person that anonymisation is acceptable
- [ ] Run `pdftotext sample-cv-1.pdf - | grep -iE "(@|\+44|07)"` to spot-check no contact info leaks

---

## Why this directory exists

Synthetic test data lies. It tells you your code works on the cases you imagined. Real data tells you what actually breaks — for example:

- `sponsor-register-snapshot.csv` revealed that real sponsor ratings use parentheses with spaces (`"Worker (A rating)"`) not hyphens (`"Worker (A-rated)"`) — the PRD copy was wrong
- A real LinkedIn API response showed the `external_apply_url` field is unreliable in March 2026 — without the fixture you'd have built ingestion against a field that's null in production
- Real CVs include character encoding edge cases, multi-column layouts, and inconsistent date formats that no synthetic fixture would exercise

Treat fixtures as a first-class part of the test suite. They're the difference between "tests pass" and "the system actually works."
