import type { SafetyEnvelope } from "./types";

/**
 * Demo-only normalized envelope.
 *
 * These bounds intentionally mirror the normalized DOE space, not real
 * equipment limits. They must never be presented as source-verified SiC
 * operating constraints.
 */
export const DEMO_NORMALIZED_SAFETY_ENVELOPE: SafetyEnvelope = {
  id: "demo-normalized-v0",
  physicalValidity: "DEMO_NORMALIZED_ONLY",
  stateBounds: {
    temperatureOffsetNorm: { min: -1, max: 1 },
    seedRotationNorm: { min: 0, max: 1 },
    crucibleRotationNorm: { min: -1, max: 1 },
    rfPowerNorm: { min: 0.8, max: 1.2 },
    magneticFieldNorm: { min: 0, max: 1 },
  },
  maxAbsDelta: {
    temperature_offset_delta_norm: 0.1,
    seed_rpm_delta_norm: 0.1,
    crucible_rpm_delta_norm: 0.1,
    rf_power_delta_norm: 0.05,
    magnetic_field_delta_norm: 0.1,
  },
};
