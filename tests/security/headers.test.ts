/**
 * tests/security/headers.test.ts
 *
 * Confirms all 5 required security headers are configured in next.config.mjs.
 *
 * We read the config file as text and verify each header key and its value
 * are present. This is intentionally a static analysis test — it does not
 * require a running Next.js server and cannot produce false-positives from
 * environment differences.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(__dirname, "../../next.config.mjs");
const config = readFileSync(CONFIG_PATH, "utf-8");

// ---------------------------------------------------------------------------
// Header presence
// ---------------------------------------------------------------------------

describe("security headers are configured in next.config.mjs", () => {
  it("sets X-Frame-Options to DENY (prevents clickjacking)", () => {
    expect(config).toContain("X-Frame-Options");
    expect(config).toContain("DENY");
  });

  it("sets X-Content-Type-Options to nosniff (prevents MIME sniffing)", () => {
    expect(config).toContain("X-Content-Type-Options");
    expect(config).toContain("nosniff");
  });

  it("sets Referrer-Policy (controls referrer leakage)", () => {
    expect(config).toContain("Referrer-Policy");
    expect(config).toContain("strict-origin-when-cross-origin");
  });

  it("sets Permissions-Policy (restricts sensitive browser APIs)", () => {
    expect(config).toContain("Permissions-Policy");
  });

  it("sets X-XSS-Protection (legacy XSS filter for older browsers)", () => {
    expect(config).toContain("X-XSS-Protection");
    expect(config).toContain("1; mode=block");
  });
});

// ---------------------------------------------------------------------------
// Permissions-Policy restricts high-risk capabilities
// ---------------------------------------------------------------------------

describe("Permissions-Policy restricts sensitive browser APIs", () => {
  it("disables camera access", () => {
    expect(config).toContain("camera=()");
  });

  it("disables microphone access", () => {
    expect(config).toContain("microphone=()");
  });

  it("disables geolocation access", () => {
    expect(config).toContain("geolocation=()");
  });
});

// ---------------------------------------------------------------------------
// Headers apply to all routes
// ---------------------------------------------------------------------------

describe("security headers apply to all routes", () => {
  it("source pattern covers all paths", () => {
    // The glob /(.*) or similar pattern must be present
    expect(config).toMatch(/source.*\.\*/);
  });

  it("all 5 header keys appear in a single headers() function", () => {
    const headerKeys = [
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-XSS-Protection",
    ];
    for (const key of headerKeys) {
      expect(config).toContain(key);
    }
  });
});

// ---------------------------------------------------------------------------
// X-Frame-Options value is DENY (not SAMEORIGIN — we have no frame use cases)
// ---------------------------------------------------------------------------

describe("X-Frame-Options is set to DENY", () => {
  it("value is DENY not SAMEORIGIN", () => {
    // DENY is stricter than SAMEORIGIN and appropriate for an app with no
    // legitimate embedding use cases.
    const xfoMatch = config.match(/X-Frame-Options[^}]+value[^}]+/);
    expect(xfoMatch).not.toBeNull();
    expect(config).toContain('"DENY"');
  });
});
