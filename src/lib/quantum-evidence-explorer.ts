/** Deterministic, local-only discovery of references; no citation counts are fetched live. */
import type { QuantumTheoryEntry } from "./quantum-theory-evidence";

export type EvidencePeriod = "all" | "foundational" | "recent";
export type EvidenceSort = "relevance" | "newest" | "most-cited";

export interface EvidenceQuery {
  query: string;
  period: EvidencePeriod;
  sort: EvidenceSort;
}

export function selectEvidence(
  papers: readonly QuantumTheoryEntry[],
  criteria: EvidenceQuery,
): QuantumTheoryEntry[] {
  const term = criteria.query.trim().toLocaleLowerCase();
  const filtered = papers.filter((paper) => {
    if (criteria.period === "foundational" && paper.year > 2021) return false;
    if (criteria.period === "recent" && paper.year < 2025) return false;
    if (!term) return true;
    return [paper.title, paper.authors, paper.doi, paper.role,
      paper.supportedClaim, paper.researchQuestion, paper.limitations]
      .some((text) => text.toLocaleLowerCase().includes(term));
  });
  if (criteria.sort === "newest") {
    return filtered.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  }
  if (criteria.sort === "most-cited") {
    // Never fabricate a count for a recent paper with unknown citations.
    return filtered.sort((a, b) =>
      (b.citationSnapshot?.count ?? -1) - (a.citationSnapshot?.count ?? -1) ||
      b.year - a.year || a.title.localeCompare(b.title));
  }
  // Source registry order is curated, not a numeric scientific-quality ranking.
  return filtered;
}

export function comparePapers(
  papers: readonly QuantumTheoryEntry[], selectedIds: readonly string[],
): QuantumTheoryEntry[] {
  const ids = new Set(selectedIds);
  if (ids.size > 2) throw new Error("Only two papers can be compared.");
  const picked = papers.filter((paper) => ids.has(paper.id));
  if (picked.length !== ids.size) throw new Error("Unknown literature ID.");
  return selectedIds.map((id) => {
    const entry = picked.find((paper) => paper.id === id);
    if (!entry) throw new Error("Unknown literature ID.");
    return entry;
  });
}
