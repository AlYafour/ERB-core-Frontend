export function getApiError(error: unknown, fallback = 'An error occurred'): string {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as Record<string, unknown>;
  const data = (e.response as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  if (data) {
    if (typeof data.error === 'string' && data.error) return data.error;
    if (typeof data.detail === 'string' && data.detail) return data.detail;
    if (typeof data.message === 'string' && data.message) return data.message;
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) return String(data.non_field_errors[0]);
    // DRF field-level errors — flat: { field: ["msg"] }
    // or nested item errors: { items: [{ field: ["msg"] }, ...] }
    const fieldErrors: string[] = [];
    for (const [k, v] of Object.entries(data)) {
      if (!Array.isArray(v) || v.length === 0) continue;
      const first = v[0];
      if (typeof first === 'string') {
        fieldErrors.push(`${k}: ${first}`);
      } else if (typeof first === 'object' && first !== null) {
        // Nested: items[0].quantity → "items[0].quantity: msg"
        for (const [nk, nv] of Object.entries(first as Record<string, unknown>)) {
          const msg = Array.isArray(nv) ? nv[0] : nv;
          fieldErrors.push(`${k}[0].${nk}: ${String(msg)}`);
        }
      }
    }
    if (fieldErrors.length > 0) return fieldErrors.join(' | ');
  }
  if (typeof e.message === 'string' && e.message) return e.message;
  return fallback;
}
