/**
 * Evidence Recorder + Verification Runner for `crystalpilot-evidence/1`.
 *
 * The integrity digest proves the file has not changed since export
 * (FILE INTEGRITY). It does NOT prove who produced it or that a live model
 * was called (that would need authenticated provenance; see the optional
 * server attestation, checked by /api/pilot/attest).
 */
import { canonicalSha256 } from "./canonical";
import {
  type Interpretation,
  type ExperimentOutcome,
  deterministicInterpretation,
  runApprovedExperiment,
} from "./experiment";
import { jsonEqual, makeAssessment, makeReview, parseSnapshot } from "./gate";
import { type Prediction, type ProposalSource, buildProposalFromModel } from "./planner";
import { APP_NAME, APP_VERSION, engineFingerprint } from "./snapshot";
import { sha256Text } from "./sha256";
import { encodeUtf8, parseStrictJson } from "./strict-json";
import { type StateEntry, checkHistory, currentState } from "./workflow";

export const EVIDENCE_VERSION = "crystalpilot-evidence/1";
export const MAX_EVIDENCE_BYTES = 1024 * 1024;

export interface Attestation {
  alg: "HMAC-SHA256";
  keyId: string;
  mac: string;
}

export interface InferenceRecord {
  mode: "live_nebius" | "offline_fixture";
  provider: "nebius-token-factory" | "offline";
  baseUrlHost: string | null;
  requestedModel: string | null;
  responseModel: string | null;
  responseId: string | null;
  latencyMs: number | null;
  attempts: number;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null;
  estimatedCostUsd: number | null;
  jsonModeUsed: boolean | null;
  startedAt: string;
  finishedAt: string;
  fixtureId: string | null;
  rawContent: string;
  rawContentSha256: string;
  notes: string[];
  attestation: Attestation | null;
}

export interface PilotRun {
  runId: string;
  parentRunId: string | null;
  iteration: number;
  scenarioId: string;
  scenarioName: string;
  objective: string;
  probe: boolean;
  snapshotText: string;
  snapshotSha256: string;
  inference: InferenceRecord | null;
  inferenceError: { kind: string; message: string } | null;
  plannerRejection: string | null;
  proposalId: string;
  proposalText: string | null;
  proposalSha256: string | null;
  prediction: Prediction[];
  assessmentText: string | null;
  reviewText: string | null;
  experiment: ExperimentOutcome | null;
  interpretation: Interpretation | null;
  interpretationInference: InferenceRecord | null;
  history: StateEntry[];
}

export interface EvidenceDocument {
  schemaVersion: typeof EVIDENCE_VERSION;
  kind: "crystalpilot_experiment_evidence";
  body: {
    app: { name: string; version: string; engineFingerprint: string };
    exportedAt: string;
    run: PilotRun;
    limitations: string[];
  };
  integrity: {
    algorithm: "sha256/canonical-json";
    bodySha256: string;
    scope: "file_integrity_only";
    notice: string;
  };
}

export const EVIDENCE_LIMITATIONS = [
  "Results come from CrystalTwinAI's simplified educational model, not laboratory measurements.",
  "Parameter bounds are educational model input limits, not physical safety limits.",
  "Reviewer identity is self-declared; approval is not authenticated.",
  "The integrity digest proves byte consistency since export, not authorship or live inference.",
  "No quantum hardware, QICK execution, GPU acceleration or process equipment was involved.",
];

export function proposalSourceFor(inference: Pick<InferenceRecord, "mode" | "requestedModel" | "responseModel">): ProposalSource {
  return inference.mode === "live_nebius"
    ? {
        origin: "unverified_model",
        providerLabel: "nebius-token-factory",
        modelLabel: (inference.responseModel ?? inference.requestedModel ?? "unknown").slice(0, 120),
      }
    : { origin: "synthetic_fixture", providerLabel: "offline", modelLabel: "none" };
}

export function buildEvidence(run: PilotRun, exportedAt = new Date().toISOString()): EvidenceDocument {
  const body = {
    app: { name: APP_NAME, version: APP_VERSION, engineFingerprint: engineFingerprint() },
    exportedAt,
    run,
    limitations: EVIDENCE_LIMITATIONS,
  };
  return {
    schemaVersion: EVIDENCE_VERSION,
    kind: "crystalpilot_experiment_evidence",
    body,
    integrity: {
      algorithm: "sha256/canonical-json",
      bodySha256: canonicalSha256(body),
      scope: "file_integrity_only",
      notice: "Detects modification after export. Not a signature; does not authenticate the producer.",
    },
  };
}

