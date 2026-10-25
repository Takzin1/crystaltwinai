/**
 * TypeScript port of QFabric's research gate (`src/qfabric/orchestration.py`,
 * Takzin1/QFabric). The hosted Next.js runtime cannot execute that Python
 * package, so this port runs instead and is held to the Python behaviour by
 * golden cases exported from the real module
 * (tests/fixtures/qfabric-gate-golden.json, tests/pilot-gate-golden.test.ts).
 *
 * Untrusted model text is DATA, not instructions. Nothing here calls a model,
 * a device, or the simulator. "ready_for_review" is NOT an approval.
 */
import {
  JsonContractError,
  decodeUtf8,
  isFloatLiteral,
  parseStrictJson,
} from "./strict-json";
import { sha256Bytes } from "./sha256";

export const SNAPSHOT_VERSION = "crystaltwin-qfabric-snapshot/1";
export const PROPOSAL_VERSION = "qfabric-research-proposal/1";
export const ASSESSMENT_VERSION = "qfabric-research-assessment/1";
export const REVIEW_VERSION = "qfabric-human-review/1";
export const MAX_SNAPSHOT_BYTES = 512 * 1024;
export const MAX_PROPOSAL_BYTES = 16 * 1024;
export const MAX_ASSESSMENT_BYTES = 32 * 1024;
export const MAX_CHANGES = 3;

/** Educational model input limits (src/config/parameters.ts), NOT physical safety limits. */
export const GATE_PARAMETERS: Record<string, readonly [number, number, string]> = {
  temperature: [20.0, 90.0, "°C"],
  concentration: [0.1, 0.6, "g/mL"],
  stirringSpeed: [0.0, 1000.0, "rpm"],
  coolingRate: [0.05, 2.0, "°C/min"],
  impurityLevel: [0.0, 5.0, "%"],
  timeSteps: [10.0, 200.0, "steps"],
};
const PARAMETER_NAMES = Object.keys(GATE_PARAMETERS);
const SNAPSHOT_FIELDS = ["schemaVersion", "kind", "source", "input", "summary", "trajectory"];
const SUMMARY_FIELDS = [
  "avgGrowthRate", "stabilityScore", "qualityScore", "finalYield",
  "maxSupersaturation", "nucleationEvents",
];
const ROW_FIELDS = ["step", "temperature", "concentration", "growthRate", "crystalYield"];
const PROPOSAL_FIELDS = [
  "schemaVersion", "kind", "proposalId", "snapshotSha256",
  "source", "hypothesis", "rationale", "changes", "requestedAction",
];
export const PROPOSAL_ORIGINS = ["unverified_model", "human", "synthetic_fixture"] as const;

type Json = Record<string, unknown>;

export interface GateChange {
  parameter: string;
  from: number;
  to: number;
  unit: string;
}

export interface Assessment {
  schemaVersion: typeof ASSESSMENT_VERSION;
  kind: "educational_research_assessment";
  status: "ready_for_review" | "rejected";
  proposalId: string;
  snapshotSha256: string;
  proposalSha256: string;
  declaredOrigin: { origin: string; providerLabel: string; modelLabel: string };
  hypothesis: string;
  rationale: string;
  changes: GateChange[];
  proposedInput: Record<string, number> | null;
  rejectionReasons: string[];
  reviewRequired: true;
  humanApproved: false;
  modelInvoked: false;
  hardwareDispatchAllowed: false;
  physicalMeasurement: false;
  scope: "educational_simulation_only";
  notice: string;
}

export interface Review {
  schemaVersion: typeof REVIEW_VERSION;
  kind: "self_attested_educational_review";
  status: "approved_for_manual_simulation" | "rejected_by_reviewer";
  reviewerLabel: string;
  reviewerAuthenticated: false;
  snapshotSha256: string;
  proposalSha256: string;
  assessmentSha256: string;
  simulationInput: Record<string, number> | null;
  automaticExecution: false;
  hardwareDispatchAllowed: false;
  notice: string;
}

const valueError = (message: string) => new JsonContractError(message, "ValueError");
const typeError = (message: string) => new JsonContractError(message, "TypeError");

export const sha256 = sha256Bytes;

function decode(raw: Uint8Array, limit: number, label: string): Json {
  if (!(raw instanceof Uint8Array)) throw typeError(`${label} must be UTF-8 bytes`);
  if (raw.length > limit) throw valueError(`${label} exceeds its maximum size`);
  return object(parseStrictJson(decodeUtf8(raw, label), label), label);
}

function object(value: unknown, label: string): Json {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw typeError(`${label} must be an object`);
  }
  return value as Json;
}

function sameFields(data: Json, expected: readonly string[], label: string): void {
  const keys = Object.keys(data);
  if (keys.length !== expected.length || !expected.every((k) => Object.hasOwn(data, k))) {
    throw valueError(`${label} fields differ from the versioned contract`);
  }
}

