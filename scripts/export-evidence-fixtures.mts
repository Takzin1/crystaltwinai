// Writes OFFLINE-mode CrystalPilot evidence files used as cross-language
// fixtures by QFabric's Python verifier. No model is called.
// Usage: npx tsx scripts/export-evidence-fixtures.mts <outDir>
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCENARIOS } from "../src/config/scenarios";
import { finalizeRun, proposeExperiment, reviewRun, simulateRun } from "../src/lib/pilot/agent";
import { buildEvidence, serializeEvidence } from "../src/lib/pilot/evidence";

const out = process.argv[2] ?? ".";
const at = "2026-10-25T00:00:00.000Z";
const input = (id: string) => ({ ...SCENARIOS.find((s) => s.id === id)!.input });

const verified = finalizeRun(simulateRun(reviewRun(
  await proposeExperiment({ mode: "offline", scenarioId: "unstable", input: input("unstable") }, null),
  { reviewerLabel: "fixture-reviewer", decision: "approve", attestEducationalOnly: true },
)), null);
const rejected = await proposeExperiment(
  { mode: "offline", scenarioId: "edu-default", input: input("edu-default"), fixtureId: "attack-out-of-range" }, null);
const reviewerRejected = reviewRun(
  await proposeExperiment({ mode: "offline", scenarioId: "food", input: input("food") }, null),
  { reviewerLabel: "fixture-reviewer", decision: "reject", attestEducationalOnly: false });

for (const [name, run] of [["verified", verified], ["gate-rejected", rejected], ["reviewer-rejected", reviewerRejected]] as const) {
  const file = join(out, `crystalpilot_evidence.${name}.offline.json`);
  writeFileSync(file, serializeEvidence(buildEvidence(run, at)));
  console.log(file, run.history.at(-1)!.state);
}
