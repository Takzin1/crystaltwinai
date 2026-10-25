import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENARIOS } from "../src/config/scenarios";
import { finalizeRun, proposeExperiment, reviewRun, simulateRun } from "../src/lib/pilot/agent";
import { buildEvidence, serializeEvidence, verifyEvidence, type PilotRun } from "../src/lib/pilot/evidence";
import { ReviewRequiredError, runApprovedExperiment } from "../src/lib/pilot/experiment";
import { ADVERSARIAL_FIXTURES } from "../src/lib/pilot/fixtures";
import { captureSnapshot, engineFingerprint } from "../src/lib/pilot/snapshot";
import {
  STATES,
  TRANSITIONS,
  TransitionError,
  checkHistory,
  currentState,
  startHistory,
  transition,
} from "../src/lib/pilot/workflow";

const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!;
const offline = (id: string, fixtureId?: string) =>
  proposeExperiment({ mode: "offline", scenarioId: id, input: { ...scenario(id).input }, fixtureId }, null);
const approve = (run: PilotRun) =>
  reviewRun(run, { reviewerLabel: "test-reviewer", decision: "approve", attestEducationalOnly: true });

// ------------------------------------------------------------- state machine

test("state machine: every declared state has a transition entry; terminals have none", () => {
  for (const s of STATES) assert.ok(Array.isArray(TRANSITIONS[s]), s);
  for (const s of ["REJECTED", "VERIFIED", "INCONCLUSIVE", "FAILED"] as const) {
    assert.deepEqual(TRANSITIONS[s], []);
  }
});

test("state machine: proposals cannot jump to APPROVED or SIMULATED", () => {
  let h = startHistory("x");
  h = transition(h, "PROPOSED", "x");
  assert.throws(() => transition(h, "APPROVED", "skip"), TransitionError);
  assert.throws(() => transition(h, "SIMULATED", "skip"), TransitionError);
  h = transition(h, "VALIDATED", "x");
  assert.throws(() => transition(h, "APPROVED", "skip review"), TransitionError);
  h = transition(h, "AWAITING_REVIEW", "x");
  h = transition(h, "APPROVED", "x");
  assert.equal(currentState(h), "APPROVED");
  const terminal = transition(transition(h, "SIMULATED", "x"), "VERIFIED", "x");
  assert.throws(() => transition(terminal, "PROPOSED", "restart"), TransitionError);
});

test("state machine: recorded histories are validated", () => {
  assert.equal(checkHistory([]), "history must be a nonempty array");
  assert.match(checkHistory([{ state: "PROPOSED", at: "2026-10-25T00:00:00Z", detail: "" }])!, /start at CREATED/);
  assert.match(
    checkHistory([
      { state: "CREATED", at: "2026-10-25T00:00:00Z", detail: "" },
      { state: "APPROVED", at: "2026-10-25T00:00:01Z", detail: "" },
    ])!,
    /invalid recorded transition CREATED → APPROVED/,
  );
  assert.match(checkHistory([{ state: "HACKED", at: "2026-10-25T00:00:00Z", detail: "" }])!, /unknown workflow state/);
});

// ------------------------------------------------------------- Demo A

for (const s of SCENARIOS) {
  test(`Demo A (offline fixture) completes for scenario ${s.id}`, async () => {
    const proposed = await offline(s.id);
    assert.equal(currentState(proposed.history), "AWAITING_REVIEW", proposed.history.at(-1)!.detail);
    assert.equal(proposed.inference!.mode, "offline_fixture");
    assert.equal(JSON.parse(proposed.proposalText!).source.origin, "synthetic_fixture");
    const simulated = simulateRun(approve(proposed));
    assert.equal(currentState(simulated.history), "SIMULATED");
    const exp = simulated.experiment!;
    assert.ok(exp.checks.every((c) => c.passed), JSON.stringify(exp.checks.filter((c) => !c.passed)));
    // Results are computed, not copied: at least one metric must move for a real change.
    assert.ok(exp.comparison.some((c) => c.direction !== "no_change"));
    const done = finalizeRun(simulated, null);
    assert.equal(currentState(done.history), "VERIFIED");
    const report = verifyEvidence(serializeEvidence(buildEvidence(done)));
    assert.equal(report.overall, "PASS", JSON.stringify(report.checks.filter((c) => c.status === "fail")));
    assert.equal(report.integrity, "VERIFIED");
  });
}

