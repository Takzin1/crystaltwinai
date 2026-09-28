import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_NORMALIZED_SAFETY_ENVELOPE } from "./safetyEnvelope";
import { evaluateAgentProposal } from "./safetyGate";
import { applySafetyVerdict } from "./virtualActuator";
import type { VirtualPlantState } from "./types";

const baseState: VirtualPlantState = {
  temperatureOffsetNorm: 0,
  seedRotationNorm: 0.5,
  crucibleRotationNorm: 0,
  rfPowerNorm: 1,
  magneticFieldNorm: 0.5,
  emergencyStop: false,
};

function proposal(type: string, value: number, confidence = 0.8) {
  return {
    proposed_action: { type, value },
    reason: "test",
    evidence: ["sensor.test"],
    confidence,
  };
}

test("rejects malformed untrusted proposal", () => {
  const verdict = evaluateAgentProposal(
    { proposed_action: { type: "unknown", value: 1 } },
    baseState,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  assert.equal(verdict.allowed, false);
  assert.deepEqual(verdict.reasonCodes, ["INVALID_PROPOSAL"]);
});

test("rejects invalid confidence", () => {
  const verdict = evaluateAgentProposal(
    proposal("seed_rpm_delta_norm", 0.01, 1.2),
    baseState,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  assert.equal(verdict.allowed, false);
  assert.ok(verdict.reasonCodes.includes("INVALID_CONFIDENCE"));
});

test("emergency stop rejects otherwise valid actuation", () => {
  const verdict = evaluateAgentProposal(
    proposal("seed_rpm_delta_norm", 0.01),
    { ...baseState, emergencyStop: true },
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  assert.equal(verdict.allowed, false);
  assert.ok(verdict.reasonCodes.includes("EMERGENCY_STOP"));
});

test("clamps excessive delta deterministically", () => {
  const first = evaluateAgentProposal(
    proposal("seed_rpm_delta_norm", 10),
    baseState,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  const second = evaluateAgentProposal(
    proposal("seed_rpm_delta_norm", 10),
    baseState,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );

  assert.deepEqual(first, second);
  assert.equal(first.allowed, true);
  assert.equal(first.status, "clamped");
  assert.ok(Math.abs((first.action?.value ?? 0) - 0.1) < 1e-12);
  assert.ok(first.reasonCodes.includes("CLAMPED_DELTA"));
});

test("clamps to absolute state bound", () => {
  const verdict = evaluateAgentProposal(
    proposal("seed_rpm_delta_norm", 0.1),
    { ...baseState, seedRotationNorm: 0.98 },
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  assert.equal(verdict.allowed, true);
  assert.equal(verdict.status, "clamped");
  assert.ok(Math.abs((verdict.action?.value ?? 0) - 0.02) < 1e-12);
  assert.ok(verdict.reasonCodes.includes("CLAMPED_STATE_BOUND"));
});

test("hold is always zero-valued after validation", () => {
  const verdict = evaluateAgentProposal(
    proposal("hold", 999),
    baseState,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  assert.equal(verdict.allowed, true);
  assert.deepEqual(verdict.action, { type: "hold", value: 0 });
});

test("virtual actuator refuses rejected verdict", () => {
  const verdict = evaluateAgentProposal(
    proposal("seed_rpm_delta_norm", 0.1),
    { ...baseState, emergencyStop: true },
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  assert.throws(() => applySafetyVerdict(baseState, verdict));
});

test("virtual actuator applies only safety-approved delta", () => {
  const verdict = evaluateAgentProposal(
    proposal("rf_power_delta_norm", 1),
    baseState,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );
  const next = applySafetyVerdict(baseState, verdict);

  assert.equal(verdict.status, "clamped");
  assert.ok(Math.abs(next.rfPowerNorm - 1.05) < 1e-12);
  assert.equal(next.seedRotationNorm, baseState.seedRotationNorm);
});
