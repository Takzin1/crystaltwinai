import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_INPUT, PARAMETERS } from "../src/config/parameters";
import { SCENARIOS } from "../src/config/scenarios";
import { runSimulation } from "../src/lib/engine";
import {
  runAlternativeReference, compareAlternativeModel, runInputSensitivity,
} from "../src/lib/verification-models";
import {
  quantile, residualDiagnostics, blockBootstrapBias,
} from "../src/lib/verification-statistics";

test("analytical residual metrics have exact known answers and signed convention", () => {
  const d = residualDiagnostics([1, -1, 2, -2]);
  assert.equal(d.n, 4);
  assert.equal(d.bias, 0);
  assert.equal(d.mae, 1.5);
  assert.ok(Math.abs(d.rmse - Math.sqrt(2.5)) < 1e-12);
  assert.equal(d.maxAbs, 2);
  assert.equal(quantile([9, 3, 1, 7, 5], 0.5), 5);
  assert.equal(quantile([1, 3, 5], 0.25), 2);
  assert.equal(quantile([4, 4, 4], 0.95), 4);
});

test("circular moving-block bias interval is reproducible and truthful on constants", () => {
  const zeros = blockBootstrapBias(Array(16).fill(0));
  assert.ok(zeros);
  assert.equal(zeros.lower, 0);
  assert.equal(zeros.upper, 0);
  const constants = blockBootstrapBias(Array(16).fill(3));
  assert.ok(constants);
  assert.ok(Math.abs(constants.lower - 3) < 1e-12);
  assert.ok(Math.abs(constants.upper - 3) < 1e-12);
  const signal = Array.from({ length: 30 }, (_, i) => Math.cos(i / 3));
  assert.deepEqual(blockBootstrapBias(signal), blockBootstrapBias([...signal]));
  assert.equal(blockBootstrapBias(signal.slice(0, 7)), null);
  assert.equal(blockBootstrapBias(signal, 400)?.draws, 400);
  assert.equal(blockBootstrapBias(signal)?.confidenceLabel,
    "descriptive_95pct_block_resampling_not_measurement_uncertainty");
});

test("adversarial numerical and bootstrap input is rejected before calculation", () => {
  for (const bad of [[], [1, Number.NaN], [Number.POSITIVE_INFINITY], [1, Number.NEGATIVE_INFINITY]]) {
    assert.throws(() => residualDiagnostics(bad));
  }
  assert.throws(() => residualDiagnostics(Array(10001).fill(1)), /10000/);
  assert.throws(() => quantile([], 0.5));
  assert.throws(() => quantile([1], -0.1));
  assert.throws(() => quantile([1, NaN], 0.7));
  assert.throws(() => blockBootstrapBias(Array(201).fill(1)));
  assert.throws(() => blockBootstrapBias(Array(10).fill(Infinity)));
  assert.throws(() => blockBootstrapBias(Array(10).fill(0), 0));
  assert.throws(() => blockBootstrapBias(Array(10).fill(0), 2001));
  assert.throws(() => blockBootstrapBias(Array(10).fill(0), 400, -1));
});

test("independent model obeys monotone solute and shared analytic cooling, without altering inputs", () => {
  for (const scenario of SCENARIOS) {
    const input = { ...scenario.input };
    const original = { ...input };
    const points = runAlternativeReference(input);
    assert.deepEqual(input, original);
    assert.equal(points.length, input.timeSteps);
    let priorConcentration = input.concentration;
    for (const [index, p] of points.entries()) {
      assert.equal(p.step, index + 1);
      assert.ok(Math.abs(p.temperature -
        Math.max(15, input.temperature - (index + 1) * input.coolingRate)) < 1e-12);
      assert.ok(p.concentration >= 0 && p.concentration <= priorConcentration);
      assert.ok(Number.isFinite(p.concentration));
      priorConcentration = p.concentration;
    }
    const primary = runSimulation(input);
    const comparison = compareAlternativeModel(primary);
    assert.equal(comparison.isPhysicalValidation, false);
    assert.deepEqual(comparison.fields.map(f => f.field), ["temperature", "concentration"]);
    assert.ok(comparison.fields.every(f => f.n === input.timeSteps && f.rmse >= 0));
    assert.ok(comparison.fields[0].maxAbs < 1e-9); // shared cooling schedule oracle
  }
});

