import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parseQuantumTheoryRegistry } from "../src/lib/quantum-theory-evidence";
import { comparePapers, selectEvidence } from "../src/lib/quantum-evidence-explorer";

const papers = parseQuantumTheoryRegistry(
  readFileSync(join(process.cwd(), "public/examples/quantum-theory-evidence-v1.json"), "utf8"),
).entries;

test("local search accepts DOI, title, field and case-insensitive author names", () => {
  const byDoi = selectEvidence(papers, {
    query: "10.22331/Q-2018-08-06-79", period: "all", sort: "relevance",
  });
  assert.equal(byDoi.length, 1);
  assert.equal(byDoi[0].id, "preskill-2018");
  assert.equal(selectEvidence(papers, {
    query: "no matching reference 123456", period: "all", sort: "relevance",
  }).length, 0);
  assert.ok(selectEvidence(papers, {
    query: "QUANTUM", period: "all", sort: "relevance",
  }).length > 0);
});

test("era filtering and stable no-mutation sorting", () => {
  const original = [...papers].map((p) => p.id);
  const recent = selectEvidence(papers, { query: "", period: "recent", sort: "newest" });
  assert.ok(recent.every((p) => p.year >= 2025));
  assert.ok(recent.every((p, i) => i === 0 || recent[i - 1].year >= p.year));
  const foundational = selectEvidence(papers, {
    query: "", period: "foundational", sort: "relevance",
  });
  assert.ok(foundational.every((p) => p.year <= 2021));
  assert.deepEqual(papers.map((p) => p.id), original);
});

test("unknown citation counts sort last rather than being treated as zero", () => {
  const sorted = selectEvidence(papers, {
    query: "", period: "all", sort: "most-cited",
  });
  const firstUnknown = sorted.findIndex((p) => p.citationSnapshot === null);
  assert.ok(firstUnknown >= 0);
  assert.ok(sorted.slice(firstUnknown).every((p) => p.citationSnapshot === null));
  assert.ok(sorted[0].citationSnapshot !== null);
});

test("comparison preserves selection order and refuses unknown or excess IDs", () => {
  const chosen = comparePapers(papers, ["cerezo-2021", "feynman-1982"]);
  assert.deepEqual(chosen.map((p) => p.id), ["cerezo-2021", "feynman-1982"]);
  assert.throws(() => comparePapers(papers, ["unknown"]), /Unknown/);
  assert.throws(() => comparePapers(papers, ["a", "b", "c"]), /Only two/);
});
