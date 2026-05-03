# RapidAPI fixture-capture commands

Commands to capture **real** API responses from each job-feed source. Run these once, save the output as JSON files in `tickets/fixtures/`. Future tickets (020/021/022) build their parsers against these exact response shapes — no guessing.

---

## Pre-flight

You need:
- `RAPIDAPI_KEY` set in your shell — get it from rapidapi.com → your dashboard
- Subscriptions to the three APIs below (BASIC tier is fine; usually free up to a quota)
- `jq` installed for pretty-printing — `brew install jq` on macOS, `sudo apt install jq` on Linux

```bash
# Set this once per terminal session
export RAPIDAPI_KEY="your-rapidapi-key-here"
mkdir -p tickets/fixtures
```

---

## 1. LinkedIn (Fantastic Jobs — `active-jb-7d`)

This is the endpoint named in the original blueprint. Pulls UK Skilled Worker–eligible jobs posted in the last 7 days. We pull a small sample (limit=10) for the fixture.

```bash
curl --silent --location \
  --request GET \
  "https://linkedin-job-search-api.p.rapidapi.com/active-jb-7d?limit=10&offset=0&title_filter=%22software%20engineer%22&location_filter=%22United%20Kingdom%22" \
  --header "x-rapidapi-host: linkedin-job-search-api.p.rapidapi.com" \
  --header "x-rapidapi-key: $RAPIDAPI_KEY" \
  | jq '.' > tickets/fixtures/linkedin-sample.json

# Verify it worked
echo "Bytes: $(wc -c < tickets/fixtures/linkedin-sample.json)"
echo "Top-level keys:"
jq 'if type == "array" then .[0] | keys else keys end' tickets/fixtures/linkedin-sample.json
```

**Expected:** A JSON array of ~10 job objects. If you get `{"message":"You are not subscribed to this API."}`, go subscribe first. If you get `{"message":"Invalid API key"}`, your `$RAPIDAPI_KEY` is wrong.

**Watch for:** the `external_apply_url` field went unreliable in March 2026. Check whether it's populated, null, or missing entirely in your sample. Whatever you find here is what ticket 020 builds against.

---

## 2. Indeed (via JSearch — Realtime API)

Indeed doesn't have a single dominant RapidAPI provider. The most common one is **JSearch** which aggregates across Indeed, LinkedIn, ZipRecruiter, and others. We filter to Indeed sources only.

```bash
curl --silent --location \
  --request GET \
  "https://jsearch.p.rapidapi.com/search?query=software%20engineer%20in%20United%20Kingdom&page=1&num_pages=1&date_posted=week" \
  --header "x-rapidapi-host: jsearch.p.rapidapi.com" \
  --header "x-rapidapi-key: $RAPIDAPI_KEY" \
  | jq '.' > tickets/fixtures/indeed-sample.json

# Verify
echo "Bytes: $(wc -c < tickets/fixtures/indeed-sample.json)"
echo "Sample fields on first result:"
jq '.data[0] | keys' tickets/fixtures/indeed-sample.json
```

**Expected:** `{ status: "OK", request_id: "...", parameters: {...}, data: [...] }` — array of ~10 jobs in `data`. Each result has a `job_publisher` field telling you the source (Indeed, LinkedIn, etc.).

**Note:** if the user's plan choice was Indeed-specific (e.g. "Jobs Search Realtime Data" via a different host), use that host instead of `jsearch.p.rapidapi.com` and adjust the path. The principle is the same — capture 10 records, save the shape.

---

## 3. Glassdoor (also via JSearch, or dedicated Glassdoor API)

Two paths. Pick whichever you actually subscribed to.

**Option A — via JSearch (covers Glassdoor as one of its sources):**
Already captured in the Indeed call above; filter by `job_publisher == "Glassdoor"` in your code. Save a separate filtered fixture:

```bash
jq '.data | map(select(.job_publisher == "Glassdoor"))' \
  tickets/fixtures/indeed-sample.json \
  > tickets/fixtures/glassdoor-sample.json

echo "Glassdoor entries: $(jq 'length' tickets/fixtures/glassdoor-sample.json)"
```

If that returns 0, JSearch's current sample didn't include Glassdoor results — re-run the search with a different query or accept that Glassdoor coverage from JSearch is patchy and treat it as supplementary.

**Option B — dedicated Glassdoor API (e.g. "Glassdoor Real-Time" or similar):**

```bash
# Replace HOST with whatever the API listing tells you
curl --silent --location \
  --request GET \
  "https://glassdoor-real-time.p.rapidapi.com/companies/jobs?company=google&limit=10&location=United+Kingdom" \
  --header "x-rapidapi-host: glassdoor-real-time.p.rapidapi.com" \
  --header "x-rapidapi-key: $RAPIDAPI_KEY" \
  | jq '.' > tickets/fixtures/glassdoor-sample.json
```

**Watch for:** Glassdoor APIs on RapidAPI are flakier than LinkedIn/Indeed equivalents. If you can't get a stable response, mark Glassdoor as P2 and proceed with LinkedIn + Indeed for MVP. The PRD already lists Glassdoor as P1, not P0.

---

## 4. Adzuna (free, direct — not RapidAPI)

Worth capturing now even though Adzuna is the failover (ticket 023). Different shape from the RapidAPI sources.

```bash
# Adzuna uses app_id + app_key, not RapidAPI
export ADZUNA_APP_ID="your-app-id"
export ADZUNA_APP_KEY="your-app-key"

curl --silent --location \
  "https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=$ADZUNA_APP_ID&app_key=$ADZUNA_APP_KEY&results_per_page=10&what=software%20engineer" \
  | jq '.' > tickets/fixtures/adzuna-sample.json
```

---

## After capture — validate

Quick sanity check that all four files are populated and parse as JSON:

```bash
for f in linkedin-sample.json indeed-sample.json glassdoor-sample.json adzuna-sample.json; do
  if [ -f "tickets/fixtures/$f" ]; then
    bytes=$(wc -c < "tickets/fixtures/$f")
    valid=$(jq empty "tickets/fixtures/$f" 2>&1 && echo "valid" || echo "INVALID")
    echo "$f: $bytes bytes, $valid"
  else
    echo "$f: MISSING"
  fi
done
```

All four should show `valid` and >100 bytes. Anything smaller or `INVALID` means the API call failed — check the file contents for an error message, then go fix the auth/subscription/host header.

---

## What to do if a call fails

| Error message | Fix |
|---|---|
| `"You are not subscribed to this API"` | Go to the API page on RapidAPI, click Subscribe, pick the BASIC plan |
| `"Invalid API key"` | `$RAPIDAPI_KEY` is wrong or empty — re-export it |
| `"You have exceeded the rate limit"` | Wait and retry; check your plan's quota |
| `404 Not Found` | The endpoint path is wrong — check the API's "Endpoints" tab on RapidAPI for the current path |
| Empty array `[]` | Search returned no results — broaden the query (e.g. drop `title_filter`) |
| HTML response instead of JSON | You're hitting a redirect; check the `--location` flag is set |

---

## Don't commit secrets

`$RAPIDAPI_KEY` and `$ADZUNA_APP_KEY` should NEVER appear in committed JSON. The fixtures contain only the response data, not the key. Double-check with:

```bash
grep -i "rapidapi-key\|app_key" tickets/fixtures/*.json
# Should return nothing
```

If anything shows up, sanitise before committing.
