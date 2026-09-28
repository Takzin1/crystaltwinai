import type { VirtualPlantState } from "./types";

export interface AgentRuntimeRequest {
  requestId: string;
  state: VirtualPlantState;
  objective: string;
  evidence: string[];
}

export interface RuntimeUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface RuntimeProviderResponse {
  output: unknown;
  rawText?: string;
  providerRequestId?: string;
  usage?: RuntimeUsage;
}

export interface AgentRuntime {
  readonly id: string;
  readonly model?: string;
  propose(
    request: AgentRuntimeRequest,
    signal?: AbortSignal,
  ): Promise<RuntimeProviderResponse>;
}

export interface RuntimeEvidence {
  requestId: string;
  runtimeId: string;
  model?: string;
  providerRequestId?: string;
  status: "ok" | "timeout" | "error";
  startedAtMs: number;
  endedAtMs: number;
  latencyMs: number;
  rawText?: string;
  usage?: RuntimeUsage;
  error?: string;
}
