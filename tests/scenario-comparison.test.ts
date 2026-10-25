import assert from "node:assert/strict";
import test from "node:test";
import { runSimulation } from "../src/lib/engine";
import { DEFAULT_INPUT } from "../src/config/parameters";
import { compareEducationalRuns, sameInput } from "../src/lib/scenario-comparison";

test("same inputs show no differences, without altering either simulation", () => {
  const baseline = runSimulation({ ...DEFAULT_INPUT });
  const current = runSimulation({ ...DEFAULT_INPUT });
  const original = { ...baseline.input };
  const comparison = compareEducationalRuns(baseline, current);
  assert.equal(comparison.changedParameters.length, 0);
  assert.ok(comparison.metrics.every(item => item.delta === 0));
  assert.deepEqual(baseline.input, original);
  assert.ok(sameInput(baseline.input, current.input));
});

test("changing a parameter shows signed numerical deltas and restores baseline inputs", () => {
  const before = runSimulation({ ...DEFAULT_INPUT });
  const after = runSimulation({ ...DEFAULT_INPUT, coolingRate: 1.4 });
  const comparison = compareEducationalRuns(before, after);
  assert.deepEqual(comparison.changedParameters, ["coolingRate"]);
  assert.equal(comparison.metrics.length, 4);
  assert.ok(comparison.metrics.every(item =>
    Number.isFinite(item.delta) && item.delta === item.after - item.before,
  ));
  assert.equal(sameInput(before.input, after.input), false);
  assert.ok(sameInput({ ...before.input }, before.input));
});
