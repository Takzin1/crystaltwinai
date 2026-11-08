/**
 * Reproducible synthetic numerical-verification JSON report.
 * Example: npx tsx scripts/report-zhang-nonuniform.ts /tmp/zhang-pbe.json
 * Refuses overwrites; contains no original laboratory or CADET result data.
 */
import { writeFileSync } from "node:fs";
import { runZhangNonuniformPbeBenchmark } from "../src/lib/pbe-zhang-nonuniform";

const output = process.argv[2];
if (!output || output.startsWith("-") || process.argv.length !== 3) {
  throw new Error("Usage: npx tsx scripts/report-zhang-nonuniform.ts OUTPUT.json");
}
const study = runZhangNonuniformPbeBenchmark();
writeFileSync(output, JSON.stringify(study, null, 2) + "\n", {
  encoding: "utf8", flag: "wx",
});
console.log("Created " + output + " (synthetic numeric verification only)");
