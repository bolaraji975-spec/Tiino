/**
 * auth.ts
 *
 * Convex Auth configuration for Tino.
 *
 * Providers:
 *   1. Email magic link — delivered via Resend
 *   2. Google OAuth     — requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
 *   3. Password         — email + password with email verification and password reset
 *
 * Required Convex env vars (npx convex env set):
 *   RESEND_API_KEY
 *   EMAIL_FROM_TRANSACTIONAL   e.g. hello@tiino.app
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   CONVEX_SITE_URL            set automatically on deploy; set manually for local dev
 *   SITE_URL                   frontend base URL (e.g. https://tiino.app)
 */

import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { validatePasswordRequirements } from "./lib/validatePassword";
import { escapeHtml } from "./lib/htmlUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SITE_URL = () => process.env.SITE_URL ?? "http://localhost:3000";

/** Extract the ?code= from a Convex callback URL and build a custom frontend URL. */
function frontendUrl(convexCallbackUrl: string, path: string): string {
  let code = "";
  try {
    code = new URL(convexCallbackUrl).searchParams.get("code") ?? "";
  } catch {
    // malformed URL — proceed with empty code
  }
  return `${SITE_URL()}${path}?code=${encodeURIComponent(code)}`;
}

async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[auth] email to ${to} (${subject}) — no RESEND_API_KEY, skipping send`);
    return;
  }

  const from = process.env.EMAIL_FROM_TRANSACTIONAL ?? "hello@tiino.app";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend delivery failed (HTTP ${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Email HTML templates
// ---------------------------------------------------------------------------

function emailShell(content: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;background:#021e1e;color:#e5e7eb;">
      <div style="margin-bottom:24px;">
        <span style="font-family:monospace;font-size:18px;font-weight:700;color:#1BAAC1;letter-spacing:1px;">TINO</span>
      </div>
      ${content}
      <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #1a3a3a;padding-top:16px;">
        If you did not request this email, you can safely ignore it.
      </p>
    </div>
  `;
}

function magicLinkHtml(url: string): string {
  return emailShell(`
    <h2 style="margin-top:0;color:#f9fafb;font-size:20px;">Sign in to Tino</h2>
    <p style="color:#9ca3af;line-height:1.6;">Click the button below to sign in. This link expires in 1 hour.</p>
    <a href="${url}"
       style="display:inline-block;background:#1BAAC1;color:#0a2828;font-weight:700;
              padding:12px 28px;text-decoration:none;margin:16px 0;font-size:15px;">
      Sign in
    </a>
    <p style="color:#6b7280;font-size:13px;margin-top:8px;">
      Or copy this link into your browser:<br/>
      <a href="${url}" style="color:#1BAAC1;word-break:break-all;">${url}</a>
    </p>
  `);
}

function verifyEmailHtml(url: string, email: string): string {
  return emailShell(`
    <h2 style="margin-top:0;color:#f9fafb;font-size:20px;">Verify your email address</h2>
    <p style="color:#9ca3af;line-height:1.6;">
      You signed up for Tino with <strong style="color:#e5e7eb;">${escapeHtml(email)}</strong>.
      Click the button below to verify your email address.
    </p>
    <a href="${url}"
       style="display:inline-block;background:#1BAAC1;color:#0a2828;font-weight:700;
              padding:12px 28px;text-decoration:none;margin:16px 0;font-size:15px;">
      Verify email address
    </a>
    <p style="color:#6b7280;font-size:13px;margin-top:8px;">
      Or copy this link into your browser:<br/>
      <a href="${url}" style="color:#1BAAC1;word-break:break-all;">${url}</a>
    </p>
  `);
}

function resetPasswordHtml(url: string): string {
  return emailShell(`
    <h2 style="margin-top:0;color:#f9fafb;font-size:20px;">Reset your password</h2>
    <p style="color:#9ca3af;line-height:1.6;">
      We received a request to reset your Tino password.
      Click the button below to choose a new password. This link expires in 1 hour.
    </p>
    <a href="${url}"
       style="display:inline-block;background:#1BAAC1;color:#0a2828;font-weight:700;
              padding:12px 28px;text-decoration:none;margin:16px 0;font-size:15px;">
      Reset password
    </a>
    <p style="color:#6b7280;font-size:13px;margin-top:8px;">
      Or copy this link into your browser:<br/>
      <a href="${url}" style="color:#1BAAC1;word-break:break-all;">${url}</a>
    </p>
  `);
}

// ---------------------------------------------------------------------------
// Email provider — magic link
// ---------------------------------------------------------------------------

const ResendMagicLink = Email({
  authorize: undefined,
  sendVerificationRequest: async ({ identifier: email, url }) => {
    await sendResendEmail(
      email,
      "Sign in to Tino",
      magicLinkHtml(url),
      `Sign in to Tino\n\nClick this link (expires in 1 hour):\n${url}`,
    );
  },
});

// ---------------------------------------------------------------------------
// Email provider — email verification (used by Password provider)
// ---------------------------------------------------------------------------

const EmailVerification = Email({
  id: "email-verification",
  sendVerificationRequest: async ({ identifier: email, url }) => {
    const verifyUrl = frontendUrl(url, "/verify-email");
    await sendResendEmail(
      email,
      "Verify your Tino email address",
      verifyEmailHtml(verifyUrl, email),
      `Verify your Tino email address\n\nClick this link to verify:\n${verifyUrl}`,
    );
  },
});

// ---------------------------------------------------------------------------
// Email provider — password reset (used by Password provider)
// ---------------------------------------------------------------------------

const PasswordReset = Email({
  id: "password-reset",
  sendVerificationRequest: async ({ identifier: email, url }) => {
    const resetUrl = frontendUrl(url, "/reset-password");
    await sendResendEmail(
      email,
      "Reset your Tino password",
      resetPasswordHtml(resetUrl),
      `Reset your Tino password\n\nClick this link (expires in 1 hour):\n${resetUrl}`,
    );
  },
});

// ---------------------------------------------------------------------------
// Password provider
// ---------------------------------------------------------------------------

const PasswordProvider = Password({
  validatePasswordRequirements,
  reset: PasswordReset,
  verify: EmailVerification,
});

// ---------------------------------------------------------------------------
// Google OAuth provider
// ---------------------------------------------------------------------------

const GoogleOAuth = Google({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

// ---------------------------------------------------------------------------
// convexAuth export
// ---------------------------------------------------------------------------

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ResendMagicLink, GoogleOAuth, PasswordProvider],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId !== null) {
        return args.existingUserId;
      }

      const profile = args.profile;

      return await ctx.db.insert("users", {
        email:
          typeof profile.email === "string" ? profile.email : undefined,
        name:
          typeof profile.name === "string" ? profile.name : undefined,
        image:
          typeof profile.image === "string"
            ? profile.image
            : typeof (profile as Record<string, unknown>).picture === "string"
              ? (profile as Record<string, unknown>).picture as string
              : undefined,
        plan: "free",
        payPerCvCredits: 0,
        createdAt: Date.now(),
      });
    },
  },
});
