/**
 * htmlUtils.ts — shared HTML-escaping helper.
 *
 * Used by email templates in auth.ts and alerts.ts to prevent XSS when
 * user-controlled strings (names, emails) are interpolated into HTML bodies.
 */

/**
 * Escapes the five characters that have special meaning in HTML.
 * Safe to call on any user-supplied string before embedding in HTML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
