/** Offline typed bridge between the educational CrystalTwinAI simulator and
 * QFabric's plan-only, optionally CUDA-backed research demonstrator.
 * No quantum sensing, experimental measurements, physical control or
 * scientific model validation is implied.
 */
import type { SimulationResult } from "./types";

export const QFABRIC_SNAPSHOT_VERSION = "crystaltwin-qfabric-snapshot/1" as const;
export const QFABRIC_REPORT_VERSION = "qfabric-crystaltwin-report/1" as const;
export const MAX_QFABRIC_REPORT_BYTES = 512 * 1024;

const INPUT_FIELDS = [
  "temperature", "concentration", "stirringSpeed", "coolingRate", "impurityLevel", "timeSteps",
] as const;
const SUMMARY_FIELDS = [
  "avgGrowthRate", "stabilityScore", "qualityScore", "finalYield",
  "maxSupersaturation", "nucleationEvents",
] as const;

type SnapshotInput = Record<(typeof INPUT_FIELDS)[number], number>;
type SnapshotSummary = Record<(typeof SUMMARY_FIELDS)[number], number>;

export interface QFabricSnapshot {
  schemaVersion: typeof QFABRIC_SNAPSHOT_VERSION;
  kind: "educational_snapshot";
  source: {
    repository: "Takzin1/crystaltwinai";
    provenance: "synthetic";
    mode: "educational_simulation";
  };
  input: SnapshotInput;
  summary: SnapshotSummary;
  trajectory: {
    step: number;
    temperature: number;
    concentration: number;
    growthRate: number;
    crystalYield: number;
  }[];
}

export interface QFabricBridgeReport {
  schemaVersion: typeof QFABRIC_REPORT_VERSION;
  kind: "qfabric_research_bridge_report";
  generatedAt: string;
  source: {
    repository: "Takzin1/crystaltwinai";
    provenance: "synthetic";
    mode: "educational_simulation";
    sha256: string;
  };
  snapshot: {
    input: SnapshotInput;
    summary: SnapshotSummary;
    rowCount: number;
  };
  qfabric: {
    repository: "Takzin1/QFabric";
    mode: "plan_only";
    hardwareExecuted: false;
    readoutStatus: "intent_only";
    readoutIntent: {
      kind: "qick_readout_proposal";
      shots: number;
      note: string;
    };
    qickReferenceCommit: string;
    plan: {
      device_id: string;
      calls: { method: string; kwargs: Record<string, unknown> }[];
    };
  };
  analytics: {
    backend: "cpu" | "nvidia_cuda";
    signalType: "synthetic_iq";
    algorithm: "analytic_unit_circle_v1";
    shots: number;
    meanI: number;
    meanQ: number;
    meanPower: number;
    elapsedMs: number;
    physicalMeasurement: false;
  };
  disclaimer: string;
}

export function buildQFabricSnapshot(result: SimulationResult): QFabricSnapshot {
  const input = Object.fromEntries(INPUT_FIELDS.map((key) => [key, result.input[key]])) as SnapshotInput;
  const summary = Object.fromEntries(
    SUMMARY_FIELDS.map((key) => [key, result.summary[key]]),
  ) as SnapshotSummary;
  const snapshot: QFabricSnapshot = {
    schemaVersion: QFABRIC_SNAPSHOT_VERSION,
    kind: "educational_snapshot",
    source: {
      repository: "Takzin1/crystaltwinai",
      provenance: "synthetic",
      mode: "educational_simulation",
    },
    input,
    summary,
    trajectory: result.series.map((row) => ({
      step: row.step,
      temperature: row.temperature,
      concentration: row.concentration,
      growthRate: row.growthRate,
      crystalYield: row.crystalYield,
    })),
  };
  // A single NaN would otherwise serialize as null. Fail before exporting.
  if (snapshot.trajectory.length !== snapshot.input.timeSteps ||
      snapshot.trajectory.length < 1 || snapshot.trajectory.length > 200) {
    throw new Error("The simulator trajectory is not a valid QFabric bridge snapshot.");
  }
  const values = [
    ...Object.values(snapshot.input),
    ...Object.values(snapshot.summary),
    ...snapshot.trajectory.flatMap((row) => Object.values(row)),
  ];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error("QFabric snapshots require finite values.");
  }
  // A caller may synthesize a SimulationResult without using runSimulation.
  // Reject inconsistent row order and implausible summaries before exporting.
  snapshot.trajectory.forEach((row, index) => {
    if (row.step !== index + 1 || row.growthRate < 0 ||
        row.concentration < 0 || row.crystalYield < 0 || row.crystalYield > 100) {
      throw new Error("QFabric snapshot contains invalid trajectory values or step order.");
    }
  });
  if (!Number.isInteger(snapshot.input.timeSteps) ||
      !Number.isInteger(summary.nucleationEvents) ||
      summary.nucleationEvents < 0 ||
      summary.nucleationEvents > snapshot.trajectory.length ||
      summary.avgGrowthRate < 0 || summary.maxSupersaturation < 0 ||
      [summary.qualityScore, summary.stabilityScore, summary.finalYield].some(
        value => value < 0 || value > 100
      )) {
    throw new Error("QFabric snapshot contains inconsistent educational summary values.");
  }
  return snapshot;
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(at + " must be an object.");
  }
  return value as Record<string, unknown>;
}
function string(value: unknown, at: string, max = 512): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(at + " must be a nonempty bounded string.");
  }
  return value;
}
function finite(value: unknown, at: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(at + " must be a finite JSON number.");
  }
  return value;
}
function integer(value: unknown, at: string, min: number, max: number): number {
  const n = finite(value, at);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(at + " is outside its supported integer range.");
  }
  return n;
}
function checkNumbers(value: unknown, keys: readonly string[], at: string) {
  const item = record(value, at);
  if (Object.keys(item).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(item, key))) {
    throw new Error(at + " fields differ from the bridge contract.");
  }
  keys.forEach((key) => finite(item[key], at + "." + key));
  return item;
}

