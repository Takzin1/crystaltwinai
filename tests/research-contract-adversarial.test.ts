/**
 * Attack-surface and scientific-integrity regression checks.
 * Synthetic examples only: schema consistency is not proof of physical truth.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDataset } from "../src/lib/datasets";
import { DEFAULT_INPUT } from "../src/config/parameters";
import { runSimulation } from "../src/lib/engine";
import {
  parseQFabricBridgeReport,
  buildQFabricSnapshot,
} from "../src/lib/qfabric-bridge";
import { parseQuantumTheoryRegistry } from "../src/lib/quantum-theory-evidence";
import { parseResearchDataset } from "../src/lib/research-schema";

const fixture = JSON.parse(readFileSync("public/examples/qfabric-bridge-report.synthetic.json", "utf8"));
const registryRaw = readFileSync("public/examples/quantum-theory-evidence-v1.json", "utf8");

function corruptReport(fn: (r: typeof fixture) => void) {
  const report = structuredClone(fixture);
  fn(report);
  return JSON.stringify(report);
}

test("bridge report requires row count, steps and QICK reference to agree", () => {
  assert.doesNotThrow(() => parseQFabricBridgeReport(JSON.stringify(fixture)));
  for (const mutate of [
    (r: typeof fixture) => { r.snapshot.rowCount = 3; },
    (r: typeof fixture) => { r.snapshot.input.timeSteps = 1.5; },
    (r: typeof fixture) => { r.snapshot.input.timeSteps = 0; },
    (r: typeof fixture) => { r.snapshot.summary.nucleationEvents = 3; },
    (r: typeof fixture) => { r.snapshot.summary.nucleationEvents = 0.2; },
    (r: typeof fixture) => { r.snapshot.summary.qualityScore = 101; },
    (r: typeof fixture) => { r.snapshot.summary.finalYield = -1; },
    (r: typeof fixture) => { r.snapshot.summary.avgGrowthRate = -2; },
    (r: typeof fixture) => { r.snapshot.summary.maxSupersaturation = -1; },
    (r: typeof fixture) => { r.qfabric.plan.qick_reference_commit = "spoofed"; },
  ]) assert.throws(() => parseQFabricBridgeReport(corruptReport(mutate)));
});

test("snapshot export rejects tampered local simulation results", () => {
  const pristine = runSimulation({ ...DEFAULT_INPUT });
  assert.equal(buildQFabricSnapshot(pristine).trajectory.length, DEFAULT_INPUT.timeSteps);
  const corrupt = (mutator: (draft: typeof pristine) => void) => {
    const copy = structuredClone(pristine);
    mutator(copy);
    return copy;
  };
  assert.throws(() => buildQFabricSnapshot(corrupt(x => { x.series[4].step = 27; })), /step order/);
  assert.throws(() => buildQFabricSnapshot(corrupt(x => { x.series[0].growthRate = -3; })), /trajectory/);
  assert.throws(() => buildQFabricSnapshot(corrupt(x => { x.series[0].temperature = Number.NaN; })), /finite/);
  assert.throws(() => buildQFabricSnapshot(corrupt(x => { x.summary.nucleationEvents = 999; })), /summary/);
  assert.throws(() => buildQFabricSnapshot(corrupt(x => { x.summary.qualityScore = 120; })), /summary/);
});

test("v1 CSV and JSON with equivalent observations produce identical comparisons", () => {
  const csv = "step,temperature,concentration,growthRate\n1,60,0.42,1\n3,59,0.40,1.5\n";
  const fromCsv = parseDataset(csv, "csv");
  const fromJson = parseDataset(JSON.stringify({
    schemaVersion: 1, name: "same",
    rows: [{ step: 1, temperature: 60, concentration: 0.42, growthRate: 1 },
      { step: 3, temperature: 59, concentration: 0.4, growthRate: 1.5 }],
  }), "json");
  assert.deepEqual(fromCsv.rows, fromJson.rows);
  assert.deepEqual(fromCsv.fields, fromJson.fields);
});

test("v1 import rejects spreadsheet formulas, malformed quotes and untrusted values", () => {
  for (const token of ["=1+1", "+SUM(A1)", "@LOOKUP", "NaN", "Infinity", "0x12", "-1"]) {
    const csv = "step,temperature,concentration\n1," + token + ",0.4\n2,58,0.39\n";
    assert.throws(() => parseDataset(csv, "csv"), "Accepted " + token);
  }
  for (const csv of [
    "step,temperature,concentration\n1,\"bad,0.4\n2,58,0.39",
    "step,temperature,concentration\n1,60,0.4,unexpected\n2,58,0.39\n",
    "step,temperature,concentration\n1,60,0.4\n1,58,0.39\n",
  ]) assert.throws(() => parseDataset(csv, "csv"));
});

test("research v2 refuses fabricated real-measurement validity shortcuts", () => {
  const base = JSON.parse(readFileSync("public/examples/research-v2-synthetic.json", "utf8"));
  assert.doesNotThrow(() => parseResearchDataset(JSON.stringify(base)));
  const changed = structuredClone(base);
  changed.metadata.sourceUrl = "javascript:alert(1)";
  assert.throws(() => parseResearchDataset(JSON.stringify(changed)), /https URL/);
});

test("literature metadata stays original-source-only and exact fixture bytes are stable", () => {
  const bibliography = parseQuantumTheoryRegistry(registryRaw);
  assert.ok(bibliography.entries.length >= 10);
  assert.ok(bibliography.entries.every(p =>
    p.crystalTwinUse === "context_only_no_engine_calibration" &&
    p.reproductionStatus === "not_reproduced_in_either_repository"));
  const qfabricSnapshotBytes = readFileSync("public/examples/qfabric-snapshot.synthetic.json");
  const bridge = parseQFabricBridgeReport(JSON.stringify(fixture));
  assert.equal(bridge.source.sha256, createHash("sha256").update(qfabricSnapshotBytes).digest("hex"));
  const dangerous = JSON.parse(registryRaw);
  dangerous.entries[0].crystalTwinUse = "physics_calibrated";
  assert.throws(() => parseQuantumTheoryRegistry(JSON.stringify(dangerous)), /not assert/);
});
