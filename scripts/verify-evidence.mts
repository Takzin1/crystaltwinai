// Verify a CrystalPilot evidence file offline, including deterministic
// simulation replay. Usage: npm run verify:evidence -- <file.json>
// Exit 0 = PASS, 2 = FAIL, 1 = unreadable.
import { readFileSync, statSync } from "node:fs";
import { MAX_EVIDENCE_BYTES, verifyEvidence } from "../src/lib/pilot/evidence";

const path = process.argv[2];
if (!path) {
  console.error("usage: npm run verify:evidence -- <evidence.json>");
  process.exit(1);
}
if (!statSync(path).isFile() || statSync(path).size > MAX_EVIDENCE_BYTES) {
  console.error("Evidence must be a regular file of at most 1 MiB.");
  process.exit(1);
}
const report = verifyEvidence(readFileSync(path, "utf8"));
for (const c of report.checks) {
  console.log(`${{ pass: "✓", fail: "✗", warn: "!", skip: "–" }[c.status]} ${c.id}: ${c.detail}`);
}
console.log(`${report.overall} · file integrity ${report.integrity}`);
console.log(report.notice);
process.exit(report.integrity === "UNREADABLE" ? 1 : report.overall === "PASS" ? 0 : 2);