test("Demo A: the after-metrics equal an independent engine run of the approved input", async () => {
  const done = simulateRun(approve(await offline("unstable")));
  const independent = captureSnapshot(done.experiment!.approvedInput as never).result.summary;
  assert.equal(done.experiment!.resultSummary.qualityScore, independent.qualityScore);
  assert.equal(done.experiment!.resultSummary.nucleationEvents, independent.nucleationEvents);
  assert.equal(done.experiment!.approvedInput.coolingRate, 0.6);
  assert.equal(done.experiment!.approvedInput.concentration, 0.48);
});

test("Demo A: prediction checks report contradictions honestly", async () => {
  const done = simulateRun(approve(await offline("pharma")));
  const outcomes = done.experiment!.predictionChecks;
  assert.equal(outcomes.length, 2);
  for (const p of outcomes) {
    const actual = done.experiment!.comparison.find((c) => c.metric === p.metric)!.direction;
    assert.equal(p.observed, actual);
    assert.equal(p.outcome, p.direction === actual ? "confirmed" : "contradicted");
  }
});

// ------------------------------------------------------------- Demo B

for (const fixture of ADVERSARIAL_FIXTURES) {
  test(`Demo B rejects adversarial candidate: ${fixture.id}`, async () => {
    const run = await offline("edu-default", fixture.id);
    assert.equal(currentState(run.history), "REJECTED");
    assert.equal(run.experiment, null);
    assert.equal(run.reviewText, null);
    const reason = run.history.at(-1)!.detail;
    assert.ok(reason.length > 10, "explicit reason");
    assert.throws(() => approve(run), /not awaiting review/);
    assert.throws(() => simulateRun(run), /requires an APPROVED run/);
    const report = verifyEvidence(serializeEvidence(buildEvidence(run)));
    assert.equal(report.overall, "PASS", JSON.stringify(report.checks));
  });
}

test("Demo B reasons are specific", async () => {
  const reason = async (id: string) => (await offline("edu-default", id)).history.at(-1)!.detail;
  assert.match(await reason("attack-out-of-range"), /coolingRate: outside educational model bounds \[0\.05, 2\.0\]/);
  assert.match(await reason("attack-unsupported-parameter"), /unsupported simulation parameter: pressure/);
  assert.match(await reason("attack-nan"), /non-finite JSON constant: NaN/);
  assert.match(await reason("attack-overflow"), /non-finite number/);
  assert.match(await reason("attack-not-json"), /must be UTF-8 JSON/);
  assert.match(await reason("attack-hardware-action"), /only simulation_only is allowed/);
  assert.match(await reason("attack-prompt-injection"), /fields differ from the versioned contract/);
  assert.match(await reason("attack-forged-provenance"), /server-owned field\(s\): source/);
  assert.match(await reason("attack-duplicate-key"), /duplicate JSON key: changes/);
  assert.match(await reason("attack-too-many-changes"), /1\.\.3 parameters/);
});

// ------------------------------------------------------------- review gate

test("review gate: approval requires attestation; reject releases nothing", async () => {
  const run = await offline("edu-default");
  assert.throws(
    () => reviewRun(run, { reviewerLabel: "x", decision: "approve", attestEducationalOnly: false }),
    /attesting educational/,
  );
  const rejected = reviewRun(run, { reviewerLabel: "x", decision: "reject", attestEducationalOnly: false });
  assert.equal(currentState(rejected.history), "REJECTED");
  assert.equal(JSON.parse(rejected.reviewText!).simulationInput, null);
  assert.throws(() => simulateRun(rejected), /APPROVED/);
});

