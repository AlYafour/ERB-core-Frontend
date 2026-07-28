/**
 * Shared HR utilities used across payroll, loans, leave, and attendance pages.
 */

export const MONTH_NAMES = [
  '',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format decimal hours as "Xh Ym" — never a bare decimal. The fractional part
 * is a fraction of an hour, so 7.93h → "7h 56m" (0.93 × 60 = 56 min), not "7.93".
 * This is the single formatter for every attendance / work-hours display.
 *   - null / undefined  → the given `dash` (default "—")
 *   - exactly 0         → "0h" when `keepZero`, else `dash`
 *   - whole hours       → "8h"
 *   - sub-hour          → "45m"
 * Rounding to whole minutes can roll 59.6m → 60m; we carry it into the hour.
 */
export function formatHoursMinutes(
  value: string | number | null | undefined,
  { dash = '—', keepZero = false }: { dash?: string; keepZero?: boolean } = {},
): string {
  if (value == null || value === '') return dash;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return dash;
  if (num === 0) return keepZero ? '0h' : dash;

  const sign = num < 0 ? '-' : '';
  let totalMins = Math.round(Math.abs(num) * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hrs === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${hrs}h`;
  return `${sign}${hrs}h ${mins}m`;
}
