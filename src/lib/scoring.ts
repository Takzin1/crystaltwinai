import { SCORING_CONFIG as C } from "@/config/scoring.config";
import type { SimulationInput } from "@/lib/types";

/**
 * Scoring module.
 *
 * Pure functions that turn the physical-ish state of the virtual
 * process into 0–100 scores. Kept separate from the time-stepping
 * engine so it can be replaced by a fitted model, an ML regressor or
 * an industry-specific scoring scheme without touching engine.ts.
 */

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** Saturation concentration at temperature T (linear pedagogical model). */
export function solubility(temperature: number): number {
  return C.solubilityBase + C.solubilitySlope * temperature;
}

/** Supersaturation ratio S = C / C_sat(T). */
export function supersaturation(concentration: number, temperature: number): number {
  return concentration / solubility(temperature);
}

/** Stirring response factor in [floor, 1]: bell curve around the optimum. */
export function stirringFactor(rpm: number): number {
  const x = (rpm - C.stirringOptimum) / C.stirringSpread;
  return C.stirringFloor + (1 - C.stirringFloor) * Math.exp(-x * x);
}

/** Growth inhibition by impurities, in (0, 1]. */
export function impurityFactor(impurityLevel: number): number {
  return 1 / (1 + C.impurityInhibition * impurityLevel);
}

/** Instantaneous linear growth rate (a.u./min). Zero below saturation. */
export function growthRate(s: number, rpm: number, impurityLevel: number): number {
  if (s <= 1) return 0;
  return C.kGrowth * Math.pow(s - 1, C.growthOrder) * stirringFactor(rpm) * impurityFactor(impurityLevel);
}

/** Instantaneous process stability, 0–100. */
export function stabilityAt(s: number, input: SimulationInput): number {
  const p = C.stability;
  let penalty = 0;
  if (s > p.supersaturationSoftLimit) {
    penalty += (s - p.supersaturationSoftLimit) * p.supersaturationPenalty;
  }
  if (input.coolingRate > p.coolingSoftLimit) {
    penalty += (input.coolingRate - p.coolingSoftLimit) * p.coolingPenalty;
  }
  if (input.stirringSpeed < p.stirringLowLimit) penalty += p.stirringLowPenalty;
  if (input.stirringSpeed > p.stirringHighLimit) penalty += p.stirringHighPenalty;
  penalty += input.impurityLevel * p.impurityPenalty;
  return clamp(100 - penalty);
}

/** Instantaneous expected crystal quality, 0–100. */
export function qualityAt(g: number, stability: number, input: SimulationInput, nucleationEvents: number): number {
  const q = C.quality;
  let penalty = 0;
  if (g > q.optimalGrowth) penalty += (g - q.optimalGrowth) * q.fastGrowthPenalty;
  penalty += input.impurityLevel * g * q.inclusionPenalty;
  penalty += (100 - stability) * q.instabilityCoupling;
  penalty += nucleationEvents * q.nucleationPenalty;
  return clamp(100 - penalty);
}

/** Weighted average that emphasises late (settled) steps. */
export function weightedAverage(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  let weightSum = 0;
  values.forEach((v, i) => {
    const w = 1 + (C.lateStepWeight - 1) * (i / Math.max(1, values.length - 1));
    sum += v * w;
    weightSum += w;
  });
  return sum / weightSum;
}
