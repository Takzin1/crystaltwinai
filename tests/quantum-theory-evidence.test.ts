import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parseQuantumTheoryRegistry } from "../src/lib/quantum-theory-evidence";

const raw = readFileSync(
  join(process.cwd(), "public/examples/quantum-theory-evidence-v1.json"), "utf8",
);

function modified(fn: (doc: Record<string, unknown>) => void): string {
  const doc = JSON.parse(raw);
  fn(doc);
  return JSON.stringify(doc);
}

test("the shared bibliography has DOI links and is context-only", () => {
  const result = parseQuantumTheoryRegistry(raw);
  assert.equal(result.schemaVersion, "qfabric-quantum-theory-evidence/1");
  assert.ok(result.entries.length >= 10);
  assert.ok(result.entries.some(entry => entry.year === 2026));
  assert.ok(result.entries.some(entry => entry.citationSnapshot !== null));
  for (const entry of result.entries) {
    assert.equal(entry.primaryUrl, "https://doi.org/" + entry.doi);
    assert.equal(entry.crystalTwinUse, "context_only_no_engine_calibration");
    assert.equal(entry.reproductionStatus, "not_reproduced_in_either_repository");
  }
});

test("rejects unsafe bibliographic claims or malformed citation numbers", () => {
  assert.throws(
    () => parseQuantumTheoryRegistry(modified(doc => {
      const entries = doc.entries as Record<string, unknown>[];
      entries[0].crystalTwinUse = "physically_validated";
    })), /must not assert/,
  );
  assert.throws(
    () => parseQuantumTheoryRegistry(modified(doc => {
      const entries = doc.entries as Record<string, unknown>[];
      const citation = entries[0].citationSnapshot as Record<string, unknown>;
      citation.count = -10;
    })), /Invalid bibliometric/,
  );
});

test("rejects wrong DOI, extra fields, duplicates and unsafe URL", () => {
  assert.throws(
    () => parseQuantumTheoryRegistry(modified(doc => {
      const entries = doc.entries as Record<string, unknown>[];
      entries[0].primaryUrl = "https://malicious.invalid/";
    })), /DOI/,
  );
  assert.throws(
    () => parseQuantumTheoryRegistry(modified(doc => {
      const entries = doc.entries as Record<string, unknown>[];
      entries[0].hardwareValidated = true;
    })), /fields mismatch/,
  );
  assert.throws(
    () => parseQuantumTheoryRegistry(modified(doc => {
      const entries = doc.entries as Record<string, unknown>[];
      entries.push({ ...entries[0] });
    })), /Duplicate/,
  );
});

test("rejects oversized payload, wrong schema and non-object JSON", () => {
  assert.throws(() => parseQuantumTheoryRegistry(raw.repeat(12)), /exceeds/);
  assert.throws(() => parseQuantumTheoryRegistry("[]"), /must be an object/);
  assert.throws(() => parseQuantumTheoryRegistry(modified(doc => {
    doc.schemaVersion = "fake";
  })), /Unknown literature/);
});
