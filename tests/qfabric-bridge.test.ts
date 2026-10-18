import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_INPUT } from "../src/config/parameters";
import { runSimulation } from "../src/lib/engine";
import {
  MAX_QFABRIC_REPORT_BYTES,
  buildQFabricSnapshot,
  parseQFabricBridgeReport,
  QFABRIC_REPORT_VERSION,
} from "../src/lib/qfabric-bridge";

const samplePath = "public/examples/qfabric-bridge-report.synthetic.json";
const snapshotPath = "public/examples/qfabric-snapshot.synthetic.json";
const fixture = readFileSync(samplePath, "utf8");
const sample = JSON.parse(fixture);

test("real educational simulation exports the exact versioned snapshot", () => {
  const snapshot = buildQFabricSnapshot(runSimulation({ ...DEFAULT_INPUT }));
  assert.equal(snapshot.schemaVersion, "crystaltwin-qfabric-snapshot/1");
  assert.equal(snapshot.source.provenance, "synthetic");
  assert.equal(snapshot.input.timeSteps, snapshot.trajectory.length);
  assert.equal(snapshot.trajectory[0].step, 1);
  assert.equal(snapshot.trajectory.at(-1)?.step, snapshot.input.timeSteps);
});

test("offline JSON fixture passes import and references its true source SHA-256", () => {
  const report = parseQFabricBridgeReport(fixture);
  assert.equal(report.schemaVersion, QFABRIC_REPORT_VERSION);
  assert.equal(report.qfabric.mode, "plan_only");
  assert.equal(report.qfabric.readoutStatus, "intent_only");
  assert.equal(report.qfabric.hardwareExecuted, false);
  assert.equal(report.analytics.backend, "cpu");
  assert.equal(report.analytics.physicalMeasurement, false);
  assert.equal(
    report.source.sha256,
    createHash("sha256").update(readFileSync(snapshotPath)).digest("hex"),
  );
  assert.equal(report.analytics.shots, 256);
  assert.equal(report.snapshot.rowCount, 2);
});

test("import refuses false hardware or measured-source claims", () => {
  for (const mutate of [
    (r: typeof sample) => { r.qfabric.hardwareExecuted = true; },
    (r: typeof sample) => { r.qfabric.readoutStatus = "acquired"; },
    (r: typeof sample) => { r.qfabric.mode = "hardware"; },
    (r: typeof sample) => { r.source.provenance = "measured"; },
    (r: typeof sample) => { r.analytics.physicalMeasurement = true; },
    (r: typeof sample) => { r.analytics.backend = "unknown"; },
    (r: typeof sample) => { r.qfabric.plan.calls[0].method = "acquire"; },
    (r: typeof sample) => { r.analytics.shots = 999; },
  ]) {
    const draft = structuredClone(sample);
    mutate(draft);
    assert.throws(() => parseQFabricBridgeReport(JSON.stringify(draft)));
  }
});

test("import refuses malformed, nonfinite and oversized reports", () => {
  assert.throws(() => parseQFabricBridgeReport("not json"), /JSON/);
  assert.throws(
    () => parseQFabricBridgeReport(" ".repeat(MAX_QFABRIC_REPORT_BYTES + 1)),
    /512 KiB/,
  );
  const corrupted = structuredClone(sample);
  corrupted.analytics.meanI = "Infinity";
  assert.throws(() => parseQFabricBridgeReport(JSON.stringify(corrupted)), /finite/);
});
