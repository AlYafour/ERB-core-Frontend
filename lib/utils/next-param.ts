/**
 * Post-login destination handling.
 *
 * The middleware appends ?next=<original path> when it bounces an
 * unauthenticated request to a login page; login pages send the user back
 * there instead of hardcoding /dashboard — a hard refresh never loses the
 * user's place.
 */

/** Only same-origin absolute paths are allowed (open-redirect guard). */
export function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/** Read the validated ?next= param from the current URL (client only). */
export function getNextParam(): string | null {
  if (typeof window === 'undefined') return null;
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}
