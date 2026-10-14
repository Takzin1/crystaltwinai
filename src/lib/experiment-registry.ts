import type { ExperimentalDataset, DatasetComparison } from "./datasets";
import type { SimulationInput } from "./types";

export const MAX_ACTIVE_DATASETS = 5;
export type SourceCategory = "unverified" | "synthetic" | "measured";

export interface DatasetMetadata {
  source: SourceCategory;
  material: string;
  experimentId: string;
  intervalMinutes: number;
  notes: string;
}

export const DEFAULT_METADATA: DatasetMetadata = {
  source: "unverified",
  material: "",
  experimentId: "",
  intervalMinutes: 1,
  notes: "",
};

/** Index step represents one minute in the existing educational simulator. */
export function canCompareIntervals(metadata: DatasetMetadata): boolean {
  return Number.isFinite(metadata.intervalMinutes) && metadata.intervalMinutes === 1;
}

export function normalizeMetadata(input: DatasetMetadata): DatasetMetadata {
  if (!["unverified", "synthetic", "measured"].includes(input.source)) {
    throw new Error("Invalid provenance category.");
  }
  if (!Number.isFinite(input.intervalMinutes) || input.intervalMinutes <= 0 || input.intervalMinutes > 60) {
    throw new Error("Interval must be between 0 and 60 minutes.");
  }
  return {
    source: input.source,
    material: input.material.trim().slice(0, 80),
    experimentId: input.experimentId.trim().slice(0, 80),
    intervalMinutes: input.intervalMinutes,
    notes: input.notes.trim().slice(0, 240),
  };
}

export function makeComparisonReport(args: {
  dataset: ExperimentalDataset;
  metadata: DatasetMetadata;
  sha256: string | null;
  simulatedInput: SimulationInput;
  comparison: DatasetComparison;
  generatedAt: string;
}) {
  const metadata = normalizeMetadata(args.metadata);
  if (!canCompareIntervals(metadata)) {
    throw new Error("Time interval mismatch: comparisons require 1 minute per step.");
  }
  // Export deliberately excludes raw observation rows and all persistent storage.
  return {
    reportSchemaVersion: 1 as const,
    generatedAt: args.generatedAt,
    disclaimer: "Educational model only; not validated for process or equipment control.",
    data: {
      name: args.dataset.name,
      schemaVersion: args.dataset.schemaVersion,
      rowCount: args.dataset.rows.length,
      fields: args.dataset.fields,
      sha256: args.sha256,
      metadata,
    },
    simulationInput: { ...args.simulatedInput },
    comparison: args.comparison,
  };
}
