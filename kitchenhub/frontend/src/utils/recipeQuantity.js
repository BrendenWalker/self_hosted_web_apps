/**
 * Format a numeric quantity for recipe display: mixed fractions using
 * common denominators (halves, thirds, quarters, eighths, sixteenths).
 */
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export function formatRecipeQuantity(qty) {
  if (qty == null || qty === '') return '';
  const n = Number(qty);
  if (Number.isNaN(n)) return String(qty);

  const eps = 1e-7;
  const matchTol = 0.021;

  if (Math.abs(n) < eps) return '0';

  const negative = n < 0;
  const prefix = negative ? '-' : '';
  const abs = Math.abs(n);

  if (Math.abs(abs - Math.round(abs)) < matchTol) {
    return prefix + String(Math.round(abs));
  }

  let whole = Math.floor(abs + eps);
  let frac = abs - whole;

  if (frac > 1 - matchTol) {
    whole += 1;
    frac = 0;
  }

  if (frac < matchTol) {
    return prefix + String(whole);
  }

  const denoms = [2, 3, 4, 8, 16];
  let bestNum = 1;
  let bestDen = 8;
  let bestErr = Infinity;
  for (const den of denoms) {
    for (let num = 1; num < den; num++) {
      const err = Math.abs(num / den - frac);
      if (err < bestErr) {
        bestErr = err;
        bestNum = num;
        bestDen = den;
      }
    }
  }

  if (bestErr > 0.045) {
    const s = abs.toFixed(4).replace(/\.?0+$/, '');
    return prefix + s;
  }

  const g = gcd(bestNum, bestDen);
  bestNum /= g;
  bestDen /= g;

  const fracPart = `${bestNum}/${bestDen}`;
  if (whole === 0) return prefix + fracPart;
  return `${prefix}${whole} ${fracPart}`;
}
