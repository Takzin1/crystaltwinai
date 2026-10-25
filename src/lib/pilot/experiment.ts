/**
 * Experiment Runner, Independent Checker and Result Interpreter.
 *
 * The runner refuses to simulate anything that is not backed by a review
 * record which recomputes (via the gate port) from the exact snapshot,
 * proposal and assessment bytes. All numbers below come from the
 * deterministic educational engine; none are measurements.
 */
import { runSimulation } from "../engine";
import type { SimulationInput, SimulationResult } from "../types";
import { canonicalSha256 } from "./canonical";
import { type Review, jsonEqual, makeReview } from "./gate";
import { DIRECTIONS, type Direction, type Prediction } from "./planner";
import { SUMMARY_METRICS, type SummaryMetric, pickSummary, serializeSnapshot } from "./snapshot";
import { encodeUtf8, parseStrictJson } from "./strict-json";

export interface MetricComparison {
  metric: SummaryMetric;
  before: number;
  after: number;
  delta: number;
  direction: Direction;
}

export interface Check {
  id: string;
  passed: boolean;
  detail: string;
}

export interface PredictionCheck extends Prediction {
  observed: Direction;
  outcome: "confirmed" | "contradicted";
}

export interface ExperimentOutcome {
  approvedInput: Record<string, number>;
  baselineSummary: Record<SummaryMetric, number>;
  resultSummary: Record<SummaryMetric, number>;
  baselineRisk: string;
  resultRisk: string;
  comparison: MetricComparison[];
  checks: Check[];
  predictionChecks: PredictionCheck[];
  resultSha256: string;
}

/** Relative tolerance used to call a change "no_change". */
export function directionOf(before: number, after: number): Direction {
  const delta = after - before;
  const tolerance = 1e-9 + 1e-6 * Math.abs(before);
  if (Math.abs(delta) <= tolerance) return "no_change";
  return delta > 0 ? "increase" : "decrease";
}

export function compare(before: SimulationResult, after: SimulationResult): MetricComparison[] {
  const b = pickSummary(before);
  const a = pickSummary(after);
  return SUMMARY_METRICS.map((metric) => ({
    metric,
    before: b[metric],
    after: a[metric],
    delta: a[metric] - b[metric],
    direction: directionOf(b[metric], a[metric]),
  }));
}

export class ReviewRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewRequiredError";
  }
}

/**
 * Runs the approved experiment. Throws ReviewRequiredError unless `reviewText`
 * is an approval that the gate recomputes byte-for-byte.
 */
