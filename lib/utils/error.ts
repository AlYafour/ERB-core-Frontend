export function getApiError(error: unknown, fallback = 'An error occurred'): string {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as Record<string, unknown>;
  const data = (e.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  if (data) {
    if (typeof data.error === 'string' && data.error) return data.error;
    if (typeof data.detail === 'string' && data.detail) return data.detail;
    if (typeof data.message === 'string' && data.message) return data.message;
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) return String(data.non_field_errors[0]);
    // DRF field-level errors: { field: ["msg1", ...], ... }
    const fieldErrors = Object.entries(data)
      .filter(([, v]) => Array.isArray(v) && (v as unknown[]).length > 0)
      .map(([k, v]) => `${k}: ${(v as unknown[])[0]}`);
    if (fieldErrors.length > 0) return fieldErrors.join(' | ');
  }
  if (typeof e.message === 'string' && e.message) return e.message;
  return fallback;
}
