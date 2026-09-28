import type {
  AgentRuntime,
  AgentRuntimeRequest,
  RuntimeProviderResponse,
  RuntimeUsage,
} from "./runtime";

export interface TokenFactoryClientRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}

export interface TokenFactoryClientResponse {
  text: string;
  requestId?: string;
  usage?: RuntimeUsage;
}

/**
 * Internal abstraction over the official Nebius Token Factory client/API.
 *
 * This intentionally does not encode a guessed HTTP endpoint or wire format.
 * A verified official client adapter can implement this interface later.
 */
export interface TokenFactoryInferenceClient {
  complete(
    request: TokenFactoryClientRequest,
  ): Promise<TokenFactoryClientResponse>;
}

const SYSTEM_PROMPT = `
You are the proposal layer for CrystalTwinAI.
Return exactly one JSON object and no prose.

Schema:
{
  "proposed_action": {
    "type": "hold" | "temperature_offset_delta_norm" | "seed_rpm_delta_norm" | "crucible_rpm_delta_norm" | "rf_power_delta_norm" | "magnetic_field_delta_norm",
    "value": number
  },
  "reason": string,
  "evidence": string[],
  "confidence": number
}

Constraints:
- confidence must be between 0 and 1.
- You only propose an action.
- You do not directly actuate equipment or mutate plant state.
- The downstream deterministic safety gate may reject or clamp your proposal.
`.trim();

export function parseStructuredProposal(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`$/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

export class NebiusTokenFactoryRuntime implements AgentRuntime {
  readonly id = "nebius-token-factory";

  constructor(
    private readonly client: TokenFactoryInferenceClient,
    readonly model: string,
  ) {
    if (!model.trim()) {
      throw new Error("Nebius model identifier is required");
    }
  }

  async propose(
    request: AgentRuntimeRequest,
    signal?: AbortSignal,
  ): Promise<RuntimeProviderResponse> {
    const response = await this.client.complete({
      model: this.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: JSON.stringify({
        request_id: request.requestId,
        objective: request.objective,
        state: request.state,
        evidence: request.evidence,
      }),
      signal,
    });

    return {
      output: parseStructuredProposal(response.text),
      rawText: response.text,
      providerRequestId: response.requestId,
      usage: response.usage,
    };
  }
}
