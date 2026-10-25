/** Baseline capture: deterministic simulation → versioned, hashed snapshot bytes. */
import { SCENARIOS } from "../../config/scenarios";
import { runSimulation } from "../engine";
import { buildQFabricSnapshot } from "../qfabric-bridge";
import type { SimulationInput, SimulationResult } from "../types";
import { canonicalSha256 } from "./canonical";
import { sha256Text } from "./sha256";

export const APP_NAME = "CrystalPilot";
export const APP_VERSION = "0.1.0";

export const SUMMARY_METRICS = [
  "avgGrowthRate",
  "stabilityScore",
  "qualityScore",
  "finalYield",
  "maxSupersaturation",
  "nucleationEvents",
] as const;
export type SummaryMetric = (typeof SUMMARY_METRICS)[number];

export interface CapturedSnapshot {
  result: SimulationResult;
  text: string;
  sha256: string;
}

/** Same serialization as the existing "Export current twin JSON" button. */
export function serializeSnapshot(result: SimulationResult): string {
  return JSON.stringify(buildQFabricSnapshot(result), null, 2) + "\n";
}

export function captureSnapshot(input: SimulationInput): CapturedSnapshot {
  const result = runSimulation(input);
  const text = serializeSnapshot(result);
  return { result, text, sha256: sha256Text(text) };
}

/**
 * Fingerprint of the engine's behaviour: canonical hash of full runs over all
 * scenario presets. If scoring/engine code changes, the fingerprint changes and
 * the verifier warns that replays of older evidence may legitimately differ.
 */
let cachedFingerprint: string | null = null;
export function engineFingerprint(): string {
  if (cachedFingerprint === null) {
    cachedFingerprint = canonicalSha256(
      SCENARIOS.map((s) => {
        const r = runSimulation(s.input);
        return { id: s.id, series: r.series, summary: r.summary };
      }),
    );
  }
  return cachedFingerprint;
}

export function pickSummary(result: SimulationResult): Record<SummaryMetric, number> {
  return Object.fromEntries(SUMMARY_METRICS.map((m) => [m, result.summary[m]])) as Record<
    SummaryMetric,
    number
  >;
}
