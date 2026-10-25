/**
 * CrystalPilot agent workflow:
 *   Scenario Reader → Experiment Planner → Research Gate → Review Gate →
 *   Experiment Runner → Independent Checker → Result Interpreter → Evidence.
 *
 * `proposeExperiment` runs on the server (it may call the live model through
 * the injected `complete` function). Review, simulation and interpretation
 * steps are pure and run wherever the state lives (the browser in the app).
 */
import { SCENARIOS } from "../../config/scenarios";
import type { SimulationInput } from "../types";
import type { InferenceRecord, PilotRun } from "./evidence";
import { proposalSourceFor } from "./evidence";
import {
  type Interpretation,
  deterministicInterpretation,
  finalVerdict,
  runApprovedExperiment,
} from "./experiment";
import { makeAssessment, makeReview } from "./gate";
import {
  type ChatMessage,
  type CompletionRecord,
  ProviderError,
} from "./nemotron";
import {
  type ExperimentHistoryItem,
  buildProposalMessages,
  buildProposalFromModel,
} from "./planner";
import { captureSnapshot } from "./snapshot";
import { sha256Text } from "./sha256";
import { encodeUtf8 } from "./strict-json";
import { JsonContractError } from "./strict-json";
import { currentState, startHistory, transition } from "./workflow";
import { findFixture, PLAUSIBLE_FIXTURES } from "./fixtures";
import { INJECTION_PROBE_NOTE } from "./fixtures";

export const DEFAULT_OBJECTIVE = "Improve the quality score without causing high risk.";
export const MAX_RAW_CONTENT = 16_000;

export type ProposeMode = "live" | "offline";

export interface ProposeRequest {
  mode: ProposeMode;
  scenarioId: string;
  input: SimulationInput;
  objective?: string;
  fixtureId?: string | null;
  probe?: boolean;
  history?: ExperimentHistoryItem[];
  parentRunId?: string | null;
  iteration?: number;
}

export type Completer = (messages: ChatMessage[]) => Promise<CompletionRecord>;

function newRunId(seed: string): string {
  return `run-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${sha256Text(seed + Math.random()).slice(0, 8)}`;
}

export function liveInferenceRecord(c: CompletionRecord, notes: string[] = []): InferenceRecord {
  const raw = c.content.slice(0, MAX_RAW_CONTENT);
  return {
    mode: "live_nebius",
    provider: "nebius-token-factory",
    baseUrlHost: c.baseUrlHost,
    requestedModel: c.requestedModel,
    responseModel: c.responseModel,
    responseId: c.responseId,
    latencyMs: c.latencyMs,
    attempts: c.attempts,
    usage: c.usage,
    estimatedCostUsd: c.estimatedCostUsd,
    jsonModeUsed: c.jsonModeUsed,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
    fixtureId: null,
    rawContent: raw,
    rawContentSha256: sha256Text(raw),
    notes: [...(c.content.length > MAX_RAW_CONTENT ? ["Model content truncated to 16,000 characters."] : []), ...notes],
    attestation: null,
  };
}

function offlineInferenceRecord(fixtureId: string, content: string): InferenceRecord {
  const now = new Date().toISOString();
  return {
    mode: "offline_fixture",
    provider: "offline",
    baseUrlHost: null,
    requestedModel: null,
    responseModel: null,
    responseId: null,
    latencyMs: null,
    attempts: 0,
    usage: null,
    estimatedCostUsd: null,
    jsonModeUsed: null,
    startedAt: now,
    finishedAt: now,
    fixtureId,
    rawContent: content,
    rawContentSha256: sha256Text(content),
    notes: ["OFFLINE DEMO: fixed fixture content, no model was called."],
    attestation: null,
  };
}

