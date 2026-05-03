/**
 * seedTradingNames.ts
 *
 * Hand-curated trading-name → legal-name map for well-known UK employers.
 * These cover cases where a job board lists the employer by a brand name that
 * differs from the legal name on the Home Office sponsor register.
 *
 * To seed: npx convex run sponsors/seedTradingNames:seedTradingNames '{}'
 *
 * The mutation is idempotent — it skips entries whose normalisedTrading already
 * exists in the table.
 */

import { internalMutation } from "../_generated/server";
import { normaliseName } from "../lib/normaliseName";

/** Raw seed entries. Legal names match common Home Office register forms. */
export const TRADING_NAME_SEEDS: Array<{
  tradingName: string;
  legalName: string;
}> = [
  // Retail
  { tradingName: "M&S", legalName: "Marks And Spencer PLC" },
  { tradingName: "Marks & Spencer", legalName: "Marks And Spencer PLC" },
  { tradingName: "Boots", legalName: "Boots UK Limited" },
  { tradingName: "Tesco", legalName: "Tesco PLC" },
  { tradingName: "Sainsbury's", legalName: "J Sainsbury PLC" },
  { tradingName: "Asda", legalName: "Asda Stores Limited" },
  { tradingName: "Waitrose", legalName: "Waitrose Limited" },
  { tradingName: "John Lewis", legalName: "John Lewis PLC" },
  { tradingName: "John Lewis Partnership", legalName: "John Lewis PLC" },
  { tradingName: "Next", legalName: "Next PLC" },
  { tradingName: "Primark", legalName: "Primark Stores Limited" },
  { tradingName: "Argos", legalName: "Argos Limited" },
  { tradingName: "Currys", legalName: "Currys PLC" },
  { tradingName: "Halfords", legalName: "Halfords Limited" },

  // Tech / digital
  { tradingName: "Google", legalName: "Google UK Limited" },
  { tradingName: "Amazon", legalName: "Amazon UK Services Limited" },
  { tradingName: "Microsoft", legalName: "Microsoft Limited" },
  { tradingName: "Apple", legalName: "Apple (UK) Limited" },
  { tradingName: "Meta", legalName: "Meta Platforms Ireland Limited" },
  { tradingName: "Facebook", legalName: "Meta Platforms Ireland Limited" },
  { tradingName: "Netflix", legalName: "Netflix Services UK Limited" },
  { tradingName: "Spotify", legalName: "Spotify UK Limited" },
  { tradingName: "Uber", legalName: "Uber London Limited" },
  { tradingName: "Deliveroo", legalName: "Roofoods Limited" },
  { tradingName: "Revolut", legalName: "Revolut Limited" },
  { tradingName: "Monzo", legalName: "Monzo Bank Limited" },
  { tradingName: "Starling Bank", legalName: "Starling Bank Limited" },
  { tradingName: "Starling", legalName: "Starling Bank Limited" },

  // Banking & finance
  { tradingName: "Barclays", legalName: "Barclays Bank PLC" },
  { tradingName: "HSBC", legalName: "HSBC UK Bank PLC" },
  { tradingName: "Lloyds", legalName: "Lloyds Bank PLC" },
  { tradingName: "Lloyds Bank", legalName: "Lloyds Bank PLC" },
  { tradingName: "NatWest", legalName: "National Westminster Bank PLC" },
  { tradingName: "National Westminster", legalName: "National Westminster Bank PLC" },
  { tradingName: "RBS", legalName: "The Royal Bank Of Scotland PLC" },
  { tradingName: "Royal Bank of Scotland", legalName: "The Royal Bank Of Scotland PLC" },
  { tradingName: "Santander", legalName: "Santander UK PLC" },
  { tradingName: "Nationwide", legalName: "Nationwide Building Society" },
  { tradingName: "Goldman Sachs", legalName: "Goldman Sachs International" },
  { tradingName: "Morgan Stanley", legalName: "Morgan Stanley & Co International PLC" },
  { tradingName: "JPMorgan", legalName: "J.P. Morgan Securities PLC" },
  { tradingName: "JP Morgan", legalName: "J.P. Morgan Securities PLC" },

  // Professional services
  { tradingName: "Deloitte", legalName: "Deloitte LLP" },
  { tradingName: "KPMG", legalName: "KPMG LLP" },
  { tradingName: "PwC", legalName: "PricewaterhouseCoopers LLP" },
  { tradingName: "PricewaterhouseCoopers", legalName: "PricewaterhouseCoopers LLP" },
  { tradingName: "EY", legalName: "Ernst & Young LLP" },
  { tradingName: "Ernst & Young", legalName: "Ernst & Young LLP" },
  { tradingName: "Accenture", legalName: "Accenture (UK) Limited" },

  // Telecoms
  { tradingName: "BT", legalName: "British Telecommunications PLC" },
  { tradingName: "Vodafone", legalName: "Vodafone Limited" },
  { tradingName: "O2", legalName: "Telefonica UK Limited" },
  { tradingName: "EE", legalName: "EE Limited" },
  { tradingName: "Three", legalName: "Hutchison 3G UK Limited" },
  { tradingName: "Virgin Media", legalName: "Virgin Media Limited" },

  // Aviation & transport
  { tradingName: "British Airways", legalName: "British Airways PLC" },
  { tradingName: "EasyJet", legalName: "Easyjet Airline Company Limited" },
  { tradingName: "Ryanair", legalName: "Ryanair DAC" },
  { tradingName: "Heathrow", legalName: "Heathrow Airport Limited" },

  // Consulting & IT services
  { tradingName: "IBM", legalName: "IBM United Kingdom Limited" },
  { tradingName: "Capgemini", legalName: "Capgemini UK PLC" },
  { tradingName: "TCS", legalName: "Tata Consultancy Services Limited" },
  { tradingName: "Tata Consultancy", legalName: "Tata Consultancy Services Limited" },
  { tradingName: "Infosys", legalName: "Infosys Limited" },
  { tradingName: "Wipro", legalName: "Wipro Limited" },

  // Energy
  { tradingName: "BP", legalName: "BP PLC" },
  { tradingName: "Shell", legalName: "Shell UK Limited" },

  // Pharma / life sciences
  { tradingName: "GSK", legalName: "GlaxoSmithKline PLC" },
  { tradingName: "GlaxoSmithKline", legalName: "GlaxoSmithKline PLC" },
  { tradingName: "AstraZeneca", legalName: "AstraZeneca PLC" },
  { tradingName: "Pfizer", legalName: "Pfizer Limited" },

  // Manufacturing & engineering
  { tradingName: "Rolls-Royce", legalName: "Rolls-Royce PLC" },
  { tradingName: "Rolls Royce", legalName: "Rolls-Royce PLC" },
  { tradingName: "BAE Systems", legalName: "BAE Systems PLC" },
  { tradingName: "Unilever", legalName: "Unilever UK Limited" },
  { tradingName: "Diageo", legalName: "Diageo PLC" },
  { tradingName: "Burberry", legalName: "Burberry Limited" },

  // Media & broadcast
  { tradingName: "BBC", legalName: "British Broadcasting Corporation" },
  { tradingName: "ITV", legalName: "ITV PLC" },
  { tradingName: "Sky", legalName: "Sky UK Limited" },
  { tradingName: "Channel 4", legalName: "Channel Four Television Corporation" },
  { tradingName: "Financial Times", legalName: "The Financial Times Limited" },
  { tradingName: "FT", legalName: "The Financial Times Limited" },

  // Food & hospitality
  { tradingName: "McDonald's", legalName: "McDonald's Restaurants Limited" },
  { tradingName: "McDonalds", legalName: "McDonald's Restaurants Limited" },
  { tradingName: "KFC", legalName: "KFC (Great Britain) Limited" },
  { tradingName: "Costa Coffee", legalName: "Costa Limited" },
  { tradingName: "Costa", legalName: "Costa Limited" },
  { tradingName: "Pret", legalName: "Pret A Manger (Europe) Limited" },
  { tradingName: "Pret a Manger", legalName: "Pret A Manger (Europe) Limited" },
  { tradingName: "Starbucks", legalName: "Starbucks Coffee Company UK Limited" },

  // Fashion
  { tradingName: "H&M", legalName: "H & M Hennes & Mauritz UK Limited" },
  { tradingName: "Zara", legalName: "Zara UK Limited" },
];

/**
 * Seed the tradingNames table with the hand-curated list.
 * Idempotent — skips any entry whose normalisedTrading already exists.
 */
export const seedTradingNames = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let skipped = 0;

    for (const seed of TRADING_NAME_SEEDS) {
      const normalisedTrading = normaliseName(seed.tradingName);
      const normalisedLegal = normaliseName(seed.legalName);

      if (!normalisedTrading || !normalisedLegal) {
        skipped++;
        continue;
      }

      const existing = await ctx.db
        .query("tradingNames")
        .withIndex("byNormalisedTrading", (q) =>
          q.eq("normalisedTrading", normalisedTrading),
        )
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("tradingNames", {
        tradingName: seed.tradingName,
        normalisedTrading,
        legalName: seed.legalName,
        normalisedLegal,
        source: "manual",
      });
      inserted++;
    }

    return { inserted, skipped };
  },
});
