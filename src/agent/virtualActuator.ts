import type {
  AgentActionType,
  PlantControlKey,
  SafetyVerdict,
  VirtualPlantState,
} from "./types";

const ACTION_TO_STATE_KEY: Record<
  Exclude<AgentActionType, "hold">,
  PlantControlKey
> = {
  temperature_offset_delta_norm: "temperatureOffsetNorm",
  seed_rpm_delta_norm: "seedRotationNorm",
  crucible_rpm_delta_norm: "crucibleRotationNorm",
  rf_power_delta_norm: "rfPowerNorm",
  magnetic_field_delta_norm: "magneticFieldNorm",
};

export function applySafetyVerdict(
  state: VirtualPlantState,
  verdict: SafetyVerdict,
): VirtualPlantState {
  if (!verdict.allowed || verdict.action === null) {
    throw new Error("Actuation blocked: safety verdict is not allowed");
  }

  if (verdict.action.type === "hold") {
    return { ...state };
  }

  const key = ACTION_TO_STATE_KEY[verdict.action.type];
  return {
    ...state,
    [key]: state[key] + verdict.action.value,
  };
}
