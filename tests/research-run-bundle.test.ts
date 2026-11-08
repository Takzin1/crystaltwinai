import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyOfflineResearchBundle } from "../src/lib/research-run-bundle";

const snapshot = readFileSync("public/examples/qfabric-snapshot.synthetic.json", "utf8");
const report = readFileSync("public/examples/qfabric-bridge-report.synthetic.json", "utf8");

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function manifest(source = snapshot, result = report): Record<string, unknown> {
  const a = sha256(source), b = sha256(result);
  const r = JSON.parse(result);
  return {
    schemaVersion: "ctqf-research-bundle/1",
    kind: "synthetic_offline_interoperability",
    runId: `syn-${a.slice(0, 12)}-${b.slice(0, 12)}`,
    protocol: {
      snapshotSchema: "crystaltwin-qfabric-snapshot/1",
      reportSchema: "qfabric-crystaltwin-report/1",
    },
    sha256: { snapshot: a, report: b },
    primaryQuestion: "Does the exact-byte offline bridge preserve its declared safety and integrity invariants?",
    primaryEndpoint: "snapshot_report_link_and_plan_only_invariants",
    primaryResult: "passes_synthetic_integrity_gates",
    environment: { analyticsBackend: r.analytics.backend, shots: r.analytics.shots },
    integrityChecks: { exactSourceBytes: true, qfabricSemanticInvariants: true },
    physicalMeasurement: false,
    hardwareExecuted: false,
    scientificReplication: false,
  };
}

test("checks exact-byte source linkage against a compatible QFabric report fixture", async () => {
  const result = await verifyOfflineResearchBundle(snapshot, report, JSON.stringify(manifest()));
  assert.equal(result.snapshotSha256, sha256(snapshot));
  assert.equal(result.reportSha256, sha256(report));
  assert.equal(result.backend, "cpu");
  assert.equal(result.verificationScope, "local_byte_linkage_only");
});

test("fails on replaced snapshot, altered manifest or invented measurement claims", async () => {
  const bundled = JSON.stringify(manifest());
  await assert.rejects(
    verifyOfflineResearchBundle(snapshot + " ", report, bundled),
    /match|manifest/i,
  );
  const fake = manifest();
  fake.physicalMeasurement = true;
  await assert.rejects(
    verifyOfflineResearchBundle(snapshot, report, JSON.stringify(fake)),
    /manifest/,
  );
  const altered = JSON.parse(report);
  altered.qfabric.hardwareExecuted = true;
  await assert.rejects(
    verifyOfflineResearchBundle(snapshot, JSON.stringify(altered), bundled),
    /hardware/,
  );
});

test("rejects oversized manifests and misleading source provenance", async () => {
  await assert.rejects(
    verifyOfflineResearchBundle(snapshot, report, " ".repeat(16 * 1024 + 1)),
    /byte limit/,
  );
  const fake = JSON.parse(snapshot);
  fake.source.provenance = "measured";
  await assert.rejects(
    verifyOfflineResearchBundle(JSON.stringify(fake), report, JSON.stringify(manifest())),
    /synthetic/,
  );
});