/** Validates the *reported* provenance; a SHA string is not proof of source authenticity. */
export function parseQFabricBridgeReport(content: string): QFabricBridgeReport {
  if (new TextEncoder().encode(content).byteLength > MAX_QFABRIC_REPORT_BYTES) {
    throw new Error("QFabric report exceeds 512 KiB.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("QFabric report is not valid JSON.");
  }
  const doc = record(parsed, "report");
  if (doc.schemaVersion !== QFABRIC_REPORT_VERSION ||
      doc.kind !== "qfabric_research_bridge_report") {
    throw new Error("Unsupported QFabric report schema or kind.");
  }
  string(doc.generatedAt, "generatedAt", 64);
  if (Number.isNaN(Date.parse(doc.generatedAt as string))) {
    throw new Error("Invalid generation timestamp.");
  }
  const source = record(doc.source, "source");
  if (source.repository !== "Takzin1/crystaltwinai" ||
      source.provenance !== "synthetic" ||
      source.mode !== "educational_simulation" ||
      typeof source.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(source.sha256)) {
    throw new Error("Invalid or misleading QFabric report source provenance.");
  }
  const snapshot = record(doc.snapshot, "snapshot");
  const reportedInput = checkNumbers(snapshot.input, INPUT_FIELDS, "snapshot.input");
  const reportedSummary = checkNumbers(snapshot.summary, SUMMARY_FIELDS, "snapshot.summary");
  const rows = integer(snapshot.rowCount, "snapshot.rowCount", 1, 200);
  // Synthetic legacy fixtures use 2 steps, so enforce the wire contract
  // without silently reinterpreting these reports as current UI inputs.
  if (integer(reportedInput.timeSteps, "snapshot.input.timeSteps", 1, 200) !== rows) {
    throw new Error("QFabric report row count disagrees with input time steps.");
  }
  if (integer(reportedSummary.nucleationEvents, "snapshot.summary.nucleationEvents", 0, rows) > rows ||
      reportedSummary.avgGrowthRate < 0 ||
      reportedSummary.maxSupersaturation < 0 ||
      [reportedSummary.qualityScore, reportedSummary.stabilityScore,
       reportedSummary.finalYield].some(value => value < 0 || value > 100)) {
    throw new Error("QFabric report contains invalid educational summary metrics.");
  }
  const qfabric = record(doc.qfabric, "qfabric");
  if (qfabric.repository !== "Takzin1/QFabric" ||
      qfabric.mode !== "plan_only" ||
      qfabric.hardwareExecuted !== false ||
      qfabric.readoutStatus !== "intent_only") {
    throw new Error("This UI rejects hardware execution or real readout claims.");
  }
  const intent = record(qfabric.readoutIntent, "qfabric.readoutIntent");
  if (intent.kind !== "qick_readout_proposal") {
    throw new Error("QICK readout must remain an unexecuted proposal.");
  }
  const plannedShots = integer(intent.shots, "qfabric.readoutIntent.shots", 1, 2_000_000);
  string(intent.note, "qfabric.readoutIntent.note");
  string(qfabric.qickReferenceCommit, "qfabric.qickReferenceCommit", 64);
  const plan = record(qfabric.plan, "qfabric.plan");
  if (plan.qick_reference_commit !== qfabric.qickReferenceCommit) {
    throw new Error("QICK reference commit does not match the reported plan.");
  }
  string(plan.device_id, "qfabric.plan.device_id", 120);
  if (!Array.isArray(plan.calls) || plan.calls.length < 1 || plan.calls.length > 20) {
    throw new Error("Unexpected QICK plan length.");
  }
  for (const raw of plan.calls) {
    const call = record(raw, "qfabric.plan.calls");
    if (!["declare_gen", "add_pulse", "pulse"].includes(call.method as string)) {
      throw new Error("The plan contains an unsupported or executable readout call.");
    }
    record(call.kwargs, "call.kwargs");
  }
  const analytics = record(doc.analytics, "analytics");
  if (!["cpu", "nvidia_cuda"].includes(analytics.backend as string) ||
      analytics.signalType !== "synthetic_iq" ||
      analytics.algorithm !== "analytic_unit_circle_v1" ||
      analytics.physicalMeasurement !== false) {
    throw new Error("Analytics must be clearly synthetic and identify the actual backend.");
  }
  const shots = integer(analytics.shots, "analytics.shots", 1, 2_000_000);
  if (shots !== plannedShots) throw new Error("Analytic shot count differs from readout intent.");
  finite(analytics.meanI, "analytics.meanI");
  finite(analytics.meanQ, "analytics.meanQ");
  const power = finite(analytics.meanPower, "analytics.meanPower");
  if (power < 0) throw new Error("Synthetic IQ power must be nonnegative.");
  if (finite(analytics.elapsedMs, "analytics.elapsedMs") < 0) {
    throw new Error("Elapsed time must not be negative.");
  }
  string(doc.disclaimer, "disclaimer", 1000);
  return parsed as QFabricBridgeReport;
}
