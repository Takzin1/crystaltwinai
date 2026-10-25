// CrystalPilot offline evaluation harness. Deterministic; no network, no model.
// Usage: npm run eval [-- --out eval/results/offline-eval.json]
// Live-model metrics are NOT produced here; see scripts/live-smoke.mts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SCENARIOS } from "../src/config/scenarios";
import { runSimulation } from "../src/lib/engine";
import { finalizeRun, proposeExperiment, reviewRun, simulateRun } from "../src/lib/pilot/agent";
import { canonicalSha256 } from "../src/lib/pilot/canonical";
import { buildEvidence, serializeEvidence, verifyEvidence, type EvidenceDocument } from "../src/lib/pilot/evidence";
import { ADVERSARIAL_FIXTURES, PLAUSIBLE_FIXTURES } from "../src/lib/pilot/fixtures";
import { ProviderError, chatCompletion, loadConfig } from "../src/lib/pilot/nemotron";
import { engineFingerprint } from "../src/lib/pilot/snapshot";
import type { SimulationInput } from "../src/lib/types";
import { currentState } from "../src/lib/pilot/workflow";

const outIndex = process.argv.indexOf("--out");
const out = outIndex > 0 ? process.argv[outIndex + 1] : "eval/results/offline-eval.json";
const input = (id: string) => ({ ...SCENARIOS.find((s) => s.id === id)!.input });
const approve = (r: Awaited<ReturnType<typeof proposeExperiment>>) =>
  reviewRun(r, { reviewerLabel: "eval", decision: "approve", attestEducationalOnly: true });
const golden = JSON.parse(readFileSync(new URL("../tests/fixtures/qfabric-gate-golden.json", import.meta.url), "utf8"));

// 1. Safe workflow completion over all scenarios (offline fixtures).
const completion = [];
for (const s of SCENARIOS) {
  const t0 = performance.now();
  const proposed = await proposeExperiment({ mode: "offline", scenarioId: s.id, input: input(s.id) }, null);
  const done = finalizeRun(simulateRun(approve(proposed)), null);
  const ms = performance.now() - t0;
  const report = verifyEvidence(serializeEvidence(buildEvidence(done)));
  completion.push({
    scenario: s.id,
    fixture: PLAUSIBLE_FIXTURES[s.id].id,
    finalState: currentState(done.history),
    checksPassed: done.experiment!.checks.filter((c) => c.passed).length,
    checksTotal: done.experiment!.checks.length,
    predictionsConfirmed: done.experiment!.predictionChecks.filter((p) => p.outcome === "confirmed").length,
    predictionsTotal: done.experiment!.predictionChecks.length,
    evidenceVerification: report.overall,
    localPipelineMs: Math.round(ms * 10) / 10,
  });
}

// 2. Adversarial rejection: gated pipeline vs a naive "parse and apply" wrapper.
function naiveWrapper(content: string, base: SimulationInput): "executed" | "crashed" {
  try {
    const obj = JSON.parse(content);
    runSimulation({ ...base, ...(obj.changes ?? {}) });
    return "executed";
  } catch {
    return "crashed";
  }
}
const adversarial = [];
for (const f of ADVERSARIAL_FIXTURES) {
  const run = await proposeExperiment({ mode: "offline", scenarioId: "edu-default", input: input("edu-default"), fixtureId: f.id }, null);
  adversarial.push({
    fixture: f.id,
    gated: currentState(run.history),
    simulated: run.experiment !== null,
    reason: run.history.at(-1)!.detail,
    naiveWrapper: naiveWrapper(f.content, input("edu-default")),
  });
}

// 3. Gate fidelity against the Python golden cases (counts only; equality is in npm test).
const goldenOutcomes = golden.assessments.map((c: { expected: { ok: boolean; value?: { status: string } } }) =>
  c.expected.ok ? c.expected.value!.status : "refused");

// 4. Evidence mutation test: change every leaf of the body once.
const base = buildEvidence(finalizeRun(simulateRun(approve(
  await proposeExperiment({ mode: "offline", scenarioId: "unstable", input: input("unstable") }, null))), null),
"2026-10-25T00:00:00.000Z");
type Path = (string | number)[];
const leaves: Path[] = [];
(function walk(v: unknown, p: Path) {
  if (v !== null && typeof v === "object") {
    for (const [k, child] of Object.entries(v)) walk(child, [...p, Array.isArray(v) ? Number(k) : k]);
  } else leaves.push(p);
})(base.body, []);
function mutate(doc: EvidenceDocument, p: Path) {
  let node: Record<string | number, unknown> = doc.body as never;
  for (const k of p.slice(0, -1)) node = node[k] as never;
  const k = p.at(-1)!;
  const v = node[k];
  node[k] = typeof v === "number" ? v + 1 : typeof v === "boolean" ? !v : typeof v === "string" ? v + "x" : v === null ? "x" : v;
}
let integrityDetected = 0;
let semanticDetected = 0;
const semanticMisses: string[] = [];
for (const p of leaves) {
  const copy = structuredClone(base);
  mutate(copy, p);
  if (verifyEvidence(serializeEvidence(copy)).integrity !== "VERIFIED") integrityDetected++;
  // Attacker also recomputes the digest: only semantic checks remain.
  copy.integrity.bodySha256 = canonicalSha256(copy.body);
  if (verifyEvidence(serializeEvidence(copy)).overall === "FAIL") semanticDetected++;
  else semanticMisses.push(p.join("."));
}
const missGroups: Record<string, number> = {};
for (const m of semanticMisses) {
  const key = m.replace(/\.\d+(\.|$)/g, ".[i]$1").split(".").slice(0, 3).join(".");
  missGroups[key] = (missGroups[key] ?? 0) + 1;
}

