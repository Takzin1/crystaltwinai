/**
 * Server-side client for NVIDIA Nemotron models on Nebius Token Factory
 * (OpenAI-compatible Chat Completions API).
 *
 * SERVER ONLY: reads NEBIUS_API_KEY from the environment. Never import this
 * module from a client component. The key is never logged, returned or
 * echoed in error messages.
 */

export const DEFAULT_BASE_URL = "https://api.tokenfactory.nebius.com/v1/";
/** Shown on Nebius's Nemotron page; confirm with `npm run live:smoke` (lists /v1/models). */
export const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";

export interface NemotronConfig {
  apiKey: string | null;
  baseUrl: string;
  proposeModel: string;
  interpretModel: string;
  timeoutMs: number;
  maxRetries: number;
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
  priceInputPerM: number | null;
  priceOutputPerM: number | null;
}

function envNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = value === undefined || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function envPrice(value: string | undefined): number | null {
  const n = value === undefined || value.trim() === "" ? NaN : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const MODEL_ID = /^[A-Za-z0-9._\-/:]{1,120}$/;

export function loadConfig(env: Record<string, string | undefined> = process.env): NemotronConfig {
  const key = env.NEBIUS_API_KEY?.trim();
  let baseUrl = env.NEBIUS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "https:") throw new Error("NEBIUS_BASE_URL must use https.");
  if (!baseUrl.endsWith("/")) baseUrl += "/";
  const model = (value: string | undefined) => {
    const id = value?.trim() || DEFAULT_MODEL;
    if (!MODEL_ID.test(id)) throw new Error("Model identifiers must be simple provider ids.");
    return id;
  };
  return {
    apiKey: key ? key : null,
    baseUrl,
    proposeModel: model(env.NEBIUS_MODEL_PROPOSE ?? env.NEBIUS_MODEL),
    interpretModel: model(env.NEBIUS_MODEL_INTERPRET ?? env.NEBIUS_MODEL),
    timeoutMs: envNumber(env.NEBIUS_TIMEOUT_MS, 30_000, 1_000, 55_000),
    maxRetries: envNumber(env.NEBIUS_MAX_RETRIES, 2, 0, 3),
    maxTokens: envNumber(env.NEBIUS_MAX_TOKENS, 2048, 128, 8192),
    temperature: envNumber(env.NEBIUS_TEMPERATURE, 0.2, 0, 1.5),
    jsonMode: env.NEBIUS_JSON_MODE !== "off",
    priceInputPerM: envPrice(env.NEBIUS_PRICE_INPUT_PER_M),
    priceOutputPerM: envPrice(env.NEBIUS_PRICE_OUTPUT_PER_M),
  };
}

export type ProviderErrorKind =
  | "missing_credentials"
  | "auth"
  | "rate_limited"
  | "timeout"
  | "network"
  | "provider_error"
  | "bad_response";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status: number | null,
    readonly attempts: number,
    readonly latencyMs: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface Usage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface CompletionRecord {
  provider: "nebius-token-factory";
  baseUrlHost: string;
  requestedModel: string;
  responseModel: string | null;
  responseId: string | null;
  content: string;
  finishReason: string | null;
  usage: Usage;
  estimatedCostUsd: number | null;
  latencyMs: number;
  attempts: number;
  jsonModeUsed: boolean;
  startedAt: string;
  finishedAt: string;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

type FetchLike = typeof fetch;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Redacts the API key and bounds any provider-supplied text. */
export function safeText(text: string, apiKey: string | null, max = 300): string {
  let out = text.replace(/[\u0000-\u001f]+/g, " ");
  if (apiKey) out = out.split(apiKey).join("[redacted]");
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]");
  return out.slice(0, max);
}

function intOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function chatCompletion(
  config: NemotronConfig,
  model: string,
  messages: ChatMessage[],
  options: { fetchImpl?: FetchLike; now?: () => number; sleepImpl?: (ms: number) => Promise<void> } = {},
): Promise<CompletionRecord> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const wait = options.sleepImpl ?? sleep;
  const startedMs = now();
  const startedAt = new Date().toISOString();
  if (!config.apiKey) {
    throw new ProviderError("missing_credentials", "NEBIUS_API_KEY is not configured on the server.", null, 0, 0);
  }
  const url = new URL("chat/completions", config.baseUrl).toString();
  let jsonMode = config.jsonMode;
  let attempts = 0;
  let lastError: ProviderError | null = null;
  let maxAttempts = 1 + config.maxRetries;

  while (attempts < maxAttempts) {
    attempts += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      const aborted = error instanceof Error && error.name === "AbortError";
      lastError = new ProviderError(
        aborted ? "timeout" : "network",
        aborted ? `Provider did not answer within ${config.timeoutMs} ms.` : "Network error reaching the provider.",
        null, attempts, now() - startedMs,
      );
      if (attempts < maxAttempts) await wait(backoff(attempts, null));
      continue;
    }
    clearTimeout(timer);

    if (response.ok) {
      let body: Record<string, unknown>;
      try {
        body = (await response.json()) as Record<string, unknown>;
      } catch {
        throw new ProviderError("bad_response", "Provider returned non-JSON content.", response.status, attempts, now() - startedMs);
      }
      const choice = Array.isArray(body.choices) ? (body.choices[0] as Record<string, unknown> | undefined) : undefined;
      const message = choice?.message as Record<string, unknown> | undefined;
      const content = message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new ProviderError("bad_response", "Provider response has no message content.", response.status, attempts, now() - startedMs);
      }
      const usageRaw = (body.usage ?? {}) as Record<string, unknown>;
      const usage: Usage = {
        promptTokens: intOrNull(usageRaw.prompt_tokens),
        completionTokens: intOrNull(usageRaw.completion_tokens),
        totalTokens: intOrNull(usageRaw.total_tokens),
      };
      const cost =
        config.priceInputPerM !== null && config.priceOutputPerM !== null &&
        usage.promptTokens !== null && usage.completionTokens !== null
          ? (usage.promptTokens * config.priceInputPerM + usage.completionTokens * config.priceOutputPerM) / 1e6
          : null;
      return {
        provider: "nebius-token-factory",
        baseUrlHost: new URL(config.baseUrl).host,
        requestedModel: model,
        responseModel: typeof body.model === "string" ? body.model.slice(0, 120) : null,
        responseId: typeof body.id === "string" ? body.id.slice(0, 120) : null,
        content,
        finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : null,
        usage,
        estimatedCostUsd: cost,
        latencyMs: now() - startedMs,
        attempts,
        jsonModeUsed: jsonMode,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
    }

    const detail = safeText(await response.text().catch(() => ""), config.apiKey);
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("auth", `Provider rejected the credentials (HTTP ${response.status}).`, response.status, attempts, now() - startedMs);
    }
    if ((response.status === 400 || response.status === 422) && jsonMode && /response_format|json/i.test(detail)) {
      // Some models reject response_format; retry once without it. The strict
      // parser still requires a pure JSON object either way.
      jsonMode = false;
      maxAttempts += 1;
      continue;
    }
    if (RETRYABLE.has(response.status)) {
      lastError = new ProviderError(
        response.status === 429 ? "rate_limited" : "provider_error",
        response.status === 429 ? "Provider rate limit reached (HTTP 429)." : `Provider error (HTTP ${response.status}).`,
        response.status, attempts, now() - startedMs,
      );
      if (attempts < maxAttempts) await wait(backoff(attempts, response.headers.get("retry-after")));
      continue;
    }
    throw new ProviderError("provider_error", `Provider error (HTTP ${response.status}): ${detail}`, response.status, attempts, now() - startedMs);
  }
  throw lastError ?? new ProviderError("provider_error", "Provider call failed.", null, attempts, now() - startedMs);
}

/** Exponential backoff with Retry-After honoured up to 4 s. */
export function backoff(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(4_000, seconds * 1000);
  return Math.min(4_000, 500 * 2 ** (attempt - 1));
}

export async function listModels(
  config: NemotronConfig,
  fetchImpl: FetchLike = fetch,
): Promise<string[]> {
  if (!config.apiKey) throw new ProviderError("missing_credentials", "NEBIUS_API_KEY is not configured on the server.", null, 0, 0);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs, 15_000));
  try {
    const response = await fetchImpl(new URL("models", config.baseUrl).toString(), {
      headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ProviderError(response.status === 401 || response.status === 403 ? "auth" : "provider_error",
        `Model listing failed (HTTP ${response.status}).`, response.status, 1, 0);
    }
    const body = (await response.json()) as { data?: { id?: unknown }[] };
    return (body.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string" && MODEL_ID.test(id))
      .sort();
  } finally {
    clearTimeout(timer);
  }
}

export const isNvidiaModel = (id: string) => /^nvidia\//i.test(id) || /nemotron/i.test(id);
