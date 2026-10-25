/** UI-level quantitative diagnostics over aligned, bounded v1 observations.
 * Does not infer independent experimental replicates or verify user-declared
 * provenance. It never calibrates the model.
 */
import { DATA_FIELDS, type DataField, type ExperimentalDataset } from "./datasets";
import { blockBootstrapBias, residualDiagnostics, type DescriptiveInterval } from "./verification-statistics";
import type { StepState } from "./types";

export interface ObservedFieldDiagnostics {
  field: DataField;
  count: number;
  coverageFraction: number;
  maxAbs: number;
  bootstrapBias: DescriptiveInterval | null;
}

export function assessObservedResiduals(
  dataset: ExperimentalDataset, simulated: readonly StepState[],
): ObservedFieldDiagnostics[] {
  if (!Array.isArray(simulated) || simulated.length > 200 || !Array.isArray(dataset.rows) ||
      !Array.isArray(dataset.fields) || dataset.rows.length < 2 || dataset.rows.length > 200) {
    throw new Error("Comparison requires bounded dataset and trajectory arrays.");
  }
  let last = 0;
  const model = new Map<number, StepState>();
  for (const row of simulated) {
    if (!Number.isInteger(row.step) || row.step <= last || row.step > 200 ||
        DATA_FIELDS.some(field => !Number.isFinite(row[field]))) {
      throw new Error("Model trajectory is malformed, nonfinite, duplicated or unordered.");
    }
    model.set(row.step, row);
    last = row.step;
  }
  last = 0;
  for (const row of dataset.rows) {
    if (!Number.isInteger(row.step) || row.step <= last || row.step > 200 ||
        !Number.isFinite(row.temperature) || !Number.isFinite(row.concentration)) {
      throw new Error("Dataset steps or required values are malformed.");
    }
    last = row.step;
  }
  if (new Set(dataset.fields).size !== dataset.fields.length ||
      dataset.fields.some(field => !DATA_FIELDS.includes(field))) {
    throw new Error("Unknown or duplicated data fields.");
  }
  return dataset.fields.map(field => {
    const residuals = dataset.rows.flatMap(row => {
      const observed = row[field];
      if (observed === undefined) return [];
      if (!Number.isFinite(observed)) throw new Error("Nonfinite observed value.");
      const target = model.get(row.step);
      return target ? [observed - target[field]] : [];
    });
    if (!residuals.length) return {
      field, count: 0, coverageFraction: 0,
      maxAbs: 0, bootstrapBias: null,
    };
    const statistics = residualDiagnostics(residuals);
    return {
      field, count: statistics.n,
      coverageFraction: statistics.n / dataset.rows.filter(row => row[field] !== undefined).length,
      maxAbs: statistics.maxAbs,
      bootstrapBias: blockBootstrapBias(residuals),
    };
  });
}