export function serializeEvidence(doc: EvidenceDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

export type CheckStatus = "pass" | "fail" | "warn" | "skip";
export interface VerificationCheck {
  id: string;
  status: CheckStatus;
  detail: string;
}
export interface VerificationReport {
  overall: "PASS" | "FAIL";
  integrity: "VERIFIED" | "MISMATCH" | "UNREADABLE";
  checks: VerificationCheck[];
  run: PilotRun | null;
  notice: string;
}

const NOTICE =
  "File-integrity and deterministic-replay checks only. Passing does not authenticate the producer, " +
  "prove a live model call, or validate any scientific claim.";

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function verifyEvidence(text: string, options: { replay?: boolean } = {}): VerificationReport {
  const checks: VerificationCheck[] = [];
  const add = (id: string, status: CheckStatus, detail: string) => checks.push({ id, status, detail });
  const done = (integrity: VerificationReport["integrity"], run: PilotRun | null): VerificationReport => ({
    overall: checks.some((c) => c.status === "fail") ? "FAIL" : "PASS",
    integrity,
    checks,
    run,
    notice: NOTICE,
  });

  if (encodeUtf8(text).length > MAX_EVIDENCE_BYTES) {
    add("size", "fail", "Evidence exceeds 1 MiB.");
    return done("UNREADABLE", null);
  }
  let doc: EvidenceDocument;
  try {
    doc = parseStrictJson(text, "evidence") as EvidenceDocument;
  } catch (error) {
    add("parse", "fail", errorText(error));
    return done("UNREADABLE", null);
  }
  if (!doc || doc.schemaVersion !== EVIDENCE_VERSION || doc.kind !== "crystalpilot_experiment_evidence" ||
      !doc.body || !doc.integrity || typeof doc.body.run !== "object" || doc.body.run === null) {
    add("schema", "fail", "Not a crystalpilot-evidence/1 document.");
    return done("UNREADABLE", null);
  }
  add("schema", "pass", "Recognised crystalpilot-evidence/1 document.");

  let integrity: VerificationReport["integrity"] = "MISMATCH";
  try {
    const actual = canonicalSha256(doc.body);
    if (actual === doc.integrity.bodySha256) {
      integrity = "VERIFIED";
      add("integrity", "pass", `Canonical body SHA-256 matches (${actual.slice(0, 16)}…).`);
    } else {
      add("integrity", "fail", `Body SHA-256 mismatch: recorded ${String(doc.integrity.bodySha256).slice(0, 16)}…, computed ${actual.slice(0, 16)}…. The file was modified after export.`);
    }
  } catch (error) {
    add("integrity", "fail", `Body cannot be canonicalised: ${errorText(error)}`);
  }

  const run = doc.body.run;
  const guard = (id: string, fn: () => void) => {
    try {
      fn();
    } catch (error) {
      add(id, "fail", errorText(error));
    }
  };

  guard("snapshot_hash", () => {
    if (sha256Text(run.snapshotText) !== run.snapshotSha256) throw new Error("Snapshot SHA-256 does not match the embedded snapshot bytes.");
    parseSnapshot(encodeUtf8(run.snapshotText));
    add("snapshot_hash", "pass", "Embedded snapshot matches its SHA-256 and passes the gate's snapshot contract.");
  });

  guard("history", () => {
    const problem = checkHistory(run.history);
    if (problem) throw new Error(problem);
    const states = run.history.map((h) => h.state);
    const expectArtifact = (state: string, present: boolean, what: string) => {
      if (states.includes(state as never) !== present) throw new Error(`State ${state} ${present ? "requires" : "is missing while"} ${what}.`);
    };
    expectArtifact("APPROVED", run.reviewText !== null && JSON.parse(run.reviewText).status === "approved_for_manual_simulation", "an approval record");
    expectArtifact("SIMULATED", run.experiment !== null, "an experiment outcome");
    add("history", "pass", `Valid transitions ending in ${currentState(run.history)}.`);
  });

  if (run.inference) {
    const inf = run.inference;
    guard("inference_record", () => {
      if (sha256Text(inf.rawContent) !== inf.rawContentSha256) throw new Error("Recorded model content does not match its SHA-256.");
      if (inf.mode === "live_nebius") {
        if (inf.provider !== "nebius-token-factory" || inf.fixtureId !== null || !inf.requestedModel) {
          throw new Error("Live inference record is internally inconsistent.");
        }
        add("inference_record", inf.attestation ? "pass" : "warn",
          `Self-reported LIVE call to ${inf.responseModel ?? inf.requestedModel} (response id ${inf.responseId ?? "none"}). ` +
          (inf.attestation ? "Server attestation present — check it with /api/pilot/attest." : "No server attestation: provenance is unauthenticated."));
      } else {
        if (inf.provider !== "offline" || !inf.fixtureId) throw new Error("Offline record must name its fixture.");
        add("inference_record", "pass", `OFFLINE fixture ${inf.fixtureId}; no model was called.`);
      }
    });
    guard("planner_replay", () => {
      const replay = buildProposalFromModel({
        content: inf.rawContent,
        proposalId: run.proposalId,
        snapshotSha256: run.snapshotSha256,
        source: proposalSourceFor(inf),
      });
      const same = replay.ok
        ? replay.proposalText === run.proposalText && jsonEqual(replay.prediction, run.prediction)
        : replay.reason === run.plannerRejection && run.proposalText === null;
      if (!same) throw new Error("Recorded proposal does not follow from the recorded model content.");
      add("planner_replay", "pass", replay.ok
        ? "Proposal is reproduced exactly from the recorded model content."
        : `Model-output rejection reproduced: ${replay.reason}`);
    });
  } else {
    add("inference_record", run.inferenceError ? "pass" : "fail",
      run.inferenceError ? `No inference: ${run.inferenceError.kind}.` : "Missing inference record.");
  }

  if (run.proposalText !== null) {
    guard("gate_recompute", () => {
      if (sha256Text(run.proposalText!) !== run.proposalSha256) throw new Error("Proposal SHA-256 mismatch.");
      let expected: unknown;
      try {
        expected = makeAssessment(encodeUtf8(run.snapshotText), encodeUtf8(run.proposalText!));
      } catch (error) {
        if (run.assessmentText === null && currentState(run.history) === "REJECTED") {
          add("gate_recompute", "pass", `Gate refusal reproduced: ${errorText(error)}`);
          return;
        }
        throw error;
      }
      if (run.assessmentText === null || !jsonEqual(expected, JSON.parse(run.assessmentText))) {
        throw new Error("Recorded assessment differs from the recomputed gate result.");
      }
      add("gate_recompute", "pass", `Gate result reproduced: ${(expected as { status: string }).status}.`);
    });
  }

  if (run.reviewText !== null) {
    guard("review_recompute", () => {
      const claimed = JSON.parse(run.reviewText!);
      const decision = claimed.status === "approved_for_manual_simulation" ? "approve" : "reject";
      const expected = makeReview(encodeUtf8(run.snapshotText), encodeUtf8(run.proposalText!), encodeUtf8(run.assessmentText!), {
        reviewerLabel: claimed.reviewerLabel, decision,
      });
      if (!jsonEqual(expected, claimed)) throw new Error("Review record differs from recomputation.");
      add("review_recompute", "pass", `Self-attested ${decision} by '${expected.reviewerLabel}' recomputes (not authenticated).`);
    });
  }

  if (run.experiment !== null) {
    if (options.replay === false) {
      add("simulation_replay", "skip", "Replay disabled.");
    } else {
      guard("simulation_replay", () => {
        const replay = runApprovedExperiment({
          snapshotText: run.snapshotText,
          proposalText: run.proposalText!,
          assessmentText: run.assessmentText!,
          reviewText: run.reviewText!,
          prediction: run.prediction,
        });
        if (!jsonEqual(replay, run.experiment)) throw new Error("Re-running the simulation does not reproduce the recorded results.");
        add("simulation_replay", "pass", "Baseline and approved experiment re-simulated; results identical.");
        if (run.interpretation?.origin === "deterministic") {
          const changes = JSON.parse(run.proposalText!).changes;
          if (!jsonEqual(deterministicInterpretation(replay, changes), run.interpretation)) {
            throw new Error("Deterministic interpretation does not reproduce.");
          }
        }
      });
    }
  }

  const fp = doc.body.app?.engineFingerprint;
  add("engine_fingerprint", fp === engineFingerprint() ? "pass" : "warn",
    fp === engineFingerprint() ? "Exported by the same engine version as this verifier."
      : "Engine fingerprint differs; replay differences may be due to an engine change.");

  return done(integrity, run);
}
