/**
 * Model C: an independently implemented, conservative two-compartment
 * *educational* solute-transfer model. NOT a population balance equation,
 * particle size distribution, fitted kinetic model, or process validation.
 *
 * In a notional fixed 1-mL solution volume, "solidEquivalent" is mass
 * transferred out of the solution divided by that initial volume (g/mL).
 * It is NOT percent yield or observed crystalline mass.
 *
 * Shares the main model's linear solubility and cooling assumptions,
 * but uses distinct bounded first-order deposition kinetics.
 */
import { SCORING_CONFIG as C } from "../config/scoring.config";
import { validateSimulationInput } from "./validation";
import type { SimulationInput } from "./types";

export const CONSERVATIVE_REFERENCE_ID = "two_compartment_mass_transfer_v1" as const;

export interface ConservativeState {
  step: number;
  temperature: number;
  liquidConcentration: number;
  solidEquivalent: number;
  totalEquivalent: number;
}

export function runConservativeReference(input: SimulationInput): ConservativeState[] {
  validateSimulationInput(input);
  let liquid = input.concentration;
  let solid = 0;
  const result: ConservativeState[] = [];
  // These values are arbitrary *educational* parameters, never fitted.
  const transferPerMinute = (0.035 + 0.065 * input.stirringSpeed / 1000) /
    (1 + input.impurityLevel / 5);
  for (let step = 1; step <= input.timeSteps; step++) {
    const temperature = Math.max(
      C.minTemperature, input.temperature - step * input.coolingRate * C.dtMinutes,
    );
    const saturated = C.solubilityBase + C.solubilitySlope * temperature;
    const excess = Math.max(0, liquid - saturated);
    // Bounded deposition prevents depletion below the illustrative solubility.
    const transferred = Math.min(liquid, excess * (1 - Math.exp(-transferPerMinute * C.dtMinutes)));
    liquid -= transferred;
    solid += transferred;
    result.push({
      step, temperature, liquidConcentration: liquid,
      solidEquivalent: solid, totalEquivalent: liquid + solid,
    });
  }
  return result;
}

export interface ClosureAudit {
  accepted: boolean;
  maxAbsMassClosureError: number;
  violations: string[];
  /** Closure of THIS toy reference only. Does not validate the primary simulator. */
  physicalValidation: false;
}

export function auditConservativeReference(
  input: SimulationInput,
  rows: readonly ConservativeState[],
  absoluteTolerance = 1e-9,
): ClosureAudit {
  validateSimulationInput(input);
  if (!Number.isFinite(absoluteTolerance) || absoluteTolerance < 0 || absoluteTolerance > 1e-4) {
    throw new RangeError("Closure tolerance must be within 0..1e-4.");
  }
  const violations: string[] = [];
  if (!Array.isArray(rows) || rows.length !== input.timeSteps) {
    return {accepted: false, maxAbsMassClosureError: Number.NaN,
      violations: ["trajectory length mismatch"], physicalValidation: false};
  }
  let previousTemperature = input.temperature;
  let previousLiquid = input.concentration;
  let previousSolid = 0;
  let maxError = 0;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row || ![
      row.step, row.temperature, row.liquidConcentration,
      row.solidEquivalent, row.totalEquivalent,
    ].every(v => typeof v === "number" && Number.isFinite(v))) {
      violations.push("nonfinite or missing trajectory value at step " + (index + 1));
      continue;
    }
    const expectedTemp = Math.max(
      C.minTemperature, input.temperature - (index + 1) * input.coolingRate * C.dtMinutes,
    );
    const closure = Math.abs(row.liquidConcentration + row.solidEquivalent - input.concentration);
    const declaredTotal = Math.abs(row.totalEquivalent - input.concentration);
    maxError = Math.max(maxError, closure, declaredTotal);
    if (row.step !== index + 1) violations.push("noncontiguous step at " + (index + 1));
    if (Math.abs(row.temperature - expectedTemp) > absoluteTolerance ||
        row.temperature > previousTemperature + absoluteTolerance) {
      violations.push("cooling mismatch at step " + (index + 1));
    }
    if (row.liquidConcentration < -absoluteTolerance ||
        row.liquidConcentration > previousLiquid + absoluteTolerance ||
        row.solidEquivalent < previousSolid - absoluteTolerance ||
        row.solidEquivalent > input.concentration + absoluteTolerance) {
      violations.push("nonphysical compartment bounds at step " + (index + 1));
    }
    if (closure > absoluteTolerance || declaredTotal > absoluteTolerance) {
      violations.push("mass closure violation at step " + (index + 1));
    }
    previousTemperature = row.temperature;
    previousLiquid = row.liquidConcentration;
    previousSolid = row.solidEquivalent;
  }
  return {accepted: violations.length === 0, maxAbsMassClosureError: maxError,
    violations, physicalValidation: false};
}
