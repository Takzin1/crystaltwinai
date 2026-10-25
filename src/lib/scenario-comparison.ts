/** Deterministic comparisons between two educational simulations. */
import type { ParameterId, SimulationInput, SimulationResult } from "./types";

export type ComparisonMetric = "finalYield" | "qualityScore" | "stabilityScore" | "avgGrowthRate";
export const COMPARISON_METRICS: ComparisonMetric[] = [
  "finalYield", "qualityScore", "stabilityScore", "avgGrowthRate",
];

export function compareEducationalRuns(
  baseline: SimulationResult,
  current: SimulationResult,
) {
  const changedParameters = (Object.keys(current.input) as ParameterId[])
    .filter(key => baseline.input[key] !== current.input[key]);
  return {
    changedParameters,
    metrics: COMPARISON_METRICS.map(key => {
      const before = baseline.summary[key];
      const after = current.summary[key];
      if (!Number.isFinite(before) || !Number.isFinite(after)) {
        throw new Error("Non-finite educational comparison value.");
      }
      return { key, before, after, delta: after - before };
    }),
  };
}

export function sameInput(a: SimulationInput, b: SimulationInput): boolean {
  return (Object.keys(a) as ParameterId[]).every(key => a[key] === b[key]);
}
