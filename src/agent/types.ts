export type AgentActionType =
  | "hold"
  | "temperature_offset_delta_norm"
  | "seed_rpm_delta_norm"
  | "crucible_rpm_delta_norm"
  | "rf_power_delta_norm"
  | "magnetic_field_delta_norm";

export interface AgentAction {
  type: AgentActionType;
  value: number;
}

export interface AgentProposal {
  proposed_action: AgentAction;
  reason: string;
  evidence: string[];
  confidence: number;
}

export interface VirtualPlantState {
  temperatureOffsetNorm: number;
  seedRotationNorm: number;
  crucibleRotationNorm: number;
  rfPowerNorm: number;
  magneticFieldNorm: number;
  emergencyStop: boolean;
}

export type PlantControlKey = Exclude<keyof VirtualPlantState, "emergencyStop">;

export interface NumericRange {
  min: number;
  max: number;
}

export interface SafetyEnvelope {
  id: string;
  physicalValidity: "DEMO_NORMALIZED_ONLY";
  stateBounds: Record<PlantControlKey, NumericRange>;
  maxAbsDelta: Record<Exclude<AgentActionType, "hold">, number>;
}

export type SafetyReasonCode =
  | "ALLOWED"
  | "HOLD"
  | "EMERGENCY_STOP"
  | "INVALID_PROPOSAL"
  | "NONFINITE_VALUE"
  | "INVALID_CONFIDENCE"
  | "CLAMPED_DELTA"
  | "CLAMPED_STATE_BOUND"
  | "RUNTIME_ERROR"
  | "RUNTIME_TIMEOUT";

export interface SafetyVerdict {
  allowed: boolean;
  status: "allowed" | "clamped" | "rejected";
  reasonCodes: SafetyReasonCode[];
  action: AgentAction | null;
  originalAction: AgentAction | null;
}
