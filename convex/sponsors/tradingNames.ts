/**
 * tradingNames.ts
 *
 * Internal query that loads the full trading-name lookup table into a
 * structure ready for use in matchCompanyToSponsor.
 *
 * Usage in an action:
 *   const rows = await ctx.runQuery(internal.sponsors.tradingNames.getTradingNameMap, {});
 *   const tradingMap = new Map(rows.map(r => [r.normalisedTrading, r]));
 */

import { internalQuery } from "../_generated/server";
import type { TradingNameRow } from "../lib/matchCompanyToSponsor";

/**
 * Return all trading-name entries as a plain array of TradingNameRow objects.
 * The caller builds the Map:
 *   new Map(rows.map(r => [r.normalisedTrading, r]))
 */
export const getTradingNameMap = internalQuery({
  args: {},
  handler: async (ctx): Promise<TradingNameRow[]> => {
    const rows = await ctx.db.query("tradingNames").collect();
    return rows.map((r) => ({
      normalisedTrading: r.normalisedTrading,
      normalisedLegal: r.normalisedLegal,
      legalName: r.legalName,
    }));
  },
});
