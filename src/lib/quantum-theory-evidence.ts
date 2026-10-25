/** Versioned QFabric bibliography import. Metadata only: never calibrates the simulator. */

export const QUANTUM_EVIDENCE_VERSION = "qfabric-quantum-theory-evidence/1" as const;
export const MAX_QUANTUM_EVIDENCE_BYTES = 128 * 1024;

export interface QuantumTheoryEntry {
  id: string;
  title: string;
  authors: string;
  year: number;
  doi: string;
  primaryUrl: string;
  publicationType: "journal_article" | "conference_paper" | "review_article";
  role: string;
  citationSnapshot: null | {
    count: number;
    sourceUrl: string;
    observedOn: string;
    metric: "displayed_citations";
    notes: string;
  };
  supportedClaim: string;
  researchQuestion: string;
  limitations: string;
  qfabricUse: "background_or_hypothesis_only";
  crystalTwinUse: "context_only_no_engine_calibration";
  reproductionStatus: "not_reproduced_in_either_repository";
}

export interface QuantumTheoryRegistry {
  schemaVersion: typeof QUANTUM_EVIDENCE_VERSION;
  kind: "curated_public_literature_registry";
  compiledOn: string;
  ownerRepository: "Takzin1/QFabric";
  bibliographyScope: string;
  citationMethod: string;
  citationDefaultSourceUrl: string;
  ingestionPolicy: string;
  integrationBoundary: string;
  entries: QuantumTheoryEntry[];
}

const DOI = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/;
const TOP = [
  "schemaVersion", "kind", "compiledOn", "ownerRepository",
  "bibliographyScope", "citationMethod", "citationDefaultSourceUrl",
  "ingestionPolicy", "integrationBoundary", "entries",
] as const;
const FIELDS = [
  "id", "title", "authors", "year", "doi", "primaryUrl", "publicationType",
  "role", "citationSnapshot", "supportedClaim", "researchQuestion",
  "limitations", "qfabricUse", "crystalTwinUse", "reproductionStatus",
] as const;
const CITE_FIELDS = ["count", "sourceUrl", "observedOn", "metric", "notes"] as const;

function record(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(at + " must be an object.");
  }
  return value as Record<string, unknown>;
}

function fields(doc: Record<string, unknown>, keys: readonly string[], at: string) {
  if (Object.keys(doc).length !== keys.length || !keys.every((key) => Object.hasOwn(doc, key))) {
    throw new Error(at + " fields mismatch.");
  }
}

function text(value: unknown, at: string, max = 1600): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(at + " requires bounded text.");
  }
  return value;
}

export function parseQuantumTheoryRegistry(raw: string): QuantumTheoryRegistry {
  if (new TextEncoder().encode(raw).byteLength > MAX_QUANTUM_EVIDENCE_BYTES) {
    throw new Error("Quantum literature registry exceeds 128 KiB.");
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid quantum literature JSON.");
  }
  const doc = record(data, "registry");
  fields(doc, TOP, "registry");
  if (doc.schemaVersion !== QUANTUM_EVIDENCE_VERSION ||
      doc.kind !== "curated_public_literature_registry" ||
      doc.ownerRepository !== "Takzin1/QFabric" ||
      doc.citationDefaultSourceUrl !== "https://openalex.org/topics/T10682") {
    throw new Error("Unknown literature registry source or version.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(doc.compiledOn, "compiledOn"))) {
    throw new Error("Registry date is not ISO formatted.");
  }
  for (const field of ["bibliographyScope", "citationMethod", "ingestionPolicy",
                       "integrationBoundary"]) {
    text(doc[field], field);
  }
  if (!Array.isArray(doc.entries) || doc.entries.length < 1 || doc.entries.length > 100) {
    throw new Error("Invalid literature registry length.");
  }
  const ids = new Set<string>();
  const dois = new Set<string>();
  for (const candidate of doc.entries) {
    const item = record(candidate, "entry");
    fields(item, FIELDS, "entry");
    for (const field of ["id", "title", "authors", "role", "supportedClaim",
                         "researchQuestion", "limitations"]) {
      text(item[field], field, 800);
    }
    const doi = text(item.doi, "doi");
    const id = item.id as string;
    if (!DOI.test(doi) || item.primaryUrl !== "https://doi.org/" + doi) {
      throw new Error("Invalid paper DOI or publisher URL.");
    }
    if (ids.has(id) || dois.has(doi.toLowerCase())) {
      throw new Error("Duplicate paper DOI or ID.");
    }
    ids.add(id);
    dois.add(doi.toLowerCase());
    if (typeof item.year !== "number" || !Number.isInteger(item.year) ||
        item.year < 1980 || item.year > 2026 ||
        !["journal_article", "conference_paper", "review_article"].includes(
          item.publicationType as string,
        )) {
      throw new Error("Invalid paper year or publication type.");
    }
    if (item.qfabricUse !== "background_or_hypothesis_only" ||
        item.crystalTwinUse !== "context_only_no_engine_calibration" ||
        item.reproductionStatus !== "not_reproduced_in_either_repository") {
      throw new Error("The registry must not assert experimental or physics validation.");
    }
    if (item.citationSnapshot !== null) {
      const cited = record(item.citationSnapshot, "citation");
      fields(cited, CITE_FIELDS, "citation");
      if (typeof cited.count !== "number" || !Number.isSafeInteger(cited.count) ||
          cited.count < 0 || cited.metric !== "displayed_citations" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(text(cited.observedOn, "observedOn")) ||
          !["https://openalex.org/topics/T10682",
            "https://www.nature.com/articles/s41586-024-08449-y",
            "https://www.nature.com/articles/s41567-026-03220-8"].includes(cited.sourceUrl as string)) {
        throw new Error("Invalid bibliometric snapshot.");
      }
      text(cited.notes, "citation notes");
    }
  }
  return doc as unknown as QuantumTheoryRegistry;
}
