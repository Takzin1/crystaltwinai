/**
 * Cross-runtime deterministic exp / log / pow.
 *
 * Math.exp, Math.log and Math.pow are implementation-approximated in
 * ECMAScript, and differ by an ULP between JS engines (observed: Math.log(3)
 * in Node 22 vs Chromium 153). That breaks byte-exact replay of a simulation
 * computed on the server and re-checked in a browser. These versions use only
 * + − × ÷ and comparisons, which ECMAScript requires to be correctly rounded
 * IEEE-754 double operations, so every compliant runtime returns identical
 * bits. Accuracy is within a few ULP of Math.* (tests/portable-math.test.ts).
 */

const LN2_HI = 6.93147180369123816490e-1; // high bits of ln 2 (exact in few bits)
const LN2_LO = 1.90821492927058770002e-10; // ln 2 − LN2_HI
const INV_LN2 = 1.44269504088896338700;

function scale2(value: number, k: number): number {
  // Exact multiplication by 2^k in steps that stay in the normal range.
  let v = value;
  let n = k;
  while (n > 0) {
    const step = n > 1000 ? 1000 : n;
    v *= pow2(step);
    n -= step;
  }
  while (n < 0) {
    const step = n < -1000 ? -1000 : n;
    v *= pow2(step);
    n -= step;
  }
  return v;
}

function pow2(k: number): number {
  let r = 1;
  const base = k >= 0 ? 2 : 0.5;
  for (let i = 0; i < Math.abs(k); i++) r *= base;
  return r;
}

export function pexp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 709.782712893384) return Infinity;
  if (x < -745.1332191019411) return 0;
  if (x === 0) return 1;
  // x = k·ln2 + r, |r| ≤ ln2/2 (Cody–Waite reduction)
  const k = Math.round(x * INV_LN2); // Math.round is exact by spec
  const r = (x - k * LN2_HI) - k * LN2_LO;
  // Taylor series of e^r to degree 18 in Horner form (|r| ≤ 0.3466 → truncation < 1e-19):
  // 1 + r(1 + r/2(1 + r/3(…))), evaluated from the smallest term outwards.
  let p = 1;
  for (let n = 18; n >= 2; n--) p = 1 + (p * r) / n;
  return scale2(1 + r * p, k);
}

export function plog(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  // x = m · 2^e with m in [√½, √2)
  let m = x;
  let e = 0;
  while (m >= 1.4142135623730951) {
    m *= 0.5;
    e += 1;
  }
  while (m < 0.7071067811865476) {
    m *= 2;
    e -= 1;
  }
  // log m = 2·atanh(s), s = (m−1)/(m+1), |s| ≤ 0.1716
  const s = (m - 1) / (m + 1);
  const s2 = s * s;
  let term = s;
  let sum = 0;
  for (let n = 1; n <= 41; n += 2) {
    sum += term / n;
    term *= s2;
  }
  return e * LN2_HI + (e * LN2_LO + 2 * sum);
}

export function ppow(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (Number.isNaN(base) || Number.isNaN(exponent)) return NaN;
  if (base === 0) return exponent > 0 ? 0 : Infinity;
  if (base < 0) {
    if (!Number.isInteger(exponent)) return NaN;
    const magnitude = ppow(-base, exponent);
    return exponent % 2 === 0 ? magnitude : -magnitude;
  }
  if (Number.isInteger(exponent) && Math.abs(exponent) <= 64) {
    // Exact-sequence repeated squaring for small integer powers.
    let result = 1;
    let b = base;
    let n = Math.abs(exponent);
    while (n > 0) {
      if (n % 2 === 1) result *= b;
      b *= b;
      n = Math.floor(n / 2);
    }
    return exponent < 0 ? 1 / result : result;
  }
  return pexp(exponent * plog(base));
}
