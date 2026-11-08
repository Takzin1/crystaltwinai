/**
 * Browser-side verification of an offline CrystalTwinAI x QFabric research run.
 *
 * Matches byte hashes, source/report values and declared non-execution.
 * This is not a substitute for QFabric's full Python --verify gate and does
 * not validate physical measurements, quantum advantage or scientific accuracy.
 */
import { parseQFabricBridgeReport } from "./qfabric-bridge";

export const RESEARCH_BUNDLE_VERSION = "ctqf-research-bundle/1" as const;
const MAX_SNAPSHOT_BYTES = 512 * 1024;
const MAX_REPORT_BYTES = 512 * 1024;
const MAX_MANIFEST_BYTES = 16 * 1024;

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(label + " must be a JSON object.");
  }
  return value as Record<string, unknown>;
}

function sameJSON(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length && a.every((item, i) => sameJSON(item, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length &&
      keys.every((key) => Object.hasOwn(right, key) && sameJSON(left[key], right[key]));
  }
  return Object.is(a, b);
}

async function hashExactUtf8(content: string, label: string, maximum: number): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  if (bytes.length > maximum) throw new Error(label + " exceeds the byte limit.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export interface OfflineResearchBundleResult {
  runId: string;
  snapshotSha256: string;
  reportSha256: string;
  backend: "cpu" | "nvidia_cuda";
  shots: number;
  verificationScope: "local_byte_linkage_only";
}

/** Always use original decoded UTF-8 file contents, not re-serialized objects. */
export async function verifyOfflineResearchBundle(
  snapshotJson: string,
  reportJson: string,
  manifestJson: string,
): Promise<OfflineResearchBundleResult> {
  const snapshotSha256 = await hashExactUtf8(snapshotJson, "snapshot", MAX_SNAPSHOT_BYTES);
  const reportSha256 = await hashExactUtf8(reportJson, "report", MAX_REPORT_BYTES);
  await hashExactUtf8(manifestJson, "manifest", MAX_MANIFEST_BYTES);
  const report = parseQFabricBridgeReport(reportJson);
  let snapshot: Record<string, unknown>;
  let manifest: Record<string, unknown>;
  try {
    snapshot = object(JSON.parse(snapshotJson) as unknown, "snapshot");
    manifest = object(JSON.parse(manifestJson) as unknown, "manifest");
  } catch {
    throw new Error("Invalid snapshot or bundle JSON.");
  }
  const source = object(snapshot.source, "snapshot.source");
  if (snapshot.schemaVersion !== "crystaltwin-qfabric-snapshot/1" ||
      snapshot.kind !== "educational_snapshot" ||
      source.repository !== "Takzin1/crystaltwinai" ||
      source.provenance !== "synthetic" ||
      source.mode !== "educational_simulation") {
    throw new Error("Bundle supports synthetic educational snapshots only.");
  }
  if (!Array.isArray(snapshot.trajectory) ||
      snapshot.trajectory.length !== report.snapshot.rowCount ||
      !sameJSON(snapshot.input, report.snapshot.input) ||
      !sameJSON(snapshot.summary, report.snapshot.summary) ||
      report.source.sha256 !== snapshotSha256) {
    throw new Error("Snapshot bytes or reported input/summary do not match.");
  }
  const expected = {
    schemaVersion: RESEARCH_BUNDLE_VERSION,
    kind: "synthetic_offline_interoperability",
    runId: `syn-${snapshotSha256.slice(0, 12)}-${reportSha256.slice(0, 12)}`,
    protocol: {
      snapshotSchema: "crystaltwin-qfabric-snapshot/1",
      reportSchema: "qfabric-crystaltwin-report/1",
    },
    sha256: { snapshot: snapshotSha256, report: reportSha256 },
    primaryQuestion: "Does the exact-byte offline bridge preserve its declared safety and integrity invariants?",
    primaryEndpoint: "snapshot_report_link_and_plan_only_invariants",
    primaryResult: "passes_synthetic_integrity_gates",
    environment: { analyticsBackend: report.analytics.backend, shots: report.analytics.shots },
    integrityChecks: { exactSourceBytes: true, qfabricSemanticInvariants: true },
    physicalMeasurement: false,
    hardwareExecuted: false,
    scientificReplication: false,
  };
  if (!sameJSON(manifest, expected)) {
    throw new Error("Research bundle differs from the expected byte-bound manifest.");
  }
  return {
    runId: expected.runId,
    snapshotSha256,
    reportSha256,
    backend: report.analytics.backend,
    shots: report.analytics.shots,
    verificationScope: "local_byte_linkage_only",
  };
}