test("different kinetic assumption produces detectable concentration disagreement", () => {
  const result = runSimulation({ ...SCENARIOS.find(s => s.id === "unstable")!.input });
  const comparison = compareAlternativeModel(result);
  assert.ok(comparison.fields[1].rmse > 1e-5);
  assert.ok(comparison.fields[1].maxAbs >= comparison.fields[1].mae);
  assert.throws(() => compareAlternativeModel({
    ...result, series: result.series.slice(1),
  }), /identical step counts/);
  const corrupted = structuredClone(result);
  corrupted.series[0].step = 99;
  assert.throws(() => compareAlternativeModel(corrupted), /contiguous/);
  const invalid = structuredClone(result);
  invalid.series[1].concentration = NaN;
  assert.throws(() => compareAlternativeModel(invalid), /finite/);
});

test("sensitivity is seeded, bounded, finite and zero perturbation is exactly baseline", () => {
  for (const scenario of SCENARIOS) {
    const baseline = runSimulation({ ...scenario.input });
    const study = runInputSensitivity(baseline, 0.05, 32, 123456);
    assert.deepEqual(study, runInputSensitivity(baseline, 0.05, 32, 123456));
    assert.equal(study.count, 32);
    assert.equal(study.bands.length, 3);
    assert.equal(study.kind, "bounded_uniform_input_sensitivity_not_statistical_confidence");
    for (const b of study.bands) {
      assert.ok([b.minimum,b.p05,b.median,b.p95,b.maximum,b.baseline].every(Number.isFinite));
      assert.ok(b.minimum <= b.p05 + 1e-10);
      assert.ok(b.p05 <= b.median + 1e-10);
      assert.ok(b.median <= b.p95 + 1e-10);
      assert.ok(b.p95 <= b.maximum + 1e-10);
      assert.ok(b.minimum >= 0 && b.maximum <= 100);
    }
    const zero = runInputSensitivity(baseline, 0, 16);
    assert.ok(zero.bands.every(b => Math.abs(b.p95 - b.baseline) < 1e-12 &&
      Math.abs(b.p05 - b.baseline) < 1e-12));
  }
});

test("sensitivity adversaries: unsupported ranges, seeds, simulations and counts", () => {
  const sim = runSimulation(DEFAULT_INPUT);
  for (const spread of [-0.1, 0.21, NaN, Infinity]) {
    assert.throws(() => runInputSensitivity(sim, spread));
  }
  for (const count of [0, 15, 257, 16.2, Infinity]) {
    assert.throws(() => runInputSensitivity(sim, 0.05, count));
  }
  for (const seed of [-1, 2 ** 32, 3.7]) {
    assert.throws(() => runInputSensitivity(sim, 0.05, 16, seed));
  }
  const invalid = structuredClone(sim);
  invalid.input.temperature = NaN;
  assert.throws(() => runAlternativeReference(invalid.input), /finite/);
  assert.throws(() => runInputSensitivity(invalid, 0, 16), /finite/);
});

test("256 fixed-seed wide input configurations preserve model agreement on cooling", () => {
  let state = 0x1a2b3c4d;
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let i = 0; i < 256; i++) {
    const input = { ...DEFAULT_INPUT };
    for (const param of PARAMETERS) {
      const value = param.min + rand() * (param.max - param.min);
      input[param.id] = param.id === "timeSteps" ? Math.round(value) : value;
    }
    const comparison = compareAlternativeModel(runSimulation(input));
    assert.ok(comparison.fields[0].maxAbs < 1e-9);
    assert.ok(comparison.fields[1].rmse >= 0 && Number.isFinite(comparison.fields[1].rmse));
  }
});
