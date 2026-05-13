export function getApiError(error: unknown, fallback = 'An error occurred'): string {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as Record<string, unknown>;
  const data = (e.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  if (data) {
    if (Array.isArray(data.password) && data.password.length > 0) return String(data.password[0]);
    if (typeof data.error === 'string' && data.error) return data.error;
    if (typeof data.detail === 'string' && data.detail) return data.detail;
    if (typeof data.message === 'string' && data.message) return data.message;
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) return String(data.non_field_errors[0]);
  }
  if (typeof e.message === 'string' && e.message) return e.message;
  return fallback;
}
