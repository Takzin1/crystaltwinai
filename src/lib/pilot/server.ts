/**
 * Server-only helpers for the CrystalPilot API routes: request limits,
 * best-effort abuse controls, input validation and optional attestation.
 *
 * Rate limits are in-memory per server instance. On serverless platforms
 * each instance keeps its own counters, so these are a cost guard, not a
 * security boundary; provider-side spend limits remain the real budget.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SCENARIOS } from "../../config/scenarios";
import { validateSimulationInput } from "../validation";
import type { SimulationInput } from "../types";
import { canonicalJson } from "./canonical";
import type { Attestation, InferenceRecord } from "./evidence";
import { SUMMARY_METRICS } from "./snapshot";
import type { ExperimentHistoryItem } from "./planner";
import { KNOWN_PARAMETERS } from "./planner";

export const MAX_REQUEST_BYTES = 64 * 1024;

export class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "RequestError";
  }
}

export async function readJsonBody(request: Request, limit = MAX_REQUEST_BYTES): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > limit) throw new RequestError(413, "Request body too large.");
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new RequestError(403, "Invalid origin.");
    }
    if (host && originHost !== host) throw new RequestError(403, "Cross-origin requests are not accepted.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit) throw new RequestError(413, "Request body too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new RequestError(400, "Request body must be JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new RequestError(400, "Request body must be an object.");
  return body as Record<string, unknown>;
}

export function parseSimulationInput(value: unknown): SimulationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(400, "input must be an object.");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== KNOWN_PARAMETERS.length) throw new RequestError(400, "input must contain exactly the six parameters.");
  const input = Object.fromEntries(KNOWN_PARAMETERS.map((k) => [k, record[k]])) as SimulationInput;
  try {
    validateSimulationInput(input);
  } catch (error) {
    throw new RequestError(400, error instanceof Error ? error.message : "Invalid input.");
  }
  return input;
}

export function parseScenarioId(value: unknown): string {
  if (typeof value !== "string" || !SCENARIOS.some((s) => s.id === value)) throw new RequestError(400, "Unknown scenario.");
  return value;
}

export function parseHistory(value: unknown): ExperimentHistoryItem[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 5) throw new RequestError(400, "history must be an array of at most 5 items.");
  return value.map((item) => {
    const it = item as Record<string, unknown>;
    const changes = it?.changes as Record<string, unknown>;
    const observed = it?.observed as Record<string, unknown>;
    if (!changes || typeof changes !== "object" || !observed || typeof observed !== "object") {
      throw new RequestError(400, "history items need changes and observed objects.");
    }
    const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
    const c = Object.entries(changes);
    const o = Object.entries(observed);
    if (c.length > 3 || !c.every(([k, v]) => KNOWN_PARAMETERS.includes(k) && num(v))) throw new RequestError(400, "invalid history changes.");
    if (!o.every(([k, v]) => (SUMMARY_METRICS as readonly string[]).includes(k) && num(v))) throw new RequestError(400, "invalid history observations.");
    return { changes: Object.fromEntries(c) as Record<string, number>, observed: Object.fromEntries(o) as Record<string, number> };
  });
}

// ------------------------------------------------------------- rate limiting

interface Window {
  count: number;
  resetAt: number;
}
const perClient = new Map<string, Window>();
let global: Window = { count: 0, resetAt: 0 };

function limits(env = process.env) {
  const n = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    perClientPer10Min: n(env.PILOT_LIVE_CALLS_PER_CLIENT_10MIN, 12),
    globalPerHour: n(env.PILOT_LIVE_CALLS_PER_HOUR, 120),
  };
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/** Reserves one live model call; throws 429 when a budget is exhausted. */
export function reserveLiveCall(key: string, now = Date.now()): { remainingClient: number; remainingGlobal: number } {
  const { perClientPer10Min, globalPerHour } = limits();
  if (now >= global.resetAt) global = { count: 0, resetAt: now + 3_600_000 };
  let w = perClient.get(key);
  if (!w || now >= w.resetAt) {
    w = { count: 0, resetAt: now + 600_000 };
    perClient.set(key, w);
  }
  if (perClient.size > 5000) {
    for (const [k, v] of perClient) if (now >= v.resetAt) perClient.delete(k);
  }
  if (global.count >= globalPerHour) throw new RequestError(429, "The demo's hourly live-inference budget is exhausted. Use OFFLINE DEMO mode or try later.");
  if (w.count >= perClientPer10Min) throw new RequestError(429, "Live-inference limit for this client reached (10-minute window). Use OFFLINE DEMO mode or wait.");
  w.count += 1;
  global.count += 1;
  return { remainingClient: perClientPer10Min - w.count, remainingGlobal: globalPerHour - global.count };
}

export function budgetStatus(now = Date.now()) {
  const { perClientPer10Min, globalPerHour } = limits();
  return {
    perClientPer10Min,
    globalPerHour,
    globalUsedThisHour: now >= global.resetAt ? 0 : global.count,
  };
}

/** Test hook. */
export function resetLimiter() {
  perClient.clear();
  global = { count: 0, resetAt: 0 };
}

// ------------------------------------------------------------- attestation

function secret(env = process.env): string | null {
  const s = env.EVIDENCE_ATTESTATION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function attestationAvailable(): boolean {
  return secret() !== null;
}

function attestedFields(binding: string, inf: InferenceRecord) {
  return canonicalJson({
    binding,
    mode: inf.mode,
    provider: inf.provider,
    requestedModel: inf.requestedModel,
    responseModel: inf.responseModel,
    responseId: inf.responseId,
    rawContentSha256: inf.rawContentSha256,
    startedAt: inf.startedAt,
    usage: inf.usage,
  });
}

/**
 * HMAC over the live inference record, bound to the run (proposal) or to the
 * approved proposal hash (interpretation). Proves the record came from a
 * server holding the secret — not that its claims are scientifically true.
 */
export function attest(binding: string, inf: InferenceRecord): Attestation | null {
  const s = secret();
  if (!s || inf.mode !== "live_nebius") return null;
  return {
    alg: "HMAC-SHA256",
    keyId: createHash("sha256").update(s).digest("hex").slice(0, 8),
    mac: createHmac("sha256", s).update(attestedFields(binding, inf)).digest("hex"),
  };
}

export function checkAttestation(binding: string, inf: InferenceRecord): "valid" | "invalid" | "absent" | "unavailable" {
  if (!inf.attestation) return "absent";
  const s = secret();
  if (!s) return "unavailable";
  const expected = attest(binding, { ...inf, attestation: null });
  if (!expected || expected.keyId !== inf.attestation.keyId) return "invalid";
  const a = Buffer.from(expected.mac, "hex");
  const b = Buffer.from(String(inf.attestation.mac), "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? "valid" : "invalid";
}

export function errorResponse(error: unknown): Response {
  if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
  console.error("[pilot] unexpected error", error instanceof Error ? error.name : typeof error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
