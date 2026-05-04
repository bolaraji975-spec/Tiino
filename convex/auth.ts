/**
 * auth.ts
 *
 * Convex Auth configuration for Tino.
 *
 * Provider: Email magic link, delivered via Resend.
 *
 * Flow:
 *   1. User submits email → signIn("email", { email }) is called
 *   2. sendVerificationRequest fires and POSTs to Resend with the magic link URL
 *   3. User clicks the link → URL contains ?code=<token>
 *   4. Frontend calls signIn("email", { code }) → user is authenticated
 *
 * On first sign-in, createOrUpdateUser inserts a users row with
 * plan="free" and payPerCvCredits=0 as required by the DOD.
 *
 * Required Convex env vars (npx convex env set):
 *   RESEND_API_KEY
 *   EMAIL_FROM_TRANSACTIONAL   e.g. hello@tiino.app
 *   CONVEX_SITE_URL            set automatically on deploy; set manually for local dev
 */

import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";

// ---------------------------------------------------------------------------
// Magic link email sender (Resend)
// ---------------------------------------------------------------------------

async function sendMagicLinkEmail(
  to: string,
  url: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // During local development without a key, log the link so devs can test
    console.log(`[auth] magic link for ${to}: ${url}`);
    return;
  }

  const from =
    process.env.EMAIL_FROM_TRANSACTIONAL ?? "hello@tiino.app";

  const body = JSON.stringify({
    from,
    to: [to],
    subject: "Sign in to Tino",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;">
        <h2 style="margin-top:0;color:#0a2828;">Sign in to Tino</h2>
        <p style="color:#374151;">Click the button below to sign in. The link expires in 1 hour.</p>
        <a href="${url}"
           style="display:inline-block;background:#1BAAC1;color:#0a2828;font-weight:600;
                  padding:12px 24px;border-radius:0;text-decoration:none;margin:16px 0;">
          Sign in
        </a>
        <p style="color:#6b7280;font-size:13px;">
          Or copy this link into your browser:<br/>
          <a href="${url}" style="color:#1BAAC1;word-break:break-all;">${url}</a>
        </p>
        <p style="color:#9ca3af;font-size:12px;margin-top:32px;">
          If you did not request this email, you can safely ignore it.
        </p>
      </div>
    `,
    text: `Sign in to Tino\n\nClick this link to sign in (expires in 1 hour):\n${url}\n\nIf you did not request this, ignore this email.`,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend delivery failed (HTTP ${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Email provider — magic link
// ---------------------------------------------------------------------------

const ResendMagicLink = Email({
  // Setting authorize to undefined enables true magic-link behaviour:
  // the token alone is sufficient; the email address is not re-checked
  // on verification. This lets the ?code= link work without carrying
  // the original email address in the URL.
  authorize: undefined,
  sendVerificationRequest: async ({ identifier: email, url }) => {
    await sendMagicLinkEmail(email, url);
  },
});

// ---------------------------------------------------------------------------
// convexAuth export
// ---------------------------------------------------------------------------

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendMagicLink],
  callbacks: {
    /**
     * Called every time a user authenticates.
     * On first sign-in: creates the users row with defaults.
     * On subsequent sign-ins: returns the existing user ID unchanged.
     */
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId !== null) {
        // Returning user — nothing to update for now
        return args.existingUserId;
      }

      // New user — insert with required defaults
      return await ctx.db.insert("users", {
        email:
          typeof args.profile.email === "string"
            ? args.profile.email
            : undefined,
        plan: "free",
        payPerCvCredits: 0,
        createdAt: Date.now(),
      });
    },
  },
});
