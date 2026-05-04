/**
 * http.ts
 *
 * HTTP action router for Tino.
 *
 * auth.addHttpRoutes registers the Convex Auth endpoints:
 *   POST /auth/signin
 *   GET  /.well-known/openid-configuration
 *   GET  /.well-known/jwks.json
 *   GET  /api/auth/callback/:provider  (OAuth — unused in Phase 0)
 *
 * Future routes (Stripe webhook, etc.) go here.
 */

import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
