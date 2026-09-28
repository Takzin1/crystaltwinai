import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_INPUT } from "../config/parameters";
import { runSimulation } from "./engine";

test("runSimulation is deterministic for identical inputs", () => {
  const a = runSimulation({ ...DEFAULT_INPUT });
  const b = runSimulation({ ...DEFAULT_INPUT });
  assert.deepEqual(a, b);
});

test("runSimulation preserves basic numerical invariants", () => {
  const result = runSimulation({ ...DEFAULT_INPUT });

  assert.equal(result.series.length, Math.max(1, Math.round(DEFAULT_INPUT.timeSteps)));

  let previousYield = 0;
  for (const point of result.series) {
    for (const value of [
      point.temperature,
      point.concentration,
      point.supersaturation,
      point.growthRate,
      point.crystalYield,
      point.stability,
      point.quality,
    ]) {
      assert.equal(Number.isFinite(value), true);
    }

    assert.ok(point.concentration >= 0);
    assert.ok(point.crystalYield >= 0 && point.crystalYield <= 100);
    assert.ok(point.stability >= 0 && point.stability <= 100);
    assert.ok(point.quality >= 0 && point.quality <= 100);
    assert.ok(point.crystalYield >= previousYield);
    previousYield = point.crystalYield;
  }
});

test("unstable conditions remain bounded and return an explicit risk assessment", () => {
  const result = runSimulation({
    ...DEFAULT_INPUT,
    temperature: 80,
    concentration: 0.55,
    coolingRate: 1.8,
    stirringSpeed: 900,
    impurityLevel: 3.5,
    timeSteps: 80,
  });

  assert.ok(["low", "medium", "high"].includes(result.summary.risk.level));
  assert.ok(result.summary.risk.reasons.length >= 1);
  assert.equal(Number.isFinite(result.summary.finalYield), true);
});
