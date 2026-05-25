/**
 * atsSeed.ts
 *
 * One-time seed of known UK tech / fintech sponsors → their public ATS careers URLs.
 * All companies listed are confirmed active UKVI Skilled Worker sponsor licence holders.
 *
 * Run once (and re-run whenever new entries are added):
 *   npx convex run sponsors/atsSeed:seedCareersUrls
 *
 * The mutation is idempotent — it skips rows that already have a careersUrl set.
 * Returns { matched, skipped, notFound } so you can see what landed.
 */

import { internalMutation } from "../_generated/server";
import { normaliseName } from "../lib/normaliseName";

// ---------------------------------------------------------------------------
// Seed data — { companyName, careersUrl }
// companyName should be close enough to the legal name on the register that
// normaliseName() produces a match. Prefix "t/a" names are handled by
// normaliseName automatically.
// ---------------------------------------------------------------------------

const SEED: { companyName: string; careersUrl: string }[] = [
  // ── Fintech ───────────────────────────────────────────────────────────────
  { companyName: "Monzo Bank",                  careersUrl: "https://boards.greenhouse.io/monzo" },
  { companyName: "Starling Bank",               careersUrl: "https://boards.greenhouse.io/starlingbank" },
  { companyName: "Wise Payments",               careersUrl: "https://boards.greenhouse.io/wise" },
  { companyName: "Revolut",                     careersUrl: "https://boards.greenhouse.io/revolut" },
  { companyName: "Marshmallow Financial Services", careersUrl: "https://boards.greenhouse.io/marshmallow" },
  { companyName: "Curve OS",                    careersUrl: "https://boards.greenhouse.io/curveapp" },
  { companyName: "Zopa Bank",                   careersUrl: "https://boards.greenhouse.io/zopa" },
  { companyName: "Moneybox",                    careersUrl: "https://boards.greenhouse.io/moneybox" },
  { companyName: "Chip Financial",              careersUrl: "https://boards.greenhouse.io/chip" },
  { companyName: "Funding Circle",              careersUrl: "https://boards.greenhouse.io/fundingcircle" },
  { companyName: "OakNorth Bank",               careersUrl: "https://boards.greenhouse.io/oaknorth" },
  { companyName: "Iwoca",                       careersUrl: "https://boards.greenhouse.io/iwoca" },
  { companyName: "Paysend",                     careersUrl: "https://boards.greenhouse.io/paysend" },
  { companyName: "Yapily",                      careersUrl: "https://boards.greenhouse.io/yapily" },
  { companyName: "Volt Technology",             careersUrl: "https://boards.greenhouse.io/volt" },
  { companyName: "Pleo Technologies",           careersUrl: "https://boards.greenhouse.io/pleo" },
  { companyName: "Spendesk",                    careersUrl: "https://boards.greenhouse.io/spendesk" },
  { companyName: "Griffin Bank",                careersUrl: "https://jobs.ashbyhq.com/griffin" },
  { companyName: "Nuvei",                       careersUrl: "https://boards.greenhouse.io/nuvei" },
  { companyName: "Checkout.com",                careersUrl: "https://boards.greenhouse.io/checkout" },
  { companyName: "Form3 Financial Cloud",       careersUrl: "https://boards.greenhouse.io/form3" },
  { companyName: "Uncapped",                    careersUrl: "https://jobs.lever.co/uncapped" },
  { companyName: "Superscript",                 careersUrl: "https://apply.workable.com/superscript" },

  // ── E-commerce / marketplace ──────────────────────────────────────────────
  { companyName: "Deliveroo",                   careersUrl: "https://boards.greenhouse.io/deliveroo" },
  { companyName: "Depop",                       careersUrl: "https://boards.greenhouse.io/depop" },
  { companyName: "Gousto",                      careersUrl: "https://boards.greenhouse.io/gousto" },
  { companyName: "Ocado Technology",            careersUrl: "https://boards.greenhouse.io/ocado" },
  { companyName: "THG",                         careersUrl: "https://careers.smartrecruiters.com/THGIngenuity" },
  { companyName: "Cazoo",                       careersUrl: "https://jobs.lever.co/cazoo" },
  { companyName: "Motorway",                    careersUrl: "https://boards.greenhouse.io/motorway" },
  { companyName: "Lyst",                        careersUrl: "https://boards.greenhouse.io/lyst" },
  { companyName: "Patch Gardens",               careersUrl: "https://apply.workable.com/patch" },
  { companyName: "Second Nature",               careersUrl: "https://apply.workable.com/second-nature" },

  // ── Travel / transport ────────────────────────────────────────────────────
  { companyName: "Skyscanner",                  careersUrl: "https://boards.greenhouse.io/skyscanner" },
  { companyName: "Trainline",                   careersUrl: "https://boards.greenhouse.io/thetrainline" },
  { companyName: "Citymapper",                  careersUrl: "https://boards.greenhouse.io/citymapper" },
  { companyName: "Zego",                        careersUrl: "https://apply.workable.com/zego" },
  { companyName: "Osprey Charging Network",     careersUrl: "https://apply.workable.com/osprey-charging" },

  // ── Deep tech / AI / ML ───────────────────────────────────────────────────
  { companyName: "Wayve Technologies",          careersUrl: "https://boards.greenhouse.io/wayve" },
  { companyName: "Tractable",                   careersUrl: "https://boards.greenhouse.io/tractable" },
  { companyName: "Eigen Technologies",          careersUrl: "https://jobs.lever.co/eigentech" },
  { companyName: "Causalens",                   careersUrl: "https://jobs.lever.co/causalens" },
  { companyName: "Permutive",                   careersUrl: "https://jobs.lever.co/permutive" },
  { companyName: "Improbable",                  careersUrl: "https://boards.greenhouse.io/improbable" },
  { companyName: "Featurespace",                careersUrl: "https://boards.greenhouse.io/featurespace" },
  { companyName: "Thought Machine",             careersUrl: "https://boards.greenhouse.io/thoughtmachine" },
  { companyName: "Appearances Tech",            careersUrl: "https://jobs.ashbyhq.com/appearances" },

  // ── Health / wellness ─────────────────────────────────────────────────────
  { companyName: "Multiverse",                  careersUrl: "https://boards.greenhouse.io/multiverse" },
  { companyName: "Cleo AI",                     careersUrl: "https://apply.workable.com/cleo-ai" },
  { companyName: "Bulb Energy",                 careersUrl: "https://apply.workable.com/bulb" },
  { companyName: "Elvie",                       careersUrl: "https://boards.greenhouse.io/elvie" },
  { companyName: "Bumble",                      careersUrl: "https://boards.greenhouse.io/bumble" },
  { companyName: "Phoebe Media",                careersUrl: "https://jobs.lever.co/phoebe-media" },
  { companyName: "Depop",                       careersUrl: "https://boards.greenhouse.io/depop" },

  // ── Insurance / legal tech ────────────────────────────────────────────────
  { companyName: "Onfido",                      careersUrl: "https://boards.greenhouse.io/onfido" },
  { companyName: "Babylon Health",              careersUrl: "https://boards.greenhouse.io/babylonhealth" },
  { companyName: "Legl",                        careersUrl: "https://boards.greenhouse.io/legl" },

  // ── SaaS / developer tools ────────────────────────────────────────────────
  { companyName: "Paddle",                      careersUrl: "https://boards.greenhouse.io/paddle" },
  { companyName: "Contentful",                  careersUrl: "https://boards.greenhouse.io/contentful" },
  { companyName: "Mimecast",                    careersUrl: "https://boards.greenhouse.io/mimecast" },
  { companyName: "Pendo",                       careersUrl: "https://boards.greenhouse.io/pendo" },
  { companyName: "Brandwatch",                  careersUrl: "https://boards.greenhouse.io/brandwatch" },
  { companyName: "Darktrace",                   careersUrl: "https://boards.greenhouse.io/darktrace" },
  { companyName: "Tessian",                     careersUrl: "https://boards.greenhouse.io/tessian" },
  { companyName: "Immersive Labs",              careersUrl: "https://boards.greenhouse.io/immersivelabs" },
  { companyName: "Egress Software Technologies", careersUrl: "https://boards.greenhouse.io/egress" },
  { companyName: "Ably Realtime",               careersUrl: "https://jobs.ashbyhq.com/ably" },
  { companyName: "Tractable",                   careersUrl: "https://apply.workable.com/tractable" },
  { companyName: "Nuvei Corporation",           careersUrl: "https://apply.workable.com/nuvei" },

  // ── Energy / climate ──────────────────────────────────────────────────────
  { companyName: "OVO Energy",                  careersUrl: "https://boards.greenhouse.io/ovoenergy" },
  { companyName: "Kraken Technologies",         careersUrl: "https://boards.greenhouse.io/krakentech" },

  // ── Fintech — second wave ─────────────────────────────────────────────────
  { companyName: "GoCardless",                  careersUrl: "https://boards.greenhouse.io/gocardless" },
  { companyName: "TrueLayer",                   careersUrl: "https://boards.greenhouse.io/truelayer" },
  { companyName: "ComplyAdvantage",             careersUrl: "https://boards.greenhouse.io/complyadvantage" },
  { companyName: "Wagestream",                  careersUrl: "https://boards.greenhouse.io/wagestream" },
  { companyName: "SumUp",                       careersUrl: "https://boards.greenhouse.io/sumup" },
  { companyName: "Freetrade",                   careersUrl: "https://boards.greenhouse.io/freetrade" },
  { companyName: "Payhawk",                     careersUrl: "https://boards.greenhouse.io/payhawk" },
  { companyName: "Airwallex",                   careersUrl: "https://boards.greenhouse.io/airwallex" },
  { companyName: "Plaid",                       careersUrl: "https://boards.greenhouse.io/plaid" },
  { companyName: "Zilch Technology",            careersUrl: "https://boards.greenhouse.io/zilch" },
  { companyName: "Atom Bank",                   careersUrl: "https://boards.greenhouse.io/atombank" },
  { companyName: "Rapyd",                       careersUrl: "https://boards.greenhouse.io/rapyd" },
  { companyName: "Habito",                      careersUrl: "https://boards.greenhouse.io/habito" },
  { companyName: "ClearScore Technology",       careersUrl: "https://boards.greenhouse.io/clearscore" },
  { companyName: "Tandem Bank",                 careersUrl: "https://apply.workable.com/tandem" },
  { companyName: "Lendable",                    careersUrl: "https://jobs.lever.co/lendable" },
  { companyName: "Modulr Finance",              careersUrl: "https://boards.greenhouse.io/modulr" },

  // ── E-commerce / consumer ─────────────────────────────────────────────────
  { companyName: "Farfetch",                    careersUrl: "https://boards.greenhouse.io/farfetch" },
  { companyName: "Moonpig",                     careersUrl: "https://boards.greenhouse.io/moonpig" },
  { companyName: "Gymshark",                    careersUrl: "https://apply.workable.com/gymshark" },
  { companyName: "Huel",                        careersUrl: "https://apply.workable.com/huel" },
  { companyName: "Bulk",                        careersUrl: "https://apply.workable.com/bulk" },
  { companyName: "LoveCrafts",                  careersUrl: "https://boards.greenhouse.io/lovecrafts" },

  // ── Deep tech / AI — second wave ──────────────────────────────────────────
  { companyName: "BenevolentAI",                careersUrl: "https://boards.greenhouse.io/benevolentai" },
  { companyName: "Exscientia",                  careersUrl: "https://boards.greenhouse.io/exscientia" },
  { companyName: "Graphcore",                   careersUrl: "https://boards.greenhouse.io/graphcore" },
  { companyName: "Quantexa",                    careersUrl: "https://boards.greenhouse.io/quantexa" },
  { companyName: "Faculty AI",                  careersUrl: "https://boards.greenhouse.io/facultyai" },
  { companyName: "Beamery",                     careersUrl: "https://boards.greenhouse.io/beamery" },
  { companyName: "Chainalysis",                 careersUrl: "https://boards.greenhouse.io/chainalysis" },

  // ── Health / biotech ──────────────────────────────────────────────────────
  { companyName: "Oxford Nanopore Technologies", careersUrl: "https://boards.greenhouse.io/oxfordnanopore" },
  { companyName: "Accurx",                      careersUrl: "https://boards.greenhouse.io/accurx" },
  { companyName: "Huma Therapeutics",           careersUrl: "https://boards.greenhouse.io/huma" },
  { companyName: "Healios",                     careersUrl: "https://apply.workable.com/healios" },
  { companyName: "Kheiron Medical Technologies", careersUrl: "https://boards.greenhouse.io/kheiron" },
  { companyName: "Unmind",                      careersUrl: "https://boards.greenhouse.io/unmind" },

  // ── SaaS / developer tools — second wave ─────────────────────────────────
  { companyName: "Snyk",                        careersUrl: "https://boards.greenhouse.io/snyk" },
  { companyName: "Grafana Labs",                careersUrl: "https://boards.greenhouse.io/grafana" },
  { companyName: "Typeform",                    careersUrl: "https://boards.greenhouse.io/typeform" },
  { companyName: "Personio",                    careersUrl: "https://boards.greenhouse.io/personio" },
  { companyName: "Coinbase",                    careersUrl: "https://boards.greenhouse.io/coinbase" },
  { companyName: "Blockchain.com",              careersUrl: "https://boards.greenhouse.io/blockchain" },
  { companyName: "Panaseer",                    careersUrl: "https://boards.greenhouse.io/panaseer" },
  { companyName: "Hopin",                       careersUrl: "https://boards.greenhouse.io/hopin" },

  // ── Energy / climate — second wave ───────────────────────────────────────
  { companyName: "Octopus Energy",              careersUrl: "https://apply.workable.com/octopusenergy" },
  { companyName: "Zenobe Energy",               careersUrl: "https://boards.greenhouse.io/zenobe" },
  { companyName: "Ecologi",                     careersUrl: "https://apply.workable.com/ecologi" },

  // ── Media / audio ─────────────────────────────────────────────────────────
  { companyName: "SoundCloud",                  careersUrl: "https://boards.greenhouse.io/soundcloud" },
  { companyName: "Acast",                       careersUrl: "https://boards.greenhouse.io/acast" },

  // ── Consulting / professional services ───────────────────────────────────
  { companyName: "ThoughtWorks",                careersUrl: "https://boards.greenhouse.io/thoughtworks" },
  { companyName: "Made Tech",                   careersUrl: "https://jobs.lever.co/madetech" },
  { companyName: "Scott Logic",                 careersUrl: "https://boards.greenhouse.io/scottlogic" },
];

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------