// 5. Provider failure behaviour with a MOCKED fetch (not the real service).
const cfg = { ...loadConfig({ NEBIUS_API_KEY: "mock" }), maxRetries: 2, timeoutMs: 1000 };
const ok = () => new Response(JSON.stringify({ id: "m", model: "m", choices: [{ message: { content: "{}" } }], usage: {} }), { status: 200 });
const scenarios: [string, (Response | Error)[]][] = [
  ["429 then success", [new Response("", { status: 429, headers: { "retry-after": "0" } }), ok()]],
  ["503 x3", [new Response("", { status: 503 }), new Response("", { status: 503 }), new Response("", { status: 503 })]],
  ["timeout x3", [1, 2, 3].map(() => Object.assign(new Error("a"), { name: "AbortError" }))],
  ["401", [new Response("", { status: 401 })]],
  ["malformed body", [new Response("not json", { status: 200 })]],
];
const failures = [];
for (const [name, responses] of scenarios) {
  const queue = [...responses];
  const fetchImpl = (async () => {
    const next = queue.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  try {
    const r = await chatCompletion(cfg, "m", [], { fetchImpl, sleepImpl: async () => {} });
    failures.push({ scenario: name, outcome: "success", attempts: r.attempts });
  } catch (e) {
    const err = e as ProviderError;
    failures.push({ scenario: name, outcome: err.kind, attempts: err.attempts });
  }
}

// 6. Determinism: repeated runs produce identical canonical output.
const repeats = 20;
const hashes = new Set(Array.from({ length: repeats }, () => canonicalSha256(runSimulation(input("food")))));

const result = {
  schemaVersion: "crystalpilot-offline-eval/1",
  generatedAt: new Date().toISOString(),
  conditions: {
    mode: "offline fixtures + mocked provider; no network, no model calls",
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    engineFingerprint: engineFingerprint(),
    note: "Fixture proposals and predictions were authored by the developer; all simulation outcomes are computed.",
  },
  workflowCompletion: {
    completedVerified: completion.filter((c) => c.finalState === "VERIFIED").length,
    total: completion.length,
    runs: completion,
  },
  adversarialRejection: {
    rejectedByGatedPipeline: adversarial.filter((a) => a.gated === "REJECTED" && !a.simulated).length,
    total: adversarial.length,
    naiveWrapperExecutedWithoutReview: adversarial.filter((a) => a.naiveWrapper === "executed").length,
    cases: adversarial,
  },
  gateGolden: {
    cases: goldenOutcomes.length,
    readyForReview: goldenOutcomes.filter((o: string) => o === "ready_for_review").length,
    rejected: goldenOutcomes.filter((o: string) => o === "rejected").length,
    refused: goldenOutcomes.filter((o: string) => o === "refused").length,
    note: "Exact TS/Python equality is asserted by tests/pilot-gate-golden.test.ts.",
  },
  evidenceMutation: {
    leafFieldsMutated: leaves.length,
    detectedByIntegrityDigest: integrityDetected,
    detectedAfterAttackerRehash: semanticDetected,
    undetectedAfterRehashByGroup: missGroups,
    note: "After re-hashing, only fields bound by recomputation (gate, review, replay, planner, history) are protected; descriptive fields are not. Integrity ≠ authentication.",
  },
  providerFailures: { mocked: true, scenarios: failures },
  determinism: { repeats, distinctOutputHashes: hashes.size },
  liveInference: { measured: false, reason: "No NEBIUS_API_KEY and provider host unreachable in the build environment. Run npm run live:smoke." },
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({
  workflow: `${result.workflowCompletion.completedVerified}/${result.workflowCompletion.total} VERIFIED`,
  adversarial: `${result.adversarialRejection.rejectedByGatedPipeline}/${result.adversarialRejection.total} rejected (naive wrapper executed ${result.adversarialRejection.naiveWrapperExecutedWithoutReview})`,
  mutation: `${integrityDetected}/${leaves.length} by digest, ${semanticDetected}/${leaves.length} after re-hash`,
  failures: failures.map((f) => `${f.scenario}: ${f.outcome} (${f.attempts})`),
  determinism: `${hashes.size} distinct hash over ${repeats} runs`,
  out,
}, null, 2));
