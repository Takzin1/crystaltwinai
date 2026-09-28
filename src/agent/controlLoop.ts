import { evaluateAgentProposal } from "./safetyGate";
import { applySafetyVerdict } from "./virtualActuator";
import type {
  SafetyEnvelope,
  SafetyVerdict,
  VirtualPlantState,
} from "./types";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  RuntimeEvidence,
  RuntimeProviderResponse,
} from "./runtime";

export interface ControlStepResult {
  nextState: VirtualPlantState;
  verdict: SafetyVerdict;
  runtimeEvidence: RuntimeEvidence;
}

class RuntimeTimeoutError extends Error {
  constructor() {
    super("agent runtime timeout");
    this.name = "RuntimeTimeoutError";
  }
}

function failClosedVerdict(
  code: "RUNTIME_ERROR" | "RUNTIME_TIMEOUT",
): SafetyVerdict {
  return {
    allowed: false,
    status: "rejected",
    reasonCodes: [code],
    action: null,
    originalAction: null,
  };
}

async function invokeWithTimeout(
  runtime: AgentRuntime,
  request: AgentRuntimeRequest,
  timeoutMs: number,
): Promise<RuntimeProviderResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new RuntimeTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      runtime.propose(request, controller.signal),
      timeout,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function runAgentControlStep(
  runtime: AgentRuntime,
  request: AgentRuntimeRequest,
  state: VirtualPlantState,
  envelope: SafetyEnvelope,
  options: { timeoutMs?: number; now?: () => number } = {},
): Promise<ControlStepResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive finite number");
  }

  const now = options.now ?? Date.now;
  const startedAtMs = now();

  try {
    const providerResponse = await invokeWithTimeout(
      runtime,
      request,
      timeoutMs,
    );
    const endedAtMs = now();

    const verdict = evaluateAgentProposal(
      providerResponse.output,
      state,
      envelope,
    );

    const nextState = verdict.allowed
      ? applySafetyVerdict(state, verdict)
      : { ...state };

    return {
      nextState,
      verdict,
      runtimeEvidence: {
        requestId: request.requestId,
        runtimeId: runtime.id,
        model: runtime.model,
        providerRequestId: providerResponse.providerRequestId,
        status: "ok",
        startedAtMs,
        endedAtMs,
        latencyMs: Math.max(0, endedAtMs - startedAtMs),
        rawText: providerResponse.rawText,
        usage: providerResponse.usage,
      },
    };
  } catch (error) {
    const endedAtMs = now();
    const timedOut = error instanceof RuntimeTimeoutError;
    const verdict = failClosedVerdict(
      timedOut ? "RUNTIME_TIMEOUT" : "RUNTIME_ERROR",
    );

    return {
      nextState: { ...state },
      verdict,
      runtimeEvidence: {
        requestId: request.requestId,
        runtimeId: runtime.id,
        model: runtime.model,
        status: timedOut ? "timeout" : "error",
        startedAtMs,
        endedAtMs,
        latencyMs: Math.max(0, endedAtMs - startedAtMs),
        error:
          error instanceof Error
            ? error.message
            : "unknown runtime failure",
      },
    };
  }
}