// Python's str.strip() whitespace set (str.isspace), which differs from JS trim().
const PY_SPACE_CLASS =
  "[\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]";
const PY_SPACE = new RegExp(`^${PY_SPACE_CLASS}+|${PY_SPACE_CLASS}+$`, "g");
export const pyStrip = (value: string) => value.replace(PY_SPACE, "");
const codePoints = (value: string) => Array.from(value).length;

function text(value: unknown, label: string, maxSize: number): string {
  if (typeof value !== "string") {
    throw valueError(`${label} must be nonempty text of at most ${maxSize} characters`);
  }
  const stripped = pyStrip(value);
  const size = codePoints(stripped);
  if (size < 1 || size > maxSize) {
    throw valueError(`${label} must be nonempty text of at most ${maxSize} characters`);
  }
  return stripped;
}

function number(value: unknown, label: string): number {
  if (typeof value !== "number") throw typeError(`${label} must be numeric`);
  if (!Number.isFinite(value)) throw valueError(`${label} must be finite`);
  return value;
}

function digest(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw valueError(`${label} must be a lowercase hex SHA-256 digest`);
  }
  return value;
}

export function parseSnapshot(raw: Uint8Array): Json {
  const doc = decode(raw, MAX_SNAPSHOT_BYTES, "snapshot");
  sameFields(doc, SNAPSHOT_FIELDS, "snapshot");
  if (doc.schemaVersion !== SNAPSHOT_VERSION || doc.kind !== "educational_snapshot") {
    throw valueError("unsupported CrystalTwinAI snapshot schema");
  }
  const source = doc.source as Json | null;
  if (source === null || typeof source !== "object" || Array.isArray(source) ||
      Object.keys(source).length !== 3 ||
      source.repository !== "Takzin1/crystaltwinai" ||
      source.provenance !== "synthetic" ||
      source.mode !== "educational_simulation") {
    throw valueError("research gate accepts synthetic educational source only");
  }
  const inputs = object(doc.input, "snapshot.input");
  const inputKeys = Object.keys(inputs);
  if (inputKeys.length !== PARAMETER_NAMES.length ||
      !PARAMETER_NAMES.every((k) => Object.hasOwn(inputs, k))) {
    throw valueError("snapshot input fields mismatch");
  }
  for (const name of inputKeys) number(inputs[name], `input.${name}`);
  const steps = number(inputs.timeSteps, "input.timeSteps");
  if (!Number.isInteger(steps) || !(steps >= 1 && steps <= 200)) {
    throw valueError("snapshot timeSteps outside 1..200");
  }
  const summary = object(doc.summary, "snapshot.summary");
  sameFields(summary, SUMMARY_FIELDS, "snapshot.summary");
  for (const key of Object.keys(summary)) number(summary[key], `summary.${key}`);
  const rows = doc.trajectory;
  if (!Array.isArray(rows) || rows.length !== steps) {
    throw valueError("snapshot trajectory length differs from timeSteps");
  }
  let previous = 0;
  for (const row of rows) {
    const record = object(row, "trajectory row");
    sameFields(record, ROW_FIELDS, "trajectory row");
    const step = record.step;
    if (typeof step !== "number" || !Number.isInteger(step) || isFloatLiteral(record, "step") ||
        !(previous < step && step <= 200)) {
      throw valueError("trajectory steps must strictly increase");
    }
    previous = step;
    for (const name of ROW_FIELDS.slice(1)) number(record[name], `trajectory.${name}`);
  }
  return doc;
}

export function parseProposal(raw: Uint8Array): Json {
  const data = decode(raw, MAX_PROPOSAL_BYTES, "proposal");
  sameFields(data, PROPOSAL_FIELDS, "proposal");
  if (data.schemaVersion !== PROPOSAL_VERSION || data.kind !== "educational_parameter_change") {
    throw valueError("unsupported research proposal schema");
  }
  text(data.proposalId, "proposalId", 100);
  digest(data.snapshotSha256, "snapshotSha256");
  if (data.requestedAction !== "simulation_only") {
    throw valueError("only simulation_only is allowed; hardware commands are forbidden");
  }
  const source = object(data.source, "proposal.source");
  sameFields(source, ["origin", "providerLabel", "modelLabel"], "proposal.source");
  if (!(PROPOSAL_ORIGINS as readonly unknown[]).includes(source.origin)) {
    throw valueError("model provenance must be explicitly declared as unverified");
  }
  text(source.providerLabel, "providerLabel", 80);
  text(source.modelLabel, "modelLabel", 120);
  text(data.hypothesis, "hypothesis", 600);
  text(data.rationale, "rationale", 600);
  const changes = object(data.changes, "proposal.changes");
  const names = Object.keys(changes);
  if (names.length < 1 || names.length > MAX_CHANGES) {
    throw valueError("proposal must modify 1..3 parameters");
  }
  for (const name of names) {
    if (!Object.hasOwn(GATE_PARAMETERS, name)) {
      throw valueError(`unsupported simulation parameter: ${name}`);
    }
    number(changes[name], `changes.${name}`);
  }
  return data;
}

