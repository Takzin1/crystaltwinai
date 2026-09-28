import test from "node:test";
import assert from "node:assert/strict";

import { runAgentControlStep } from "./controlLoop";
import { MockAgentRuntime } from "./mockRuntime";
import {
  NebiusTokenFactoryRuntime,
  type TokenFactoryInferenceClient,
} from "./nebiusTokenFactoryRuntime";
import { DEMO_NORMALIZED_SAFETY_ENVELOPE } from "./safetyEnvelope";
import type { VirtualPlantState } from "./types";

const state: VirtualPlantState = {
  temperatureOffsetNorm: 0,
  seedRotationNorm: 0.5,
  crucibleRotationNorm: 0,
  rfPowerNorm: 1,
  magneticFieldNorm: 0.5,
  emergencyStop: false,
};

const request = {
  requestId: "req-1",
  state,
  objective: "improve normalized demo stability",
  evidence: ["sensor.synthetic"],
};

function validProposal(value = 0.01) {
  return {
    proposed_action: {
      type: "seed_rpm_delta_norm",
      value,
    },
    reason: "test",
    evidence: ["sensor.synthetic"],
    confidence: 0.8,
  };
}

test("mock runtime must still pass through deterministic safety clamp", async () => {
  const runtime = new MockAgentRuntime(() => validProposal(999));
  const result = await runAgentControlStep(
    runtime,
    request,
    state,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );

  assert.equal(result.verdict.allowed, true);
  assert.equal(result.verdict.status, "clamped");
  assert.ok(result.verdict.reasonCodes.includes("CLAMPED_DELTA"));
  assert.ok(Math.abs(result.nextState.seedRotationNorm - 0.6) < 1e-12);
});

test("malformed runtime output fails closed without changing state", async () => {
  const runtime = new MockAgentRuntime(() => ({ nope: true }));
  const result = await runAgentControlStep(
    runtime,
    request,
    state,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );

  assert.equal(result.verdict.allowed, false);
  assert.deepEqual(result.nextState, state);
  assert.ok(result.verdict.reasonCodes.includes("INVALID_PROPOSAL"));
});

test("provider exception fails closed", async () => {
  const runtime = new MockAgentRuntime(() => {
    throw new Error("provider unavailable");
  });
  const result = await runAgentControlStep(
    runtime,
    request,
    state,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );

  assert.equal(result.verdict.allowed, false);
  assert.ok(result.verdict.reasonCodes.includes("RUNTIME_ERROR"));
  assert.equal(result.runtimeEvidence.status, "error");
  assert.deepEqual(result.nextState, state);
});

test("timeout fails closed", async () => {
  const runtime = new MockAgentRuntime(
    () => new Promise(() => undefined),
  );
  const result = await runAgentControlStep(
    runtime,
    request,
    state,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
    { timeoutMs: 5 },
  );

  assert.equal(result.verdict.allowed, false);
  assert.ok(result.verdict.reasonCodes.includes("RUNTIME_TIMEOUT"));
  assert.equal(result.runtimeEvidence.status, "timeout");
  assert.deepEqual(result.nextState, state);
});

test("Nebius adapter parses structured JSON through injected client", async () => {
  const calls: Array<{ model: string; systemPrompt: string; userPrompt: string }> = [];

  const client: TokenFactoryInferenceClient = {
    async complete(input) {
      calls.push({
        model: input.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
      });
      return {
        text: JSON.stringify(validProposal(0.02)),
        requestId: "provider-123",
        usage: { totalTokens: 42 },
      };
    },
  };

  const runtime = new NebiusTokenFactoryRuntime(
    client,
    "verified-model-id-to-be-configured",
  );

  const result = await runAgentControlStep(
    runtime,
    request,
    state,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "verified-model-id-to-be-configured");
  assert.equal(result.runtimeEvidence.providerRequestId, "provider-123");
  assert.equal(result.runtimeEvidence.usage?.totalTokens, 42);
  assert.ok(Math.abs(result.nextState.seedRotationNorm - 0.52) < 1e-12);
});

test("fenced JSON is accepted but still safety checked", async () => {
  const client: TokenFactoryInferenceClient = {
    async complete() {
      return {
        text: `\`\`\`json
${JSON.stringify(validProposal(50))}
\`\`\``,
      };
    },
  };

  const runtime = new NebiusTokenFactoryRuntime(client, "model");
  const result = await runAgentControlStep(
    runtime,
    request,
    state,
    DEMO_NORMALIZED_SAFETY_ENVELOPE,
  );

  assert.equal(result.verdict.status, "clamped");
  assert.ok(result.verdict.reasonCodes.includes("CLAMPED_DELTA"));
});