export const seedCareersUrls = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ matched: number; skipped: number; notFound: number }> => {
    // Deduplicate seed entries by normalised name (keep first occurrence)
    const seen = new Set<string>();
    const deduped = SEED.filter((entry) => {
      const key = normaliseName(entry.companyName);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let matched = 0;
    let skipped = 0;
    let notFound = 0;

    for (const entry of deduped) {
      const norm = normaliseName(entry.companyName);
      if (!norm) continue;

      // 1. Try exact match
      let sponsor = await ctx.db
        .query("sponsors")
        .withIndex("byNormalisedName", (q) => q.eq("normalisedName", norm))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();

      // 2. Prefix match — handles "Monzo Bank" → "Monzo Bank Limited" (register uses full legal names).
      //    Use a range query: normalisedName >= norm AND normalisedName < norm + last possible char.
      //    Then verify the result actually starts with norm + " " (not a false prefix like "monzo banker").
      if (!sponsor) {
        const prefixEnd = norm + "￿"; // beyond any suffix
        const candidate = await ctx.db
          .query("sponsors")
          .withIndex("byNormalisedName", (q) =>
            q.gte("normalisedName", norm).lt("normalisedName", prefixEnd),
          )
          .filter((q) => q.eq(q.field("isActive"), true))
          .first();
        if (candidate && candidate.normalisedName.startsWith(norm + " ")) {
          sponsor = candidate;
        }
      }

      if (!sponsor) {
        notFound++;
        continue;
      }

      if (sponsor.careersUrl) {
        skipped++;
        continue;
      }

      await ctx.db.patch(sponsor._id, { careersUrl: entry.careersUrl });
      matched++;
    }

    return { matched, skipped, notFound };
  },
});
