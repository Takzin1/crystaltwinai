/**
 * Fixed-seed, property-style verification of the educational time-step engine.
 * These are implementation invariants, NOT experimental physical validation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PARAMETERS, DEFAULT_INPUT } from "../src/config/parameters";
import { SCENARIOS } from "../src/config/scenarios";
import { SCORING_CONFIG as C } from "../src/config/scoring.config";
import { runSimulation } from "../src/lib/engine";
import type { SimulationInput } from "../src/lib/types";

function randomInputs(seed: number, count: number): SimulationInput[] {
  let state = seed >>> 0;
  const unit = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return Array.from({ length: count }, () =>
    Object.fromEntries(PARAMETERS.map(param => {
      if (param.id === "timeSteps") {
        return [param.id, Math.floor(param.min + unit() * (param.max - param.min + 1))];
      }
      return [param.id, param.min + unit() * (param.max - param.min)];
    })) as SimulationInput,
  );
}

function close(actual: number, expected: number, label: string) {
  assert.ok(Number.isFinite(actual), label + " must be finite");
  assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)),
    label + ": " + actual + " !== " + expected);
}

function assertInvariants(input: SimulationInput) {
  const original = structuredClone(input);
  const output = runSimulation(input);
  assert.deepEqual(input, original, "The engine must not change caller inputs");
  assert.deepEqual(output, runSimulation({ ...input }), "Runs must be deterministic");
  assert.equal(output.series.length, input.timeSteps);
  assert.deepEqual(output.input, input);
  assert.ok(output.log.length >= 2);
  const numeric = [
    output.summary.avgGrowthRate, output.summary.stabilityScore,
    output.summary.qualityScore, output.summary.finalYield,
    output.summary.maxSupersaturation, output.summary.nucleationEvents,
  ];
  assert.ok(numeric.every(Number.isFinite), "Summary values must be finite");
  assert.ok(["low", "medium", "high"].includes(output.summary.risk.level));
  assert.ok(Number.isInteger(output.summary.nucleationEvents));
  assert.ok(output.summary.nucleationEvents >= 0);
  assert.ok(output.summary.nucleationEvents <= input.timeSteps);

  let previousTemperature = input.temperature;
  let previousConcentration = input.concentration;
  let previousYield = 0;
  let growthSum = 0;
  let maxSupersaturation = 0;
  for (const [index, row] of output.series.entries()) {
    assert.equal(row.step, index + 1);
    const state = [
      row.temperature, row.concentration, row.supersaturation,
      row.growthRate, row.crystalYield, row.stability, row.quality,
    ];
    assert.ok(state.every(Number.isFinite), "Nonfinite trajectory at step " + (index + 1));
    close(row.temperature,
      Math.max(C.minTemperature, previousTemperature - input.coolingRate * C.dtMinutes),
      "Cooling schedule");
    assert.ok(row.temperature <= previousTemperature + 1e-10);
    assert.ok(row.concentration >= 0 && row.concentration <= previousConcentration + 1e-10);
    assert.ok(row.growthRate >= 0);
    assert.ok(row.supersaturation >= 0);
    assert.ok(row.crystalYield >= previousYield - 1e-10 && row.crystalYield <= 100);
    assert.ok(row.quality >= 0 && row.quality <= 100);
    assert.ok(row.stability >= 0 && row.stability <= 100);
    growthSum += row.growthRate;
    maxSupersaturation = Math.max(maxSupersaturation, row.supersaturation);
    previousTemperature = row.temperature;
    previousConcentration = row.concentration;
    previousYield = row.crystalYield;
  }
  close(output.summary.avgGrowthRate, growthSum / output.series.length, "Mean growth");
  close(output.summary.finalYield, previousYield, "Final yield");
  close(output.summary.maxSupersaturation, maxSupersaturation, "Maximum supersaturation");
  for (const score of [output.summary.qualityScore, output.summary.stabilityScore]) {
    assert.ok(score >= 0 && score <= 100);
  }
}

test("bundled scenarios and parameter extrema satisfy engine invariants", () => {
  for (const scenario of SCENARIOS) assertInvariants({ ...scenario.input });
  assertInvariants({ ...DEFAULT_INPUT });
  assertInvariants(Object.fromEntries(PARAMETERS.map(p => [p.id, p.min])) as SimulationInput);
  assertInvariants(Object.fromEntries(PARAMETERS.map(p => [p.id, p.max])) as SimulationInput);
});

test("256 seeded, varied runs satisfy numerical and provenance invariants", () => {
  for (const input of randomInputs(0x51A5EED, 256)) assertInvariants(input);
});

test("every input rejects missing, NaN, Infinity and out-of-bound values", () => {
  for (const param of PARAMETERS) {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      param.min - 1, param.max + 1, null, "0"]) {
      const input = { ...DEFAULT_INPUT, [param.id]: value };
      assert.throws(() => runSimulation(input as SimulationInput),
        param.id + " accepted " + String(value));
    }
    const missing = { ...DEFAULT_INPUT } as Partial<SimulationInput>;
    delete missing[param.id];
    assert.throws(() => runSimulation(missing as SimulationInput),
      param.id + " accepted omission");
  }
  assert.throws(() => runSimulation({ ...DEFAULT_INPUT, timeSteps: 10.5 }), /integer/);
  assert.throws(() => runSimulation(null as unknown as SimulationInput), /object/);
  assert.throws(() => runSimulation([] as unknown as SimulationInput), /object/);
});

test("metamorphic: extending a run cannot change its earlier states", () => {
  for (const example of [DEFAULT_INPUT, ...SCENARIOS.map(s => s.input)]) {
    const short = runSimulation({ ...example, timeSteps: 20 });
    const long = runSimulation({ ...example, timeSteps: 90 });
    assert.deepEqual(short.series, long.series.slice(0, 20));
  }
});
