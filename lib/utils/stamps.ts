import type { User } from '@/types';

/**
 * Returns the stamp URL for a user object fetched from the API.
 * The stamp_url field is uploaded per-user via /api/auth/me/ PATCH with a `stamp` file.
 */
export function resolveStamp(user: User | null | undefined): string | null {
  return user?.stamp_url || null;
}

/** @deprecated Use resolveStamp(userObject) — no longer a static map */
export const USER_STAMPS: Record<string, string> = {};
