import type {
  AgentAction,
  AgentActionType,
  AgentProposal,
  PlantControlKey,
  SafetyEnvelope,
  SafetyReasonCode,
  SafetyVerdict,
  VirtualPlantState,
} from "./types";

const ACTION_TYPES = new Set<AgentActionType>([
  "hold",
  "temperature_offset_delta_norm",
  "seed_rpm_delta_norm",
  "crucible_rpm_delta_norm",
  "rf_power_delta_norm",
  "magnetic_field_delta_norm",
]);

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseProposal(raw: unknown): AgentProposal | null {
  if (typeof raw !== "object" || raw === null) return null;

  const proposal = raw as Record<string, unknown>;
  const actionRaw = proposal.proposed_action;
  if (typeof actionRaw !== "object" || actionRaw === null) return null;

  const action = actionRaw as Record<string, unknown>;
  if (typeof action.type !== "string" || !ACTION_TYPES.has(action.type as AgentActionType)) {
    return null;
  }
  if (!isFiniteNumber(action.value)) return null;

  if (typeof proposal.reason !== "string") return null;
  if (!Array.isArray(proposal.evidence) || !proposal.evidence.every((x) => typeof x === "string")) {
    return null;
  }
  if (!isFiniteNumber(proposal.confidence)) return null;

  return {
    proposed_action: {
      type: action.type as AgentActionType,
      value: action.value,
    },
    reason: proposal.reason,
    evidence: proposal.evidence as string[],
    confidence: proposal.confidence,
  };
}

function rejected(
  reasonCodes: SafetyReasonCode[],
  originalAction: AgentAction | null = null,
): SafetyVerdict {
  return {
    allowed: false,
    status: "rejected",
    reasonCodes,
    action: null,
    originalAction,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function evaluateAgentProposal(
  rawProposal: unknown,
  state: VirtualPlantState,
  envelope: SafetyEnvelope,
): SafetyVerdict {
  const proposal = parseProposal(rawProposal);
  if (!proposal) return rejected(["INVALID_PROPOSAL"]);

  const originalAction = proposal.proposed_action;

  if (proposal.confidence < 0 || proposal.confidence > 1) {
    return rejected(["INVALID_CONFIDENCE"], originalAction);
  }

  if (state.emergencyStop) {
    return rejected(["EMERGENCY_STOP"], originalAction);
  }

  if (originalAction.type === "hold") {
    return {
      allowed: true,
      status: "allowed",
      reasonCodes: ["HOLD"],
      action: { type: "hold", value: 0 },
      originalAction,
    };
  }

  const stateKey = ACTION_TO_STATE_KEY[originalAction.type];
  const currentValue = state[stateKey];
  if (!Number.isFinite(currentValue)) {
    return rejected(["NONFINITE_VALUE"], originalAction);
  }

  const maxDelta = envelope.maxAbsDelta[originalAction.type];
  const boundedDelta = clamp(originalAction.value, -maxDelta, maxDelta);
  const absoluteBounds = envelope.stateBounds[stateKey];

  const proposedTarget = currentValue + boundedDelta;
  const boundedTarget = clamp(proposedTarget, absoluteBounds.min, absoluteBounds.max);
  const effectiveDelta = boundedTarget - currentValue;

  const reasonCodes: SafetyReasonCode[] = ["ALLOWED"];
  if (boundedDelta !== originalAction.value) reasonCodes.push("CLAMPED_DELTA");
  if (boundedTarget !== proposedTarget) reasonCodes.push("CLAMPED_STATE_BOUND");

  const clamped = reasonCodes.length > 1;

  return {
    allowed: true,
    status: clamped ? "clamped" : "allowed",
    reasonCodes,
    action: {
      type: originalAction.type,
      value: effectiveDelta,
    },
    originalAction,
  };
}
