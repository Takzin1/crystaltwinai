/**
 * MOCKED contract tests for the Nebius Token Factory client. These use a fake
 * fetch and prove nothing about the real service; the live check is
 * `npm run live:smoke` (requires NEBIUS_API_KEY, never runs in CI).
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SCENARIOS } from "../src/config/scenarios";
import { proposeExperiment } from "../src/lib/pilot/agent";
import { buildEvidence, serializeEvidence, verifyEvidence } from "../src/lib/pilot/evidence";
import {
  DEFAULT_BASE_URL,
  ProviderError,
  backoff,
  chatCompletion,
  loadConfig,
  safeText,
} from "../src/lib/pilot/nemotron";
import { currentState } from "../src/lib/pilot/workflow";

const KEY = "test-key-SHOULD-NEVER-LEAK-123";
const config = { ...loadConfig({ NEBIUS_API_KEY: KEY }), maxRetries: 2, timeoutMs: 1000 };
const noSleep = async () => {};

function okBody(content: string, extra: Record<string, unknown> = {}) {
  return {
    id: "chatcmpl-mock-1",
    model: "nvidia/mock-nemotron",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 812, completion_tokens: 140, total_tokens: 952 },
    ...extra,
  };
}

function fakeFetch(responses: (Response | Error)[], calls: { url: string; init: RequestInit }[] = []) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra call");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

test("config: defaults, https enforcement, model id validation", () => {
  const c = loadConfig({});
  assert.equal(c.apiKey, null);
  assert.equal(c.baseUrl, DEFAULT_BASE_URL);
  assert.throws(() => loadConfig({ NEBIUS_BASE_URL: "http://api.tokenfactory.nebius.com/v1" }), /https/);
  assert.throws(() => loadConfig({ NEBIUS_MODEL: "nvidia/model; rm -rf /" }), /simple provider ids/);
  assert.equal(loadConfig({ NEBIUS_TIMEOUT_MS: "999999" }).timeoutMs, 55_000);
  assert.equal(loadConfig({ NEBIUS_MAX_RETRIES: "-5" }).maxRetries, 0);
});

test("request contract: OpenAI-compatible body, bearer auth, usage and ids recorded", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const rec = await chatCompletion(config, "nvidia/mock-nemotron", [{ role: "user", content: "hi" }], {
    fetchImpl: fakeFetch([json(okBody('{"ok":true}'))], calls),
  });
  assert.equal(calls[0].url, "https://api.tokenfactory.nebius.com/v1/chat/completions");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${KEY}`);
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.model, "nvidia/mock-nemotron");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(typeof body.max_tokens, "number");
  assert.equal(rec.responseId, "chatcmpl-mock-1");
  assert.equal(rec.responseModel, "nvidia/mock-nemotron");
  assert.deepEqual(rec.usage, { promptTokens: 812, completionTokens: 140, totalTokens: 952 });
  assert.equal(rec.attempts, 1);
  assert.equal(rec.estimatedCostUsd, null, "no invented prices");
});

test("cost is estimated only from explicitly configured prices", async () => {
  const priced = { ...config, priceInputPerM: 0.1, priceOutputPerM: 0.4 };
  const rec = await chatCompletion(priced, "m", [], { fetchImpl: fakeFetch([json(okBody("{}"))]) });
  assert.ok(Math.abs(rec.estimatedCostUsd! - (812 * 0.1 + 140 * 0.4) / 1e6) < 1e-12);
});

test("retries 429 with Retry-After, then succeeds; bounded attempts", async () => {
  const waits: number[] = [];
  const rec = await chatCompletion(config, "m", [], {
    fetchImpl: fakeFetch([json({ error: "slow down" }, 429, { "retry-after": "2" }), json(okBody("{}"))]),
    sleepImpl: async (ms) => void waits.push(ms),
  });
  assert.equal(rec.attempts, 2);
  assert.deepEqual(waits, [2000]);
  await assert.rejects(
    chatCompletion(config, "m", [], {
      fetchImpl: fakeFetch([json({}, 503), json({}, 502), json({}, 500)]),
      sleepImpl: noSleep,
    }),
    (e: ProviderError) => e.kind === "provider_error" && e.attempts === 3,
  );
  assert.equal(backoff(1, null), 500);
  assert.equal(backoff(3, null), 2000);
  assert.equal(backoff(1, "3600"), 4000, "Retry-After is capped");
});

test("auth errors are not retried and never echo the key", async () => {
  await assert.rejects(
    chatCompletion(config, "m", [], { fetchImpl: fakeFetch([json({ error: `bad key ${KEY}` }, 401)]), sleepImpl: noSleep }),
    (e: ProviderError) => e.kind === "auth" && e.attempts === 1 && !e.message.includes(KEY),
  );
  await assert.rejects(
    chatCompletion(config, "m", [], {
      fetchImpl: fakeFetch([new Response(`invalid request for Bearer ${KEY}`, { status: 418 })]),
      sleepImpl: noSleep,
    }),
    (e: ProviderError) => !e.message.includes(KEY) && e.message.includes("[redacted]"),
  );
  assert.equal(safeText(`x ${KEY} y`, KEY), "x [redacted] y");
});

test("timeouts and network failures are classified and retried", async () => {
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  await assert.rejects(
    chatCompletion(config, "m", [], { fetchImpl: fakeFetch([abort, abort, abort]), sleepImpl: noSleep }),
    (e: ProviderError) => e.kind === "timeout" && e.attempts === 3,
  );
  const rec = await chatCompletion(config, "m", [], {
    fetchImpl: fakeFetch([new TypeError("fetch failed"), json(okBody("{}"))]),
    sleepImpl: noSleep,
  });
  assert.equal(rec.attempts, 2);
});

test("real timeout: a hanging provider is aborted", async () => {
  const hanging = ((_u: unknown, init?: RequestInit) =>
    new Promise((_r, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })) as typeof fetch;
  const started = Date.now();
  await assert.rejects(
    chatCompletion({ ...config, timeoutMs: 1000, maxRetries: 0 }, "m", [], { fetchImpl: hanging }),
    (e: ProviderError) => e.kind === "timeout",
  );
  assert.ok(Date.now() - started < 3000);
});

test("response_format rejection falls back once to plain mode", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const rec = await chatCompletion({ ...config, maxRetries: 0 }, "m", [], {
    fetchImpl: fakeFetch([json({ error: "response_format json_object not supported" }, 400), json(okBody("{}"))], calls),
  });
  assert.equal(rec.jsonModeUsed, false);
  assert.equal(JSON.parse(String(calls[1].init.body)).response_format, undefined);
});

test("missing credentials and malformed responses fail explicitly", async () => {
  await assert.rejects(chatCompletion(loadConfig({}), "m", []), (e: ProviderError) => e.kind === "missing_credentials");
  await assert.rejects(
    chatCompletion(config, "m", [], { fetchImpl: fakeFetch([json({ choices: [] })]) }),
    (e: ProviderError) => e.kind === "bad_response",
  );
});

// ---- pipeline with a MOCK completer (labelled live_nebius only inside this test)

const unstable = SCENARIOS.find((s) => s.id === "unstable")!;
const mockCompleter = (content: string) => async () => ({
  provider: "nebius-token-factory" as const,
  baseUrlHost: "api.tokenfactory.nebius.com",
  requestedModel: "nvidia/mock-nemotron",
  responseModel: "nvidia/mock-nemotron",
  responseId: "chatcmpl-mock",
  content,
  finishReason: "stop",
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  estimatedCostUsd: null,
  latencyMs: 5,
  attempts: 1,
  jsonModeUsed: true,
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
});

test("pipeline: reasoning block + fenced JSON from a model is parsed strictly", async () => {
  const content = '<think>consider cooling</think>\n```json\n{"hypothesis":"Slower cooling reduces bursts.","rationale":"Model threshold.","changes":{"coolingRate":0.7},"requestedAction":"simulation_only","prediction":[{"metric":"nucleationEvents","direction":"decrease"}]}\n```';
  const run = await proposeExperiment({ mode: "live", scenarioId: "unstable", input: { ...unstable.input } }, mockCompleter(content));
  assert.equal(currentState(run.history), "AWAITING_REVIEW");
  const proposal = JSON.parse(run.proposalText!);
  assert.deepEqual(proposal.source, { origin: "unverified_model", providerLabel: "nebius-token-factory", modelLabel: "nvidia/mock-nemotron" });
  assert.equal(run.inference!.mode, "live_nebius");
  assert.equal(run.inference!.notes.length, 2);
  const report = verifyEvidence(serializeEvidence(buildEvidence(run)));
  assert.equal(report.overall, "PASS");
  assert.equal(report.checks.find((c) => c.id === "inference_record")!.status, "warn", "unattested live record is flagged");
});

test("pipeline: provider failure ends in FAILED with no proposal", async () => {
  const run = await proposeExperiment({ mode: "live", scenarioId: "unstable", input: { ...unstable.input } }, async () => {
    throw new ProviderError("rate_limited", "Provider rate limit reached (HTTP 429).", 429, 3, 10);
  });
  assert.equal(currentState(run.history), "FAILED");
  assert.equal(run.proposalText, null);
  assert.deepEqual(run.inferenceError, { kind: "rate_limited", message: "Provider rate limit reached (HTTP 429)." });
  assert.equal(verifyEvidence(serializeEvidence(buildEvidence(run))).overall, "PASS");
});

test("pipeline: text scraping is not attempted (prose around JSON is rejected)", async () => {
  const content = 'Here you go: {"hypothesis":"h","rationale":"r","changes":{"coolingRate":0.7},"requestedAction":"simulation_only"}';
  const run = await proposeExperiment({ mode: "live", scenarioId: "unstable", input: { ...unstable.input } }, mockCompleter(content));
  assert.equal(currentState(run.history), "REJECTED");
  assert.match(run.plannerRejection!, /must be UTF-8 JSON/);
});

test("live interpretation: contradicting claims → INCONCLUSIVE; verifier re-derives it", async () => {
  const { finalizeRun, liveInferenceRecord, reviewRun, simulateRun } = await import("../src/lib/pilot/agent");
  const { checkModelInterpretation } = await import("../src/lib/pilot/experiment");
  const { unwrapModelContent } = await import("../src/lib/pilot/planner");
  const { canonicalSha256 } = await import("../src/lib/pilot/canonical");
  const run = await proposeExperiment({ mode: "offline", scenarioId: "unstable", input: { ...unstable.input } }, null);
  const simulated = simulateRun(reviewRun(run, { reviewerLabel: "t", decision: "approve", attestEducationalOnly: true }));
  // Model wrongly claims nucleation increased and overclaims validation.
  const content = JSON.stringify({
    summary: "This proves the process is validated for production.",
    claims: [{ metric: "nucleationEvents", direction: "increase" }, { metric: "qualityScore", direction: "increase" }],
    caveats: [],
    followUpIdea: null,
  });
  const interpretation = checkModelInterpretation(content, simulated.experiment!, (c) => unwrapModelContent(c).text);
  assert.deepEqual(interpretation.contradictions, ["nucleationEvents: model says increase, simulator computed decrease"]);
  assert.ok(interpretation.overclaimWarnings.length >= 2);
  const record = liveInferenceRecord(await mockCompleter(content)());
  const done = finalizeRun(simulated, interpretation, record);
  assert.equal(currentState(done.history), "INCONCLUSIVE");
  const evidence = buildEvidence(done);
  assert.equal(verifyEvidence(serializeEvidence(evidence)).overall, "PASS");
  // Hide the contradiction and re-hash: the verifier re-derives it from the raw model output.
  evidence.body.run.interpretation!.contradictions = [];
  evidence.integrity.bodySha256 = canonicalSha256(evidence.body);
  const report = verifyEvidence(serializeEvidence(evidence));
  assert.equal(report.integrity, "VERIFIED");
  assert.equal(report.overall, "FAIL");
});
