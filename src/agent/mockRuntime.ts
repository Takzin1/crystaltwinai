import type {
  AgentRuntime,
  AgentRuntimeRequest,
  RuntimeProviderResponse,
} from "./runtime";

type ProposalFactory = (
  request: AgentRuntimeRequest,
) => unknown | Promise<unknown>;

export class MockAgentRuntime implements AgentRuntime {
  readonly id = "mock";
  readonly model = "deterministic-mock-v0";

  constructor(private readonly factory: ProposalFactory) {}

  async propose(
    request: AgentRuntimeRequest,
    signal?: AbortSignal,
  ): Promise<RuntimeProviderResponse> {
    if (signal?.aborted) {
      throw new Error("mock runtime aborted");
    }

    const output = await this.factory(request);

    if (signal?.aborted) {
      throw new Error("mock runtime aborted");
    }

    return {
      output,
      rawText: JSON.stringify(output),
      providerRequestId: `mock-${request.requestId}`,
    };
  }
}
