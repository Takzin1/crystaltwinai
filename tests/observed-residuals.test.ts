import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_INPUT } from "../src/config/parameters";
import { runSimulation } from "../src/lib/engine";
import { parseDataset } from "../src/lib/datasets";
import { assessObservedResiduals } from "../src/lib/observed-residuals";

test("observed residual diagnostics cover matches, worst error and seed-stable intervals", () => {
  const result = runSimulation({ ...DEFAULT_INPUT, timeSteps: 15 });
  const rows = result.series.slice(0, 12).map(row => ({
    step: row.step,
    temperature: Number((row.temperature + 0.5).toFixed(6)),
    concentration: Number((row.concentration + 0.01).toFixed(6)),
  }));
  const dataset = parseDataset(JSON.stringify({ schemaVersion: 1, name: "synthetic-shift", rows }), "json");
  const stats = assessObservedResiduals(dataset, result.series);
  assert.deepEqual(stats.map(row => row.field), ["temperature", "concentration"]);
  assert.ok(stats.every(row => row.count === 12 && row.coverageFraction === 1));
  assert.ok(Math.abs(stats[0].maxAbs - 0.5) < 1e-10);
  assert.ok(stats[0].bootstrapBias);
  assert.ok(Math.abs(stats[0].bootstrapBias.lower - 0.5) < 1e-10);
  assert.deepEqual(stats, assessObservedResiduals(dataset, result.series));
});

test("unmatched observations never extrapolate and insufficient n never implies interval", () => {
  const sim = runSimulation({ ...DEFAULT_INPUT, timeSteps: 10 });
  const d = parseDataset(JSON.stringify({ schemaVersion: 1, name: "partial",
    rows: [{ step: 1, temperature: 60, concentration: 0.4 },
      { step: 10, temperature: 55, concentration: 0.35 },
      { step: 150, temperature: 20, concentration: 0.1 }],
  }), "json");
  const stats = assessObservedResiduals(d, sim.series);
  assert.ok(stats.every(s => s.count === 2 && s.coverageFraction === 2/3 && s.bootstrapBias === null));
});

test("adversarial model values, steps and reported observations are rejected", () => {
  const sim = runSimulation({ ...DEFAULT_INPUT, timeSteps: 10 });
  const d = parseDataset("step,temperature,concentration\n1,60,0.40\n2,59,0.39", "csv");
  assert.doesNotThrow(() => assessObservedResiduals(d, sim.series));
  const badModel = (mutate: (list: typeof sim.series) => void) => {
    const list = structuredClone(sim.series);
    mutate(list);
    return list;
  };
  assert.throws(() => assessObservedResiduals(d, badModel(list => { list[1].step = 1; })), /malformed/);
  assert.throws(() => assessObservedResiduals(d, badModel(list => { list[2].step = 0; })), /malformed/);
  assert.throws(() => assessObservedResiduals(d, badModel(list => { list[2].quality = Infinity; })), /nonfinite/);
  assert.throws(() => assessObservedResiduals(d, badModel(list => { list[0].growthRate = NaN; })), /nonfinite/);
  assert.throws(() => assessObservedResiduals({ ...d, fields: ["temperature", "temperature"] }, sim.series), /duplicated/);
  assert.throws(() => assessObservedResiduals({ ...d, rows: [...d.rows].reverse() }, sim.series), /Dataset steps/);
  assert.throws(() => assessObservedResiduals({ ...d,
    rows: d.rows.map((r, i) => i === 0 ? { ...r, temperature: NaN } : r),
  }, sim.series), /Dataset steps/);
  assert.throws(() => assessObservedResiduals({ ...d,
    rows: d.rows.map((r, i) => i === 0 ? { ...r, concentration: Infinity } : r),
  }, sim.series), /Dataset steps/);
});


test("nine matched but discontinuous steps suppress misleading serial bootstrap", () => {
  const sim = runSimulation({ ...DEFAULT_INPUT, timeSteps: 30 });
  const steps = [1, 2, 3, 4, 5, 12, 13, 14, 15];
  const d = parseDataset(JSON.stringify({
    schemaVersion: 1, name: "gapped synthetic",
    rows: steps.map(step => ({
      step, temperature: 58, concentration: 0.3,
    })),
  }), "json");
  const result = assessObservedResiduals(d, sim.series);
  assert.ok(result.every(field => field.count === 9 &&
    field.coverageFraction === 1 && field.bootstrapBias === null));
});

test("unmatched long gap in simulation prevents artificial adjacent residual blocks", () => {
  const sim = runSimulation({ ...DEFAULT_INPUT, timeSteps: 20 });
  const d = parseDataset(JSON.stringify({
    schemaVersion: 1, name: "complete synthetic",
    rows: sim.series.slice(0, 12).map(row => ({
      step: row.step, temperature: row.temperature, concentration: row.concentration,
    })),
  }), "json");
  const reference = sim.series.filter(row => row.step !== 6);
  const result = assessObservedResiduals(d, reference);
  assert.ok(result.every(field => field.count === 11 && field.bootstrapBias === null));
});
