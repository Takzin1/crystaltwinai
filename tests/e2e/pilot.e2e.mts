// Browser end-to-end test for CrystalPilot (Demo A, B, C) in OFFLINE DEMO mode.
// Usage: npm run build && PORT=3100 npm start &  then  BASE_URL=http://localhost:3100 npm run e2e
// Evidence exported by the browser is re-verified here in Node (cross-runtime replay).
// Needs no credentials and makes no model calls. Screenshots go to E2E_SCREENSHOTS if set.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { verifyEvidence } from "../../src/lib/pilot/evidence";
import { engineFingerprint } from "../../src/lib/pilot/snapshot";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.E2E_SCREENSHOTS ?? null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const results: { name: string; ok: boolean; ms?: number }[] = [];
async function step(name: string, fn: () => Promise<void>) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`ok - ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    results.push({ name, ok: false });
    console.log(`not ok - ${name}\n  ${(error as Error).message.split("\n").join("\n  ")}`);
  }
}

const page = await browser.newPage({ viewport: { width: 1360, height: 1000 }, acceptDownloads: true });
const consoleErrors: string[] = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
const shot = async (name: string) => SHOTS && page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
const proposalPanel = () => page.getByRole("region", { name: "AI proposal" });
const workflow = () => page.getByRole("region", { name: "Workflow state" });

await step("home page keeps the original simulator and links to CrystalPilot", async () => {
  await page.goto(BASE + "/");
  await page.getByText("CrystalTwin").first().waitFor();
  await page.getByRole("link", { name: /CrystalPilot/ }).click();
  await page.waitForURL(/\/pilot$/);
  await page.getByText("Evidence-gated AI experiment lab", { exact: false }).waitFor();
});

await step("live mode is honestly unavailable without credentials", async () => {
  await page.getByText(/Live inference is not configured/).waitFor();
  assert.equal(await page.getByLabel(/Live Nemotron/).isDisabled(), true);
});

await step("Demo A: propose → gate → review → simulate → verify", async () => {
  await page.getByLabel("Research scenario").selectOption("unstable");
  await page.getByRole("button", { name: "Generate proposal" }).click();
  await workflow().getByText("AWAITING_REVIEW").first().waitFor();
  await proposalPanel().getByText("OFFLINE DEMO").waitFor();
  await proposalPanel().getByText("Ready for human review (not approved)").waitFor();
  await shot("a1-awaiting-review");
  const approve = page.getByRole("button", { name: "Approve for simulation" });
  assert.equal(await approve.isDisabled(), true, "approval disabled until attestation");
  await page.getByLabel(/I attest this is for educational simulation only/).check();
  await approve.click();
  await page.getByRole("region", { name: /Before \/ after/ }).waitFor();
  await page.getByText("only_approved_parameters_changed").waitFor();
  await page.getByRole("button", { name: "Use deterministic interpretation" }).click();
  await workflow().getByText("VERIFIED").first().waitFor();
  const table = await page.getByRole("region", { name: /Before \/ after/ }).locator("table").innerText();
  assert.match(table, /nucleationEvents\s+6\.000\s+2\.000/);
  await shot("a2-verified");
});

let exportedPath = "";
await step("Demo C: export, verify PASS, tamper → integrity MISMATCH", async () => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export evidence JSON" }).click(),
  ]);
  exportedPath = await download.path();
  const doc = JSON.parse(readFileSync(exportedPath, "utf8"));
  assert.equal(doc.schemaVersion, "crystalpilot-evidence/1");
  assert.equal(doc.body.run.history.at(-1).state, "VERIFIED");
  // Browser-computed engine fingerprint and results must replay bit-exactly in Node.
  assert.equal(doc.body.app.engineFingerprint, engineFingerprint());
  const nodeReport = verifyEvidence(readFileSync(exportedPath, "utf8"));
  assert.equal(nodeReport.overall, "PASS", JSON.stringify(nodeReport.checks.filter((c) => c.status !== "pass")));
  await page.getByRole("button", { name: "Verify current evidence" }).click();
  await page.getByText("current: PASS").waitFor();
  await page.getByText("FILE INTEGRITY: VERIFIED").waitFor();
  await page.getByRole("button", { name: "Tamper: inflate quality" }).click();
  await page.getByText("result tampered: FAIL").waitFor();
  await page.getByText("FILE INTEGRITY: MISMATCH").waitFor();
  await page.getByText(/simulation_replay/).waitFor();
  await shot("c1-tampered");
  await page.getByRole("button", { name: "Tamper: relabel model" }).click();
  await page.getByText("model tampered: FAIL").waitFor();
});

await step("Demo C: an uploaded copy of the exported file verifies", async () => {
  await page.locator('input[type="file"]').setInputFiles(exportedPath);
  await page.getByText(/: PASS/).first().waitFor();
});

await step("Demo B: adversarial candidates are rejected and never simulated", async () => {
  for (const id of ["attack-out-of-range", "attack-prompt-injection", "attack-hardware-action", "attack-nan"]) {
    await page.getByLabel("Demo B · adversarial candidates").selectOption(id);
    await page.getByRole("button", { name: "Submit candidate" }).click();
    await workflow().locator(".state-chip").first().getByText("REJECTED").waitFor();
    await proposalPanel().getByText(/Rejected — nothing was simulated/).waitFor();
    assert.equal(await page.getByRole("button", { name: "Approve for simulation" }).count(), 0);
    assert.equal(await page.getByRole("region", { name: /Before \/ after/ }).count(), 0);
  }
  await proposalPanel().getByText(/non-finite JSON constant: NaN/).waitFor();
  await shot("b1-rejected");
});

await step("Japanese UI remains available", async () => {
  await page.getByRole("button", { name: "日本語" }).click();
  await page.getByText("研究シナリオ").first().waitFor();
  await page.getByRole("button", { name: "EN", exact: true }).click();
});

await step("mobile viewport renders without horizontal overflow", async () => {
  await page.setViewportSize({ width: 390, height: 900 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);
  await shot("m1-mobile");
});

await step("no browser console errors", async () => {
  assert.deepEqual(consoleErrors, []);
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`# pass ${results.length - failed}\n# fail ${failed}`);
process.exit(failed ? 1 : 0);
