// LIVE smoke test against Nebius Token Factory (paid inference; never run in CI).
//
//   NEBIUS_API_KEY=... npm run live:smoke -- [--runs N] [--scenario unstable] [--approve-as "your name"] [--probe]
//
// 1. Lists /v1/models and reports the NVIDIA/Nemotron ids actually available.
// 2. Runs the real planner N times (max 10) and the deterministic gate.
// 3. Only with --approve-as (an explicit human decision) does it approve,
//    simulate and request a live interpretation for the first accepted run.
// Writes eval/results/live/live-smoke-<timestamp>.json plus evidence files.
import { mkdirSync, writeFileSync } from "node:fs";
import { SCENARIOS } from "../src/config/scenarios";
import { finalizeRun, liveInferenceRecord, proposeExperiment, reviewRun, simulateRun } from "../src/lib/pilot/agent";
import { buildEvidence, serializeEvidence, verifyEvidence } from "../src/lib/pilot/evidence";
import { buildInterpretationMessages, checkModelInterpretation } from "../src/lib/pilot/experiment";
import { ProviderError, chatCompletion, isNvidiaModel, listModels, loadConfig } from "../src/lib/pilot/nemotron";
import { unwrapModelContent } from "../src/lib/pilot/planner";
import { currentState } from "../src/lib/pilot/workflow";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const runs = Math.max(1, Math.min(10, Number(arg("--runs") ?? 1)));
const scenarioId = arg("--scenario") ?? "unstable";
const approver = arg("--approve-as");
const probe = process.argv.includes("--probe");
const scenario = SCENARIOS.find((s) => s.id === scenarioId);
if (!scenario) throw new Error(`unknown scenario ${scenarioId}`);

const config = loadConfig();
if (!config.apiKey) {
  console.error("LIVE INFERENCE UNVERIFIED: NEBIUS_API_KEY is not set. Nothing was called.");
  process.exit(2);
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = "eval/results/live";
mkdirSync(dir, { recursive: true });

const report: Record<string, unknown> = {
  schemaVersion: "crystalpilot-live-smoke/1",
  startedAt: new Date().toISOString(),
  baseUrlHost: new URL(config.baseUrl).host,
  proposeModel: config.proposeModel,
  interpretModel: config.interpretModel,
  scenario: scenarioId,
  probe,
};

try {
  const ids = await listModels(config);
  const nvidia = ids.filter(isNvidiaModel);
  report.models = { total: ids.length, nvidia };
  console.log(`Provider lists ${ids.length} models; NVIDIA/Nemotron: ${nvidia.join(", ") || "none"}`);
  if (!ids.includes(config.proposeModel)) console.warn(`WARNING: configured model ${config.proposeModel} is not in /v1/models.`);
} catch (e) {
  report.models = { error: e instanceof ProviderError ? `${e.kind}: ${e.message}` : String(e) };
  console.warn("Model listing failed:", report.models);
}

const attempts = [];
let accepted = null;
for (let i = 0; i < runs; i++) {
  const run = await proposeExperiment(
    { mode: "live", scenarioId, input: { ...scenario.input }, probe },
    (messages) => chatCompletion(config, config.proposeModel, messages),
  );
  const state = currentState(run.history);
  attempts.push({
    state,
    reason: run.history.at(-1)!.detail,
    responseModel: run.inference?.responseModel ?? null,
    responseId: run.inference?.responseId ?? null,
    latencyMs: run.inference?.latencyMs ?? null,
    attempts: run.inference?.attempts ?? null,
    usage: run.inference?.usage ?? null,
    error: run.inferenceError,
  });
  console.log(`#${i + 1} ${state} · ${run.inference?.responseModel ?? "-"} · ${run.inference?.latencyMs ?? "-"} ms · ${run.history.at(-1)!.detail}`);
  writeFileSync(`${dir}/evidence-${stamp}-${i + 1}.json`, serializeEvidence(buildEvidence(run)));
  if (state === "AWAITING_REVIEW" && !accepted) accepted = run;
}
const lat = attempts.map((a) => a.latencyMs).filter((x): x is number => x !== null).sort((a, b) => a - b);
report.proposals = {
  runs,
  awaitingReview: attempts.filter((a) => a.state === "AWAITING_REVIEW").length,
  rejected: attempts.filter((a) => a.state === "REJECTED").length,
  failed: attempts.filter((a) => a.state === "FAILED").length,
  latencyMs: lat.length ? { min: lat[0], median: lat[Math.floor(lat.length / 2)], max: lat.at(-1) } : null,
  promptTokens: attempts.reduce((s, a) => s + (a.usage?.promptTokens ?? 0), 0),
  completionTokens: attempts.reduce((s, a) => s + (a.usage?.completionTokens ?? 0), 0),
  attempts,
};

if (accepted && approver) {
  let done = simulateRun(reviewRun(accepted, { reviewerLabel: approver, decision: "approve", attestEducationalOnly: true }));
  const proposal = JSON.parse(done.proposalText!);
  const completion = await chatCompletion(config, config.interpretModel,
    buildInterpretationMessages(done.experiment!, proposal.hypothesis, proposal.changes));
  let interpretation = null;
  try {
    interpretation = checkModelInterpretation(completion.content, done.experiment!, (c) => unwrapModelContent(c).text);
  } catch (e) {
    console.warn("Interpretation rejected:", (e as Error).message);
  }
  done = finalizeRun(done, interpretation, liveInferenceRecord(completion));
  const file = `${dir}/evidence-${stamp}-completed.json`;
  writeFileSync(file, serializeEvidence(buildEvidence(done)));
  report.completed = {
    finalState: currentState(done.history),
    contradictions: interpretation?.contradictions ?? null,
    interpretationLatencyMs: completion.latencyMs,
    evidence: file,
    verification: verifyEvidence(serializeEvidence(buildEvidence(done))).overall,
  };
  console.log(`Completed: ${currentState(done.history)} · evidence ${file}`);
} else if (accepted) {
  console.log("Stopped at AWAITING_REVIEW. Re-run with --approve-as \"<name>\" to approve, simulate and interpret.");
}
report.finishedAt = new Date().toISOString();
const out = `${dir}/live-smoke-${stamp}.json`;
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(`Report: ${out}`);
