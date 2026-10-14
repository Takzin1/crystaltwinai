import assert from "node:assert/strict";
import test from "node:test";
import { compareDataset, MAX_DATASET_BYTES, parseDataset } from "../src/lib/datasets";
import { DEFAULT_INPUT } from "../src/config/parameters";
import { validateSimulationInput } from "../src/lib/validation";
import { runSimulation } from "../src/lib/engine";

const csv = "step,temperature,concentration,quality\n1,61.4,0.419,93\n2,60.9,0.417,92\n";

test("valid CSV imports typed values and optional columns", () => {
  const d = parseDataset(csv, "csv", "synthetic.csv");
  assert.equal(d.schemaVersion, 1);
  assert.equal(d.rows.length, 2);
  assert.deepEqual(d.fields, ["temperature", "concentration", "quality"]);
  assert.equal(d.rows[0].step, 1);
  assert.equal(d.rows[1].quality, 92);
});

test("versioned JSON import", () => {
  const d = parseDataset(JSON.stringify({ schemaVersion: 1, name: "test", rows: [
    { step: 1, temperature: 50, concentration: 0.3 },
    { step: 3, temperature: 49, concentration: 0.29 },
  ] }), "json");
  assert.equal(d.name, "test");
  assert.deepEqual(d.rows.map((row) => row.step), [1, 3]);
});

test("CSV rejects duplicate or unknown headers and missing required columns", () => {
  assert.throws(() => parseDataset("step,temperature,temperature,concentration\n1,50,50,0.3\n2,49,49,0.29", "csv"), /duplicate/);
  assert.throws(() => parseDataset("step,temperature,concentration,evil\n1,50,0.3,1\n2,49,0.29,1", "csv"), /unknown/);
  assert.throws(() => parseDataset("step,temperature\n1,50\n2,49", "csv"), /must include/);
});

test("numeric coercion rejects formulas, NaN, infinite, blank and malformed data", () => {
  for (const value of ["=1+1", "Infinity", "NaN", "5,000", "0xFF", ""]) {
    assert.throws(() => parseDataset(csv.replace("61.4", value), "csv"), /Row|columns/);
  }
  assert.throws(() => parseDataset(csv.replace("61.4", "200"), "csv"), /outside allowed range/);
});

test("rows must be increasing and bounded", () => {
  assert.throws(() => parseDataset(csv.replace("\n2,60.9", "\n1,60.9"), "csv"), /strictly increasing/);
  assert.throws(() => parseDataset(csv.replace("\n2,60.9", "\n201,60.9"), "csv"), /strictly increasing/);
  assert.throws(() => parseDataset("step,temperature,concentration\n1,50,0.2", "csv"), /2–200/);
  assert.throws(() => parseDataset(csv + " ".repeat(MAX_DATASET_BYTES), "csv"), /512 KiB/);
});

test("JSON requires schema v1, valid shape, strict numeric values", () => {
  assert.throws(() => parseDataset('{"schemaVersion":2,"rows":[]}', "json"), /Unsupported/);
  assert.throws(() => parseDataset('{"schemaVersion":1,"rows":"oops"}', "json"), /Unsupported/);
  assert.throws(() => parseDataset('{"schemaVersion":1,"rows":[{"step":1,"temperature":"NaN","concentration":0.3},{"step":2,"temperature":49,"concentration":0.2}]}', "json"), /finite/);
});

test("comparison computes MAE RMSE bias on matching steps only", () => {
  const d = parseDataset(csv, "csv");
  const simulation = runSimulation({ ...DEFAULT_INPUT, timeSteps: 10 });
  const outcome = compareDataset(d, simulation.series);
  assert.equal(outcome.matchedRows, 2);
  assert.equal(outcome.unmatchedRows, 0);
  const t = outcome.fields.find((field) => field.field === "temperature");
  assert.ok(t);
  assert.equal(t.count, 2);
  assert.ok(t.mae >= 0 && t.rmse >= t.mae - 1e-12);
  assert.ok(Number.isFinite(t.bias));
});

test("unmatched rows counted without extrapolation", () => {
  const d = parseDataset("step,temperature,concentration\n1,60,0.4\n200,40,0.3\n", "csv");
  const simulation = runSimulation({ ...DEFAULT_INPUT, timeSteps: 10 });
  const outcome = compareDataset(d, simulation.series);
  assert.equal(outcome.matchedRows, 1);
  assert.equal(outcome.unmatchedRows, 1);
  assert.equal(outcome.fields[0].count, 1);
});

test("engine rejects NaN, negative/out-of-range and unbounded steps", () => {
  assert.throws(() => validateSimulationInput({ ...DEFAULT_INPUT, temperature: Number.NaN }), /finite/);
  assert.throws(() => runSimulation({ ...DEFAULT_INPUT, concentration: -1 }), /expected/);
  assert.throws(() => runSimulation({ ...DEFAULT_INPUT, timeSteps: 1000000 }), /expected/);
  assert.throws(() => runSimulation({ ...DEFAULT_INPUT, timeSteps: 10.1 }), /integer/);
  assert.deepEqual(runSimulation(DEFAULT_INPUT), runSimulation(DEFAULT_INPUT));
});

test("catalog provenance metadata and reporting excludes raw dataset rows", async () => {
  const { DEFAULT_METADATA, normalizeMetadata, canCompareIntervals, makeComparisonReport } = await import("../src/lib/experiment-registry");
  const sample = parseDataset(csv, "csv");
  const simulation = runSimulation({ ...DEFAULT_INPUT, timeSteps: 10 });
  const comparison = compareDataset(sample, simulation.series);
  const metadata = normalizeMetadata({ ...DEFAULT_METADATA, source: "synthetic", material: " KCl ", experimentId: "demo-1", notes: "educational" });
  assert.equal(metadata.material, "KCl");
  assert.equal(canCompareIntervals(metadata), true);
  assert.equal(canCompareIntervals({ ...metadata, intervalMinutes: 2 }), false);
  assert.throws(() => normalizeMetadata({ ...metadata, intervalMinutes: Number.NaN }), /Interval/);
  assert.throws(() => normalizeMetadata({ ...metadata, source: "hidden" as typeof metadata.source }), /Invalid/);
  const report = makeComparisonReport({
    dataset: sample, metadata, sha256: "abc",
    simulatedInput: { ...DEFAULT_INPUT }, comparison,
    generatedAt: "2026-10-14T00:00:00.000Z",
  });
  assert.equal(report.data.metadata.source, "synthetic");
  assert.equal(report.data.rowCount, 2);
  assert.ok(!JSON.stringify(report).includes("61.4"));
  assert.throws(() => makeComparisonReport({
    dataset: sample, metadata: { ...metadata, intervalMinutes: 2 }, sha256: null,
    simulatedInput: DEFAULT_INPUT, comparison, generatedAt: "2026-10-14T00:00:00.000Z",
  }), /Time interval/);
});
