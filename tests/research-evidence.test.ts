import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseResearchDataset } from "../src/lib/research-schema";
import {
  MAX_SOURCE_EVIDENCE_BYTES, RESEARCH_EVIDENCE_VERSION,
  assessSourceBytes, makeResearchEvidenceManifest,
} from "../src/lib/research-evidence";

const original = readFileSync("public/examples/research-v2-synthetic.json");
const hash = (input: Uint8Array | string) => createHash("sha256").update(input).digest("hex");
const sha = hash(original);
const source = Buffer.from("pretend upstream raw CSV\n1,2\n");
const sourceHash = hash(source);
const loaded = () => parseResearchDataset(original.toString("utf8"));
const input = () => ({
  dataset: loaded(), researchJsonSha256: sha,
  originalSourceFile: null, generatedAt: "2026-11-02T10:00:00.000Z",
});

test("synthetic example retains an unverified evidence status", () => {
  const report = makeResearchEvidenceManifest(input());
  assert.equal(report.schemaVersion, RESEARCH_EVIDENCE_VERSION);
  assert.equal(report.importedResearchJson.sha256, sha);
  assert.equal(report.importedResearchJson.rowCount, loaded().measurements.length);
  assert.equal(report.originalSourceFile.status, "source_not_supplied");
  assert.equal(report.verificationClaims.physicalModelValidated, false);
  assert.equal(report.verificationClaims.physicalMeasurementVerified, false);
  assert.equal(report.verificationClaims.originalPublisherAuthenticated, false);
  assert.equal(report.intakeStatus, "metadata_only_no_scientific_validation");
});

test("exact bytes matching a declared SHA are ONLY local consistency", () => {
  const value = input();
  value.dataset.metadata.sourceFileSha256 = sourceHash.toUpperCase();
  const output = makeResearchEvidenceManifest({
    ...value, originalSourceFile: {
      name: "source.csv", byteLength: source.length, sha256: sourceHash,
    },
  });
  assert.equal(output.originalSourceFile.status, "matches_declared_digest");
  assert.equal(output.originalSourceFile.exactByteMatch, true);
  assert.equal(output.verificationClaims.sourceByteConsistencyChecked, true);
  assert.equal(output.verificationClaims.originalPublisherAuthenticated, false);
  assert.equal(output.verificationClaims.physicalMeasurementVerified, false);
  assert.equal(output.intakeStatus, "metadata_only_no_scientific_validation");
  assert.equal(JSON.stringify(output).includes("pretend upstream"), false);
});

test("tampered bytes fail closed while still yielding exportable negative evidence", () => {
  const value = input();
  value.dataset.metadata.sourceFileSha256 = sourceHash;
  const report = makeResearchEvidenceManifest({
    ...value,
    originalSourceFile: {name: "source.csv", byteLength: 100, sha256: "0".repeat(64)},
  });
  assert.equal(report.originalSourceFile.status, "digest_mismatch");
  assert.equal(report.originalSourceFile.exactByteMatch, false);
  assert.equal(report.intakeStatus, "blocked_mismatched_bytes");
  assert.match(report.blockers.join(" "), /differs/);
});

test("a file with no declared checksum never becomes verified", () => {
  const status = assessSourceBytes(undefined, {
    name: "sample.nxs", byteLength: 13, sha256: sourceHash,
  });
  assert.equal(status.status, "declared_digest_missing");
  assert.equal(status.exactByteMatch, false);
});

test("reject invalid checksums, path tricks, zero/huge files and forged dates", () => {
  for (const name of ["../secret", "a\\b", ".", "bad\u0000name", "x".repeat(181)]) {
    assert.throws(() => assessSourceBytes(undefined, {name,byteLength:10,sha256:sourceHash}));
  }
  for (const byteLength of [0, -1, 1.1, MAX_SOURCE_EVIDENCE_BYTES + 1]) {
    assert.throws(() => assessSourceBytes(undefined, {name:"ok.csv",byteLength,sha256:sourceHash}));
  }
  assert.throws(() => assessSourceBytes("a", null), /SHA-256/);
  assert.throws(() => assessSourceBytes(sourceHash, {name:"ok",byteLength:10,sha256:"z".repeat(64)}),/SHA-256/);
  assert.throws(() => makeResearchEvidenceManifest({...input(),researchJsonSha256:"0"}),/SHA-256/);
  assert.throws(() => makeResearchEvidenceManifest({...input(),generatedAt:"yesterday"}),/ISO UTC/);
});

test("measured and complete metadata still cannot become physically verified", () => {
  const sample=input();
  sample.dataset.metadata.provenance="measured";
  sample.dataset.metadata.doi="10.1234/example";
  sample.dataset.metadata.license="CC-BY-4.0";
  sample.dataset.metadata.sourceUrl="https://example.org/dataset";
  sample.dataset.metadata.measurementMethod="fictional declared method";
  sample.dataset.metadata.sourceFileSha256=sourceHash;
  const report=makeResearchEvidenceManifest({
    ...sample, originalSourceFile:{name:"source.csv",byteLength:source.length,sha256:sourceHash}
  });
  assert.equal(report.originalSourceFile.exactByteMatch,true);
  assert.equal(report.verificationClaims.physicalMeasurementVerified,false);
  assert.equal(report.verificationClaims.redistributionRightsVerified,false);
  assert.ok(report.blockers.some(message=>message.includes("not independently authenticated")));
});
