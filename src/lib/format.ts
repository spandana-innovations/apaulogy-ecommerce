/** Format a paise integer as an INR price string, e.g. 650000 -> "₹6,500". */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  const hasFraction = rupees % 1 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** Convert rupees (float/string) to integer paise. */
export function toPaise(rupees: number | string): number {
  return Math.round(parseFloat(String(rupees)) * 100);
}

/** Format a paise range, e.g. (135000, 210000) -> "₹1,350 – ₹2,100". */
export function formatINRRange(minPaise: number, maxPaise: number): string {
  return `${formatINR(minPaise)} – ${formatINR(maxPaise)}`;
}

/** Human "member since" duration from an ISO date to now: "2y 3m 5d". */
export function since(iso?: string): string {
  if (!iso) return '—';
  const start = new Date((iso || '').replace(' ', 'T'));
  if (isNaN(start.getTime())) return '—';
  const now = new Date();
  let y = now.getFullYear() - start.getFullYear();
  let m = now.getMonth() - start.getMonth();
  let d = now.getDate() - start.getDate();
  if (d < 0) { m -= 1; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (m < 0) { y -= 1; m += 12; }
  const parts = [] as string[];
  if (y) parts.push(`${y}y`); if (m) parts.push(`${m}m`); parts.push(`${d}d`);
  return parts.join(' ');
}