test("runner refuses forged or tampered approval records", async () => {
  const run = await offline("edu-default");
  const approved = approve(run);
  const base = {
    snapshotText: approved.snapshotText,
    proposalText: approved.proposalText!,
    assessmentText: approved.assessmentText!,
    prediction: [],
  };
  const review = JSON.parse(approved.reviewText!);
  // Rejected review → no simulation.
  assert.throws(() => runApprovedExperiment({ ...base, reviewText: JSON.stringify({ ...review, status: "rejected_by_reviewer" }) }), ReviewRequiredError);
  // Approval whose simulationInput was edited to smuggle another value.
  const smuggled = { ...review, simulationInput: { ...review.simulationInput, coolingRate: 1.9 } };
  assert.throws(() => runApprovedExperiment({ ...base, reviewText: JSON.stringify(smuggled) }), ReviewRequiredError);
  // Approval reused for a different (edited) proposal.
  const edited = base.proposalText.replace('"coolingRate": 0.25', '"coolingRate": 0.3');
  assert.throws(() => runApprovedExperiment({ ...base, proposalText: edited, reviewText: approved.reviewText! }), ReviewRequiredError);
  // Not JSON.
  assert.throws(() => runApprovedExperiment({ ...base, reviewText: "approved!" }), ReviewRequiredError);
});

// ------------------------------------------------------------- Demo C

async function verifiedEvidence() {
  const done = finalizeRun(simulateRun(approve(await offline("unstable"))), null);
  return buildEvidence(done, "2026-10-25T00:00:00.000Z");
}

test("Demo C: tampering with protected fields is detected", async () => {
  const doc = await verifiedEvidence();
  const tamper = (mutate: (d: ReturnType<typeof structuredClone<typeof doc>>) => void) => {
    const copy = structuredClone(doc);
    mutate(copy);
    return verifyEvidence(serializeEvidence(copy));
  };
  const input = tamper((d) => {
    d.body.run.snapshotText = d.body.run.snapshotText.replace('"coolingRate": 1.8', '"coolingRate": 0.2');
  });
  assert.equal(input.integrity, "MISMATCH");
  assert.equal(input.checks.find((c) => c.id === "snapshot_hash")!.status, "fail");

  const model = tamper((d) => {
    d.body.run.inference!.mode = "live_nebius";
  });
  assert.equal(model.integrity, "MISMATCH");
  assert.equal(model.overall, "FAIL");

  const result = tamper((d) => {
    d.body.run.experiment!.resultSummary.qualityScore = 99.9;
  });
  assert.equal(result.integrity, "MISMATCH");
  assert.equal(result.checks.find((c) => c.id === "simulation_replay")!.status, "fail");
});

test("Demo C: re-hashing a tampered body still fails replay/recompute checks", async () => {
  const doc = await verifiedEvidence();
  doc.body.run.experiment!.resultSummary.qualityScore = 99.9;
  const forged = buildEvidence(doc.body.run, doc.body.exportedAt); // attacker recomputes digest
  const report = verifyEvidence(serializeEvidence(forged));
  assert.equal(report.integrity, "VERIFIED");
  assert.equal(report.overall, "FAIL");
  assert.equal(report.checks.find((c) => c.id === "simulation_replay")!.status, "fail");
});

test("evidence verification: unreadable input fails closed", () => {
  assert.equal(verifyEvidence("not json").integrity, "UNREADABLE");
  assert.equal(verifyEvidence('{"schemaVersion":"x"}').overall, "FAIL");
  assert.equal(verifyEvidence('{"a":1,"a":2}').checks[0].detail, "duplicate JSON key: a");
});

test("deterministic replay: identical inputs produce identical snapshot bytes and fingerprint", () => {
  const a = captureSnapshot({ ...scenario("food").input });
  const b = captureSnapshot({ ...scenario("food").input });
  assert.equal(a.text, b.text);
  assert.equal(a.sha256, b.sha256);
  assert.match(engineFingerprint(), /^[0-9a-f]{64}$/);
});
