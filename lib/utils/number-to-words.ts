/**
 * Convert a numeric amount to English words in UAE Dirham format.
 * Used on LPO and Invoice print pages.
 */
export function toWords(n: number): string {
  if (!n || isNaN(n) || n <= 0) return 'Zero Dirhams Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function h(x: number): string {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
    return ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' and ' + h(x % 100) : '');
  }

  const d = Math.floor(n);
  const f = Math.round((n - d) * 100);
  let r = '';
  if (d >= 1_000_000) r += h(Math.floor(d / 1_000_000)) + ' Million ';
  if (d >= 1_000)     r += h(Math.floor((d % 1_000_000) / 1_000)) + ' Thousand ';
  r += h(d % 1_000);
  r = r.trim() + ' Dirhams';
  if (f > 0) r += ` and ${h(f)} Fils`;
  return r + ' Only';
}