export function runApprovedExperiment(args: {
  snapshotText: string;
  proposalText: string;
  assessmentText: string;
  reviewText: string;
  prediction: Prediction[];
}): ExperimentOutcome {
  let claimed: unknown;
  try {
    claimed = parseStrictJson(args.reviewText, "review");
  } catch {
    throw new ReviewRequiredError("A valid review record is required before simulation.");
  }
  const reviewObj = claimed as Review;
  if (!reviewObj || reviewObj.status !== "approved_for_manual_simulation") {
    throw new ReviewRequiredError("Simulation requires an explicit human approval.");
  }
  let recomputed: Review;
  try {
    recomputed = makeReview(
      encodeUtf8(args.snapshotText),
      encodeUtf8(args.proposalText),
      encodeUtf8(args.assessmentText),
      { reviewerLabel: reviewObj.reviewerLabel, decision: "approve" },
    );
  } catch (error) {
    throw new ReviewRequiredError(
      `Approval does not match the recorded evidence: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
  if (!jsonEqual(recomputed, claimed) || !recomputed.simulationInput) {
    throw new ReviewRequiredError("Approval record differs from the recomputed review.");
  }

  const baselineDoc = JSON.parse(args.snapshotText) as { input: SimulationInput };
  const baseline = runSimulation(baselineDoc.input);
  const approvedInput = recomputed.simulationInput as SimulationInput;
  const result = runSimulation(approvedInput);
  const replay = runSimulation({ ...approvedInput });

  const checks: Check[] = [];
  const add = (id: string, passed: boolean, detail: string) => checks.push({ id, passed, detail });

  add("baseline_replay", serializeSnapshot(baseline) === args.snapshotText,
    "Re-running the baseline input reproduces the hashed snapshot byte-for-byte.");
  const resultHash = canonicalSha256({ series: result.series, summary: result.summary });
  add("deterministic_replay",
    resultHash === canonicalSha256({ series: replay.series, summary: replay.summary }),
    "Two independent runs of the approved input produce identical canonical output.");
  const changed = Object.keys(approvedInput).filter(
    (k) => approvedInput[k as keyof SimulationInput] !== baselineDoc.input[k as keyof SimulationInput],
  );
  const approvedChanges = Object.keys(JSON.parse(args.proposalText).changes ?? {});
  add("only_approved_parameters_changed",
    changed.every((k) => approvedChanges.includes(k)) && changed.length > 0,
    `Changed parameters: ${changed.join(", ") || "none"}; approved: ${approvedChanges.join(", ")}.`);
  const values = result.series.flatMap((row) => Object.values(row));
  add("finite_outputs", values.every((v) => typeof v === "number" && Number.isFinite(v)) &&
    Object.values(pickSummary(result)).every(Number.isFinite),
    "Every trajectory value and summary metric is a finite number.");
  add("trajectory_length", result.series.length === approvedInput.timeSteps,
    `Trajectory has ${result.series.length} rows for timeSteps=${approvedInput.timeSteps}.`);
  const s = result.summary;
  add("score_bounds",
    [s.stabilityScore, s.qualityScore, s.finalYield].every((v) => v >= 0 && v <= 100) &&
      s.avgGrowthRate >= 0 && s.nucleationEvents >= 0,
    "Scores and yield stay within 0–100; growth and nucleation counts are non-negative.");
  add("engine_invariant_cooling_monotone",
    result.series.every((row, i) => i === 0 || row.temperature <= result.series[i - 1].temperature),
    "Engine invariant: the cooling profile never increases temperature.");
  add("engine_invariant_mass_balance",
    result.series.every((row, i) => row.concentration >= 0 &&
      (i === 0 || row.crystalYield >= result.series[i - 1].crystalYield)),
    "Engine invariant: concentration stays non-negative and yield never decreases.");

  const comparison = compare(baseline, result);
  const byMetric = new Map(comparison.map((c) => [c.metric, c]));
  const predictionChecks: PredictionCheck[] = args.prediction.map((p) => {
    const observed = byMetric.get(p.metric)!.direction;
    return { ...p, observed, outcome: observed === p.direction ? "confirmed" : "contradicted" };
  });

  return {
    approvedInput,
    baselineSummary: pickSummary(baseline),
    resultSummary: pickSummary(result),
    baselineRisk: baseline.summary.risk.level,
    resultRisk: result.summary.risk.level,
    comparison,
    checks,
    predictionChecks,
    resultSha256: resultHash,
  };
}

// ---------------------------------------------------------------- interpretation

export interface Interpretation {
  origin: "deterministic" | "live_model";
  summary: string;
  claims: { metric: SummaryMetric; direction: Direction }[];
  caveats: string[];
  followUpIdea: string | null;
  contradictions: string[];
  overclaimWarnings: string[];
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3));

/** Restrained, rule-based summary; used offline and as a reference for model output. */
export function deterministicInterpretation(outcome: ExperimentOutcome, changes: Record<string, number>): Interpretation {
  const changed = Object.entries(changes).map(([k, v]) => `${k}→${v}`).join(", ");
  const moved = outcome.comparison.filter((c) => c.direction !== "no_change");
  const parts = moved.map((c) => `${c.metric} ${c.direction === "increase" ? "rose" : "fell"} from ${fmt(c.before)} to ${fmt(c.after)}`);
  const confirmed = outcome.predictionChecks.filter((p) => p.outcome === "confirmed").length;
  const summary =
    `In the educational simulation, setting ${changed} ` +
    (parts.length ? `changed ${parts.length} metric(s): ${parts.join("; ")}.` : "did not change any summary metric.") +
    (outcome.predictionChecks.length
      ? ` ${confirmed}/${outcome.predictionChecks.length} predicted directions matched the simulator.`
      : "");
  return {
    origin: "deterministic",
    summary,
    claims: outcome.comparison.map((c) => ({ metric: c.metric, direction: c.direction })),
    caveats: [
      "Simplified pedagogical model; results are not laboratory measurements.",
      "A matching prediction shows consistency with this model only, not physical validity.",
    ],
    followUpIdea: null,
    contradictions: [],
    overclaimWarnings: [],
  };
}

export function buildInterpretationMessages(outcome: ExperimentOutcome, hypothesis: string, changes: Record<string, number>) {
  const facts = {
    hypothesis,
    appliedChanges: changes,
    comparison: outcome.comparison.map((c) => ({
      metric: c.metric, before: Number(fmt(c.before)), after: Number(fmt(c.after)), direction: c.direction,
    })),
    predictionChecks: outcome.predictionChecks,
    riskBefore: outcome.baselineRisk,
    riskAfter: outcome.resultRisk,
  };
  return [
    {
      role: "system" as const,
      content: [
        "You interpret results from an EDUCATIONAL crystallization simulator (simplified model, not validated).",
        "Use only the computed facts provided. Do not invent mechanisms, measurements, or industrial significance.",
        "Reply with ONLY a JSON object:",
        '{"summary": string (<= 500 chars), "claims": [{"metric": string, "direction": "increase"|"decrease"|"no_change"}],',
        ' "caveats": [string, ... at most 3], "followUpIdea": string (<= 200 chars) or null}',
        "Every claim will be checked against the computed comparison; contradictions are flagged.",
      ].join("\n"),
    },
    { role: "user" as const, content: `COMPUTED FACTS:\n${JSON.stringify(facts, null, 2)}` },
  ];
}

const OVERCLAIMS: [RegExp, string][] = [
  [/\bprov(e|es|ed|en)\b/i, "uses 'prove' for a simulation result"],
  [/\b(scientifically )?validated\b/i, "claims validation"],
  [/\bmeasur(ed|ement)s?\b/i, "refers to measurements"],
  [/\b(industrial|plant|reactor|production)[- ]scale\b|\bin production\b/i, "implies industrial applicability"],
  [/\bguarantee[sd]?\b/i, "uses guarantee language"],
  [/\bsafe to (run|operate)\b/i, "implies operational safety"],
];

export function overclaimWarnings(text: string): string[] {
  return OVERCLAIMS.filter(([re]) => re.test(text)).map(([, why]) => why);
}

/** Parses model interpretation strictly and checks each claim against the numbers. */
export function checkModelInterpretation(content: string, outcome: ExperimentOutcome, unwrap: (c: string) => string): Interpretation {
  const parsed = parseStrictJson(unwrap(content), "interpretation");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("interpretation must be a JSON object");
  const doc = parsed as Record<string, unknown>;
  const summary = typeof doc.summary === "string" ? doc.summary.slice(0, 600) : "";
  if (!summary.trim()) throw new Error("interpretation summary is missing");
  const byMetric = new Map(outcome.comparison.map((c) => [c.metric as string, c]));
  const claims: Interpretation["claims"] = [];
  const contradictions: string[] = [];
  for (const raw of Array.isArray(doc.claims) ? doc.claims.slice(0, 12) : []) {
    const c = raw as Record<string, unknown>;
    if (typeof c?.metric !== "string" || typeof c?.direction !== "string") continue;
    const actual = byMetric.get(c.metric);
    if (!actual) {
      contradictions.push(`claims a metric the simulator does not report: ${c.metric.slice(0, 40)}`);
      continue;
    }
    if (!(DIRECTIONS as readonly string[]).includes(c.direction)) {
      contradictions.push(`${c.metric}: unknown direction '${c.direction.slice(0, 20)}'`);
      continue;
    }
    claims.push({ metric: actual.metric, direction: c.direction as Direction });
    if (c.direction !== actual.direction) {
      contradictions.push(`${c.metric}: model says ${c.direction}, simulator computed ${actual.direction}`);
    }
  }
  const caveats = Array.isArray(doc.caveats)
    ? doc.caveats.filter((x): x is string => typeof x === "string").slice(0, 3).map((x) => x.slice(0, 300))
    : [];
  const followUpIdea = typeof doc.followUpIdea === "string" ? doc.followUpIdea.slice(0, 200) : null;
  return {
    origin: "live_model",
    summary,
    claims,
    caveats,
    followUpIdea,
    contradictions,
    overclaimWarnings: overclaimWarnings([summary, ...caveats, followUpIdea ?? ""].join(" ")),
  };
}

/** SIMULATED → VERIFIED | INCONCLUSIVE | FAILED. */
export function finalVerdict(outcome: ExperimentOutcome, interpretation: Interpretation | null): {
  state: "VERIFIED" | "INCONCLUSIVE" | "FAILED";
  detail: string;
} {
  const failed = outcome.checks.filter((c) => !c.passed);
  if (failed.length) return { state: "FAILED", detail: `Failed checks: ${failed.map((c) => c.id).join(", ")}` };
  if (outcome.comparison.every((c) => c.direction === "no_change")) {
    return { state: "INCONCLUSIVE", detail: "No summary metric changed; the experiment is uninformative." };
  }
  if (interpretation && interpretation.contradictions.length) {
    return { state: "INCONCLUSIVE", detail: `Interpretation contradicts computed results (${interpretation.contradictions.length}).` };
  }
  return { state: "VERIFIED", detail: `All ${outcome.checks.length} checks and deterministic replay passed (computational verification only).` };
}