const compareCodePoints = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function makeAssessment(snapshotRaw: Uint8Array, proposalRaw: Uint8Array): Assessment {
  const snapshot = parseSnapshot(snapshotRaw);
  const proposal = parseProposal(proposalRaw);
  if (proposal.snapshotSha256 !== sha256(snapshotRaw)) {
    throw valueError("proposal references another snapshot SHA-256");
  }
  const original = snapshot.input as Record<string, number>;
  const requested = proposal.changes as Record<string, number>;
  const reasons: string[] = [];
  const deltas: GateChange[] = [];
  for (const name of Object.keys(requested).sort(compareCodePoints)) {
    const value = number(requested[name], `changes.${name}`);
    const [minimum, maximum, unit] = GATE_PARAMETERS[name];
    if (!(minimum <= value && value <= maximum)) {
      reasons.push(`${name}: outside educational model bounds [${pyFloat(minimum)}, ${pyFloat(maximum)}]`);
    } else if (name === "timeSteps" && !Number.isInteger(value)) {
      reasons.push("timeSteps: must be an integer");
    } else if (value === number(original[name], `input.${name}`)) {
      reasons.push(`${name}: unchanged from source input`);
    } else {
      deltas.push({ parameter: name, from: original[name], to: requested[name], unit });
    }
  }
  const accepted = reasons.length === 0;
  return {
    schemaVersion: ASSESSMENT_VERSION,
    kind: "educational_research_assessment",
    status: accepted ? "ready_for_review" : "rejected",
    proposalId: proposal.proposalId as string,
    snapshotSha256: sha256(snapshotRaw),
    proposalSha256: sha256(proposalRaw),
    declaredOrigin: proposal.source as Assessment["declaredOrigin"],
    hypothesis: proposal.hypothesis as string,
    rationale: proposal.rationale as string,
    changes: accepted ? deltas : [],
    proposedInput: accepted ? { ...original, ...requested } : null,
    rejectionReasons: reasons,
    reviewRequired: true,
    humanApproved: false,
    modelInvoked: false,
    hardwareDispatchAllowed: false,
    physicalMeasurement: false,
    scope: "educational_simulation_only",
    notice:
      "Model/source labels are unverified. No model, quantum device or physical " +
      "equipment was called. This is not scientific process validation.",
  };
}

/** Python renders floats like 20.0 / 0.05; reasons must read identically. */
function pyFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

/** Structural JSON equality (Python dict ==): key order irrelevant, 1 == 1.0. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    return a.length === other.length && a.every((item, i) => jsonEqual(item, other[i]));
  }
  const ak = Object.keys(a as Json);
  const bk = Object.keys(b as Json);
  return ak.length === bk.length &&
    ak.every((k) => Object.hasOwn(b as Json, k) && jsonEqual((a as Json)[k], (b as Json)[k]));
}

/** A *self-attested* human decision, not a digital signature or authentication. */
export function makeReview(
  snapshotRaw: Uint8Array,
  proposalRaw: Uint8Array,
  assessmentRaw: Uint8Array,
  { reviewerLabel, decision }: { reviewerLabel: string; decision: string },
): Review {
  const reviewer = text(reviewerLabel, "reviewer_label", 120);
  if (decision !== "approve" && decision !== "reject") {
    throw valueError("decision must be approve or reject");
  }
  const expected = makeAssessment(snapshotRaw, proposalRaw);
  const reported = decode(assessmentRaw, MAX_ASSESSMENT_BYTES, "assessment");
  if (!jsonEqual(reported, expected)) {
    throw valueError("assessment differs from recomputed source/proposal evidence");
  }
  if (decision === "approve" && expected.status !== "ready_for_review") {
    throw valueError("cannot approve a rejected assessment");
  }
  return {
    schemaVersion: REVIEW_VERSION,
    kind: "self_attested_educational_review",
    status: decision === "approve" ? "approved_for_manual_simulation" : "rejected_by_reviewer",
    reviewerLabel: reviewer,
    reviewerAuthenticated: false,
    snapshotSha256: expected.snapshotSha256,
    proposalSha256: expected.proposalSha256,
    assessmentSha256: sha256(assessmentRaw),
    simulationInput: decision === "approve" ? expected.proposedInput : null,
    automaticExecution: false,
    hardwareDispatchAllowed: false,
    notice:
      "Reviewer identity is self-declared, not authenticated; manual transfer to " +
      "the educational simulator only. No quantum or process hardware control.",
  };
}
