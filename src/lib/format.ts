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
