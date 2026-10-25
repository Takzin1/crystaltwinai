/**
 * Independent educational *alternative* kinetics, not a crystal-physics oracle.
 * Model A: main simulator: supersaturation power-law growth + nucleation bursts.
 * Model B: this file: first-order, continuous solute relaxation to a linear
 * saturation curve, with analytic constant-rate cooling per integer step.
 * The two models share units and the teaching solubility coefficients, but
 * do not share kinetic implementation, nucleation, or yield/scoring equations.
 * They can be compared ONLY on temperature and concentration.
 */
import { PARAMETERS } from "../config/parameters";
import { SCORING_CONFIG as C } from "../config/scoring.config";
import { validateSimulationInput } from "./validation";
import { runSimulation } from "./engine";
import { quantile, residualDiagnostics, type ResidualDiagnostics } from "./verification-statistics";
import type { SimulationInput, SimulationResult } from "./types";

export interface ReferencePoint {
  step: number;
  temperature: number;
  concentration: number;
}
export interface ComparedField extends ResidualDiagnostics {
  field: "temperature" | "concentration";
}
export interface ModelComparison {
  modelId: "first_order_relaxation_v1";
  isPhysicalValidation: false;
  sharedAssumptions: "linear_solubility_and_educational_units";
  fields: ComparedField[];
  reference: ReferencePoint[];
}
export interface SensitivityBand {
  metric: "finalYield" | "qualityScore" | "stabilityScore";
  minimum: number;
  median: number;
  maximum: number;
  p05: number;
  p95: number;
  baseline: number;
}
export interface SensitivityStudy {
  kind: "bounded_uniform_input_sensitivity_not_statistical_confidence";
  seed: number;
  count: number;
  inputFraction: number;
  bands: SensitivityBand[];
}

export function runAlternativeReference(input: SimulationInput): ReferencePoint[] {
  validateSimulationInput(input);
  const reference: ReferencePoint[] = [];
  let concentration = input.concentration;
  const ratePerMinute = 0.06; // deliberately illustrative; not fitted
  for (let step = 1; step <= input.timeSteps; step++) {
    const temperature = Math.max(C.minTemperature, input.temperature - step * input.coolingRate * C.dtMinutes);
    const saturated = C.solubilityBase + C.solubilitySlope * temperature;
    const excess = Math.max(0, concentration - saturated);
    concentration -= excess * (1 - Math.exp(-ratePerMinute * C.dtMinutes));
    reference.push({ step, temperature, concentration });
  }
  return reference;
}

export function compareAlternativeModel(simulation: SimulationResult): ModelComparison {
  validateSimulationInput(simulation.input);
  const reference = runAlternativeReference(simulation.input);
  if (simulation.series.length !== reference.length) {
    throw new Error("Independent model comparison requires identical step counts.");
  }
  const fields = (["temperature", "concentration"] as const).map(field => {
    const errors = simulation.series.map((row, index) => {
      if (row.step !== index + 1 || !Number.isFinite(row[field]) ||
          !Number.isFinite(reference[index][field])) {
        throw new Error("Independent model comparison requires contiguous finite steps.");
      }
      return reference[index][field] - row[field];
    });
    return { field, ...residualDiagnostics(errors) };
  });
  return {
    modelId: "first_order_relaxation_v1", isPhysicalValidation: false,
    sharedAssumptions: "linear_solubility_and_educational_units", fields, reference,
  };
}

function randomGenerator(seed: number): () => number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("Input sensitivity seed must be uint32.");
  }
  let state = seed || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/** Fixed-seed local sensitivity, not a probabilistic prediction interval. */
export function runInputSensitivity(
  baseline: SimulationResult,
  inputFraction = 0.05,
  count = 128,
  seed = 0x5eed2026,
): SensitivityStudy {
  validateSimulationInput(baseline.input);
  if (baseline.series.length !== baseline.input.timeSteps ||
      (["finalYield", "qualityScore", "stabilityScore"] as const).some(key => {
        const value = baseline.summary[key];
        return !Number.isFinite(value) || value < 0 || value > 100;
      })) {
    throw new Error("Sensitivity requires a finite and consistent baseline.");
  }
  if (!Number.isFinite(inputFraction) || inputFraction < 0 || inputFraction > 0.2) {
    throw new RangeError("Input variation fraction must be 0..0.2.");
  }
  if (!Number.isInteger(count) || count < 16 || count > 256) {
    throw new RangeError("Sensitivity count must be 16..256.");
  }
  const random = randomGenerator(seed);
  const keys = ["finalYield", "qualityScore", "stabilityScore"] as const;
  const outputs = Object.fromEntries(keys.map(key => [key, [] as number[]])) as
    Record<(typeof keys)[number], number[]>;
  for (let i = 0; i < count; i++) {
    const perturb = { ...baseline.input };
    for (const definition of PARAMETERS) {
      if (definition.id === "timeSteps") continue; // maintain an aligned time axis
      const delta = (2 * random() - 1) * inputFraction * (definition.max - definition.min);
      perturb[definition.id] = Math.max(
        definition.min, Math.min(definition.max, baseline.input[definition.id] + delta),
      );
    }
    const summary = runSimulation(perturb).summary;
    for (const key of keys) outputs[key].push(summary[key]);
  }
  const bands = keys.map(metric => {
    const values = outputs[metric];
    return {
      metric,
      minimum: Math.min(...values), median: quantile(values, 0.5),
      maximum: Math.max(...values), p05: quantile(values, 0.05),
      p95: quantile(values, 0.95), baseline: baseline.summary[metric],
    };
  });
  return { kind: "bounded_uniform_input_sensitivity_not_statistical_confidence",
    seed, count, inputFraction, bands };
}
