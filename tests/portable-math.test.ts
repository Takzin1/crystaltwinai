import assert from "node:assert/strict";
import { test } from "node:test";
import { pexp, plog, ppow } from "../src/lib/portable-math";

function ulps(a: number, b: number): number {
  if (a === b) return 0;
  const buf = new DataView(new ArrayBuffer(16));
  buf.setFloat64(0, a);
  buf.setFloat64(8, b);
  const diff = buf.getBigInt64(0) - buf.getBigInt64(8);
  return Math.abs(Number(diff));
}

// Deterministic pseudo-random sample (no Math.random so failures reproduce).
function* samples(n: number, lo: number, hi: number) {
  let x = 0x9e3779b9;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    yield lo + (hi - lo) * (x / 2147483648);
  }
}

test("pexp is within 4 ULP of Math.exp over the engine's range", () => {
  let worst = 0;
  for (const x of samples(20000, -50, 50)) worst = Math.max(worst, ulps(pexp(x), Math.exp(x)));
  assert.ok(worst <= 4, `worst ${worst} ULP`);
  assert.equal(pexp(0), 1);
  assert.equal(pexp(-Infinity), 0);
  assert.equal(pexp(1000), Infinity);
});

test("plog is within 4 ULP of Math.log", () => {
  let worst = 0;
  for (const x of samples(20000, 1e-6, 1e6)) worst = Math.max(worst, ulps(plog(x), Math.log(x)));
  assert.ok(worst <= 4, `worst ${worst} ULP`);
  assert.equal(plog(1), 0);
  assert.ok(Number.isNaN(plog(-1)));
  assert.equal(plog(0), -Infinity);
});

test("ppow matches Math.pow closely for the engine's (s-1)^order use", () => {
  let worstRel = 0;
  for (const b of samples(5000, 1e-6, 3)) {
    for (const e of [1.5, 1.6, 2, 0.5, 2.3]) {
      const rel = Math.abs(ppow(b, e) - Math.pow(b, e)) / Math.pow(b, e);
      worstRel = Math.max(worstRel, rel);
    }
  }
  assert.ok(worstRel < 1e-14, `worst relative error ${worstRel}`);
  assert.equal(ppow(0, 1.5), 0);
  assert.equal(ppow(2, 10), 1024);
  assert.equal(ppow(-2, 3), -8);
  assert.ok(Number.isNaN(ppow(-2, 0.5)));
});

test("portable functions use a fixed operation sequence (known-answer bits)", () => {
  // Pinned values: any change in the algorithm must be deliberate.
  assert.equal(plog(3), 1.0986122886681098);
  assert.equal(pexp(-0.5), 0.6065306597126334);
  assert.equal(ppow(0.3471, 1.5), 0.20449463589786412);
});