export async function proposeExperiment(req: ProposeRequest, complete: Completer | null): Promise<PilotRun> {
  const scenario = SCENARIOS.find((s) => s.id === req.scenarioId);
  if (!scenario) throw new Error("Unknown scenario.");
  const objective = (req.objective ?? DEFAULT_OBJECTIVE).trim().slice(0, 300) || DEFAULT_OBJECTIVE;
  // Scenario Reader: the server recomputes the baseline; it never trusts client metrics.
  const snap = captureSnapshot(req.input);
  const runId = newRunId(snap.sha256);
  const proposalId = `${runId}-p1`;
  let history = startHistory(`Baseline ${scenario.id} captured; snapshot sha256 ${snap.sha256.slice(0, 12)}…`);
  const run: PilotRun = {
    runId,
    parentRunId: req.parentRunId ?? null,
    iteration: Math.max(1, Math.min(20, Math.floor(req.iteration ?? 1))),
    scenarioId: scenario.id,
    scenarioName: scenario.name.en,
    objective,
    probe: Boolean(req.probe),
    snapshotText: snap.text,
    snapshotSha256: snap.sha256,
    inference: null,
    inferenceError: null,
    plannerRejection: null,
    proposalId,
    proposalText: null,
    proposalSha256: null,
    prediction: [],
    assessmentText: null,
    reviewText: null,
    experiment: null,
    interpretation: null,
    interpretationInference: null,
    history,
  };

  // Experiment Planner.
  if (req.mode === "live") {
    if (!complete) throw new ProviderError("missing_credentials", "Live inference is not configured.", null, 0, 0);
    const messages = buildProposalMessages({
      scenarioName: scenario.name.en,
      input: snap.result.input,
      summary: snap.result.summary as unknown as Record<string, number>,
      riskLevel: snap.result.summary.risk.level,
      objective,
      history: req.history,
      untrustedNote: req.probe ? INJECTION_PROBE_NOTE : undefined,
    });
    try {
      run.inference = liveInferenceRecord(await complete(messages));
    } catch (error) {
      const e = error instanceof ProviderError ? error : new ProviderError("provider_error", "Provider call failed.", null, 0, 0);
      run.inferenceError = { kind: e.kind, message: e.message };
      run.history = transition(history, "FAILED", `Planner call failed: ${e.kind}`);
      return run;
    }
    history = transition(history, "PROPOSED",
      `Live Nemotron output from ${run.inference.responseModel ?? run.inference.requestedModel} in ${run.inference.latencyMs} ms`);
  } else {
    const fixture = req.fixtureId ? findFixture(req.fixtureId) : PLAUSIBLE_FIXTURES[scenario.id];
    if (!fixture) throw new Error("Unknown offline fixture.");
    run.inference = offlineInferenceRecord(fixture.id, fixture.content);
    history = transition(history, "PROPOSED", `OFFLINE fixture ${fixture.id} (no model call)`);
  }

  const planned = buildProposalFromModel({
    content: run.inference.rawContent,
    proposalId,
    snapshotSha256: snap.sha256,
    source: proposalSourceFor(run.inference),
  });
  run.inference.notes.push(...planned.notes);
  if (!planned.ok) {
    run.plannerRejection = planned.reason;
    run.history = transition(history, "REJECTED", `Model-output contract: ${planned.reason}`);
    return run;
  }
  run.proposalText = planned.proposalText;
  run.proposalSha256 = sha256Text(planned.proposalText);
  run.prediction = planned.prediction;

  // Research Gate (TypeScript port of QFabric's orchestration module).
  try {
    const assessment = makeAssessment(encodeUtf8(snap.text), encodeUtf8(planned.proposalText));
    run.assessmentText = JSON.stringify(assessment, null, 2);
    if (assessment.status === "rejected") {
      run.history = transition(history, "REJECTED", `Research gate: ${assessment.rejectionReasons.join("; ")}`);
      return run;
    }
    history = transition(history, "VALIDATED", "Research gate: ready_for_review (not an approval)");
    run.history = transition(history, "AWAITING_REVIEW", "Waiting for explicit human decision");
  } catch (error) {
    const reason = error instanceof JsonContractError ? error.message : "gate refused the proposal";
    run.history = transition(history, "REJECTED", `Research gate refused: ${reason}`);
  }
  return run;
}

/** Review Gate. Approval requires the educational-use attestation. */
export function reviewRun(run: PilotRun, args: { reviewerLabel: string; decision: "approve" | "reject"; attestEducationalOnly: boolean }): PilotRun {
  if (currentState(run.history) !== "AWAITING_REVIEW") throw new Error("This run is not awaiting review.");
  if (args.decision === "approve" && !args.attestEducationalOnly) {
    throw new Error("Approval requires attesting educational, simulation-only use.");
  }
  const review = makeReview(encodeUtf8(run.snapshotText), encodeUtf8(run.proposalText!), encodeUtf8(run.assessmentText!), {
    reviewerLabel: args.reviewerLabel,
    decision: args.decision,
  });
  return {
    ...run,
    reviewText: JSON.stringify(review, null, 2),
    history: transition(run.history, args.decision === "approve" ? "APPROVED" : "REJECTED",
      `Self-attested ${args.decision} by '${review.reviewerLabel}' (not authenticated)`),
  };
}

/** Experiment Runner + Independent Checker. */
export function simulateRun(run: PilotRun): PilotRun {
  if (currentState(run.history) !== "APPROVED") throw new Error("Simulation requires an APPROVED run.");
  try {
    const experiment = runApprovedExperiment({
      snapshotText: run.snapshotText,
      proposalText: run.proposalText!,
      assessmentText: run.assessmentText!,
      reviewText: run.reviewText!,
      prediction: run.prediction,
    });
    const passed = experiment.checks.filter((c) => c.passed).length;
    return {
      ...run,
      experiment,
      history: transition(run.history, "SIMULATED", `Deterministic engine recomputed; ${passed}/${experiment.checks.length} checks passed`),
    };
  } catch (error) {
    return { ...run, history: transition(run.history, "FAILED", `Runner refused: ${error instanceof Error ? error.message : "error"}`) };
  }
}

/** Result Interpreter + final verdict. `interpretation` null → deterministic. */
export function finalizeRun(run: PilotRun, interpretation: Interpretation | null, interpretationInference: InferenceRecord | null = null): PilotRun {
  if (currentState(run.history) !== "SIMULATED" || !run.experiment) throw new Error("Finalize requires a SIMULATED run.");
  const changes = JSON.parse(run.proposalText!).changes as Record<string, number>;
  const chosen = interpretation ?? deterministicInterpretation(run.experiment, changes);
  const verdict = finalVerdict(run.experiment, chosen);
  return {
    ...run,
    interpretation: chosen,
    interpretationInference,
    history: transition(run.history, verdict.state, verdict.detail),
  };
}

/** Follow-up context from a completed run (validated results only). */
export function historyItem(run: PilotRun): ExperimentHistoryItem | null {
  if (!run.experiment) return null;
  return {
    changes: JSON.parse(run.proposalText!).changes,
    observed: Object.fromEntries(run.experiment.comparison.map((c) => [c.metric, Math.round(c.delta * 1000) / 1000])),
  };
}
