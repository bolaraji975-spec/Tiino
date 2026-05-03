/**
 * alerts.ts
 *
 * Admin alert helpers for the sponsor refresh pipeline.
 * All functions are designed to be called from Convex actions (never mutations).
 *
 * Alerts are sent via the Resend API using a direct fetch() call — no extra
 * package required. If RESEND_API_KEY is not set, alert calls are a no-op so
 * the main operation is never blocked by a missing key.
 */

// ---------------------------------------------------------------------------
// Pure logic (testable without Convex or Resend)
// ---------------------------------------------------------------------------

/**
 * Returns true when the active-sponsor count has dropped by more than
 * `threshold` (default 20%) compared to the previous snapshot.
 *
 * Guards against division-by-zero when previousActiveCount is 0.
 */
export function shouldAlertOnDrop(
  previousActiveCount: number,
  currentActiveCount: number,
  threshold = 0.20,
): boolean {
  if (previousActiveCount === 0) return false;
  const dropFraction =
    (previousActiveCount - currentActiveCount) / previousActiveCount;
  return dropFraction > threshold;
}

// ---------------------------------------------------------------------------
// Resend API integration
// ---------------------------------------------------------------------------

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Send a plain-text admin alert via Resend.
 *
 * Uses EMAIL_FROM_TRANSACTIONAL as both the "from" and "to" address (self-alert
 * pattern — the admin inbox is the same as the transactional sender for MVP).
 *
 * Silently no-ops if RESEND_API_KEY is not configured so a missing key never
 * causes the refresh action to fail.
 */
async function sendAdminAlert(subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const from =
    process.env.EMAIL_FROM_TRANSACTIONAL ?? "hello@tiino.app";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [from],
      subject,
      html: `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(body)}</pre>`,
    }),
  });

  if (!res.ok) {
    // Alert delivery failure should not propagate — log and continue.
    const text = await res.text().catch(() => "(unreadable)");
    console.error(`[alerts] Resend error ${res.status}: ${text}`);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// Named alert senders
// ---------------------------------------------------------------------------

/**
 * Alert the admin that the sponsor register refresh failed entirely.
 */
export async function sendRefreshFailureAlert(
  errorMessage: string,
): Promise<void> {
  await sendAdminAlert(
    "[Tino] Sponsor register refresh FAILED",
    [
      "The weekly sponsor register refresh failed and no new data was loaded.",
      "",
      "Error:",
      errorMessage,
      "",
      "Check the Convex logs for the full stack trace.",
      "Manual action may be required if this persists next Monday.",
    ].join("\n"),
  );
}

/**
 * Alert the admin that the active-sponsor count dropped by more than 20%.
 * Include the raw numbers so the recipient can judge severity at a glance.
 */
export async function sendDropAlert(
  previousCount: number,
  currentCount: number,
): Promise<void> {
  const removed = previousCount - currentCount;
  const dropPercent = ((removed / previousCount) * 100).toFixed(1);

  await sendAdminAlert(
    `[Tino] Sponsor count dropped ${dropPercent}% — check required`,
    [
      `Active sponsor count dropped by more than 20% since the last refresh.`,
      "",
      `Previous : ${previousCount.toLocaleString("en-GB")}`,
      `Current  : ${currentCount.toLocaleString("en-GB")}`,
      `Removed  : ${removed.toLocaleString("en-GB")} (${dropPercent}%)`,
      "",
      "Possible causes:",
      "  • Home Office published a revised/corrected register",
      "  • The CSV format changed and rows are being skipped",
      "  • A bug in the deactivation logic",
      "",
      "Review the Convex dashboard and compare against the raw CSV before",
      "taking any action on the sponsors table.",
    ].join("\n"),
  );
}
