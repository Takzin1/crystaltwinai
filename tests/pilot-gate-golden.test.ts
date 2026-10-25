import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { makeAssessment, makeReview } from "../src/lib/pilot/gate";
import { JsonContractError, encodeUtf8 } from "../src/lib/pilot/strict-json";

// Exported by Takzin1/QFabric scripts/export_gate_golden.py from the real Python gate.
const golden = JSON.parse(
  readFileSync(new URL("./fixtures/qfabric-gate-golden.json", import.meta.url), "utf8"),
);

type Expected =
  | { ok: true; value: unknown }
  | { ok: false; errorType: string; message: string };

function outcome(fn: () => unknown): Expected {
  try {
    // Round-trip through JSON so the comparison sees exactly what would be serialized.
    return { ok: true, value: JSON.parse(JSON.stringify(fn())) };
  } catch (error) {
    if (!(error instanceof JsonContractError)) throw error;
    return { ok: false, errorType: error.errorType, message: error.message };
  }
}

test("golden file carries the expected contract version", () => {
  assert.equal(golden.schemaVersion, "qfabric-gate-golden/1");
  assert.ok(golden.assessments.length >= 30);
  assert.ok(golden.reviews.length >= 7);
});

for (const c of golden.assessments) {
  test(`gate assessment matches Python: ${c.name}`, () => {
    const actual = outcome(() =>
      makeAssessment(encodeUtf8(c.snapshotText), encodeUtf8(c.proposalText)));
    assert.deepEqual(actual, c.expected);
  });
}

for (const c of golden.reviews) {
  test(`gate review matches Python: ${c.name}`, () => {
    const actual = outcome(() =>
      makeReview(encodeUtf8(c.snapshotText), encodeUtf8(c.proposalText), encodeUtf8(c.assessmentText), {
        reviewerLabel: c.reviewerLabel,
        decision: c.decision,
      }));
    assert.deepEqual(actual, c.expected);
  });
}
