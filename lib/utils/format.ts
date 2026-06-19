/**
 * Format a date string to a readable locale string.
 * Accepts "YYYY-MM-DD" or full ISO strings. Returns "—" for empty/null.
 */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const iso = d.includes('T') ? d : `${d}T00:00:00`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Format number with thousand separators and decimal places
 */
export function formatNumber(value: number | string | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || value === '') {
    return '0.00';
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return '0.00';
  }
  
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format price with AED symbol
 */
export function formatPrice(value: number | string | null | undefined, decimals: number = 2): string {
  return `${formatNumber(value, decimals)} AED`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | string | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || value === '') {
    return '0%';
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    return '0%';
  }
  
  return `${num.toFixed(decimals)}%`;
}

