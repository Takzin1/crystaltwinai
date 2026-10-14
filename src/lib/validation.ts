import { PARAMETERS } from "../config/parameters";
import type { SimulationInput } from "./types";

/** Defense-in-depth for engine callers other than the controlled UI sliders. */
export function validateSimulationInput(input: SimulationInput): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Simulation input must be an object.");
  }
  for (const p of PARAMETERS) {
    const value = input[p.id];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(`Invalid ${p.id}: finite number required.`);
    }
    if (value < p.min || value > p.max) {
      throw new RangeError(`Invalid ${p.id}: expected ${p.min}–${p.max}.`);
    }
    if (p.id === "timeSteps" && !Number.isInteger(value)) {
      throw new RangeError("timeSteps must be an integer.");
    }
  }
}
