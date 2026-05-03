/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as lib_alerts from "../lib/alerts.js";
import type * as lib_matchCompanyToSponsor from "../lib/matchCompanyToSponsor.js";
import type * as lib_normaliseName from "../lib/normaliseName.js";
import type * as lib_parseSponsorCsv from "../lib/parseSponsorCsv.js";
import type * as lib_parseSponsorRow from "../lib/parseSponsorRow.js";
import type * as sponsors_refresh from "../sponsors/refresh.js";
import type * as sponsors_seedTradingNames from "../sponsors/seedTradingNames.js";
import type * as sponsors_tradingNames from "../sponsors/tradingNames.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "lib/alerts": typeof lib_alerts;
  "lib/matchCompanyToSponsor": typeof lib_matchCompanyToSponsor;
  "lib/normaliseName": typeof lib_normaliseName;
  "lib/parseSponsorCsv": typeof lib_parseSponsorCsv;
  "lib/parseSponsorRow": typeof lib_parseSponsorRow;
  "sponsors/refresh": typeof sponsors_refresh;
  "sponsors/seedTradingNames": typeof sponsors_seedTradingNames;
  "sponsors/tradingNames": typeof sponsors_tradingNames;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
