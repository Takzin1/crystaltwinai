/** Evidence intake v1: exact LOCAL byte consistency, never source authentication.
 * This module does not parse a raw scientific format, fit a physical model,
 * validate measurements, verify licensing, or contact an external provider.
 */
import type { ResearchDataset } from "./research-schema";

export const RESEARCH_EVIDENCE_VERSION = "crystaltwin-research-evidence/1" as const;
export const MAX_SOURCE_EVIDENCE_BYTES = 32 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/i;

export interface LocalSourceFile {
  name: string;
  byteLength: number;
  sha256: string;
}
export type SourceByteStatus =
  | "source_not_supplied"
  | "declared_digest_missing"
  | "matches_declared_digest"
  | "digest_mismatch";

function digest(value: string, field: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error(field + " must be a 64-character SHA-256 digest.");
  }
  return value.toLowerCase();
}

/** Check the bytes against a user-declared hash, not against a trusted publisher. */
export function assessSourceBytes(
  declaredSha256: string | undefined,
  sourceFile: LocalSourceFile | null,
): {
  status: SourceByteStatus;
  declaredSha256: string | null;
  computedSha256: string | null;
  filename: string | null;
  byteLength: number | null;
  exactByteMatch: boolean;
} {
  const declared = declaredSha256 ? digest(declaredSha256, "Declared source") : null;
  if (!sourceFile) {
    return { status: "source_not_supplied", declaredSha256: declared,
      computedSha256: null, filename: null, byteLength: null, exactByteMatch: false };
  }
  if (typeof sourceFile.name !== "string" || sourceFile.name.trim().length < 1 ||
      sourceFile.name.length > 180 || /[\\/\x00-\x1f\x7f]/.test(sourceFile.name) ||
      sourceFile.name === "." || sourceFile.name === "..") {
    throw new Error("Source filename must be a safe bounded basename.");
  }
  if (!Number.isSafeInteger(sourceFile.byteLength) || sourceFile.byteLength < 1 ||
      sourceFile.byteLength > MAX_SOURCE_EVIDENCE_BYTES) {
    throw new Error("Source bytes must be a nonempty regular file at most 32 MiB.");
  }
  const computed = digest(sourceFile.sha256, "Computed source");
  const status: SourceByteStatus = !declared ? "declared_digest_missing" :
    computed === declared ? "matches_declared_digest" : "digest_mismatch";
  return {
    status, declaredSha256: declared, computedSha256: computed,
    filename: sourceFile.name, byteLength: sourceFile.byteLength,
    exactByteMatch: status === "matches_declared_digest",
  };
}

export function makeResearchEvidenceManifest(args: {
  dataset: ResearchDataset;
  researchJsonSha256: string;
  originalSourceFile: LocalSourceFile | null;
  generatedAt: string;
}) {
  const { dataset } = args;
  if (dataset.schemaVersion !== 2 ||
      !Array.isArray(dataset.measurements) || dataset.measurements.length < 1 ||
      dataset.measurements.length > 10000) {
    throw new Error("Research v2 dataset required.");
  }
  const researchHash = digest(args.researchJsonSha256, "Imported research JSON");
  if (typeof args.generatedAt !== "string" ||
      !Number.isFinite(Date.parse(args.generatedAt)) ||
      new Date(args.generatedAt).toISOString() !== args.generatedAt) {
    throw new Error("generatedAt must be an ISO UTC timestamp.");
  }
  const source = assessSourceBytes(dataset.metadata.sourceFileSha256, args.originalSourceFile);
  const metadata = dataset.metadata;
  const blockers: string[] = [];
  if (source.status === "digest_mismatch") {
    blockers.push("Original file SHA-256 differs from the dataset's declared digest.");
  }
  if (source.status === "source_not_supplied") {
    blockers.push("Original source bytes have not been inspected.");
  }
  if (source.status === "declared_digest_missing") {
    blockers.push("Original source digest was not declared in the research metadata.");
  }
  if (!metadata.doi) blockers.push("Source DOI not declared.");
  if (!metadata.license) blockers.push("License not declared or independently checked.");
  if (!metadata.sourceUrl) blockers.push("Original source URL not declared.");
  if (!metadata.measurementMethod) blockers.push("Measurement method not declared.");
  if (metadata.provenance !== "measured") {
    blockers.push("Data are not declared to consist solely of physical measurements.");
  }
  blockers.push("Declared origin, licensing and experimental conditions are not independently authenticated.");
  blockers.push("No demonstrated material/solvent/observable comparability with the educational simulator.");
  blockers.push("No trained, calibrated or held-out physically validated model.");
  return {
    schemaVersion: RESEARCH_EVIDENCE_VERSION,
    kind: "local_research_evidence_intake" as const,
    generatedAt: args.generatedAt,
    importedResearchJson: {
      schemaVersion: dataset.schemaVersion,
      sha256: researchHash,
      rowCount: dataset.measurements.length,
      title: metadata.title,
    },
    originalSourceFile: source,
    declaredMetadata: {
      doi: metadata.doi ?? null,
      sourceUrl: metadata.sourceUrl ?? null,
      authors: [...metadata.authors],
      license: metadata.license ?? null,
      provenance: metadata.provenance,
      experimentMode: metadata.experimentMode,
      material: metadata.material,
      solvent: metadata.solvent ?? null,
      concentrationBasis: metadata.concentrationBasis ?? null,
      timeOrigin: metadata.timeOrigin ?? null,
      temperatureSource: metadata.temperatureSource ?? null,
      measurementMethod: metadata.measurementMethod ?? null,
      solidForm: metadata.solidForm ?? null,
      units: { ...metadata.units },
      transformationCount: metadata.transformations?.length ?? 0,
    },
    intakeStatus: source.status === "digest_mismatch" ? "blocked_mismatched_bytes" as const :
      "metadata_only_no_scientific_validation" as const,
    blockers,
    verificationClaims: {
      sourceByteConsistencyChecked: source.exactByteMatch,
      originalPublisherAuthenticated: false as const,
      redistributionRightsVerified: false as const,
      physicalMeasurementVerified: false as const,
      physicalModelValidated: false as const,
      hardwareExecuted: false as const,
    },
    limitation: "Only exact local byte consistency against a user-declared SHA-256. Not proof of publisher authenticity, measurement origin, compatible conditions, rights or model performance.",
  };
}
