/**
 * Canonical JSON for evidence hashing (RFC 8785 / JCS style): object keys
 * sorted by UTF-16 code units, no whitespace, ECMAScript number formatting.
 * QFabric's Python verifier (src/qfabric/evidence.py) implements the same
 * rules so either side can recompute the other's digest.
 */
import { sha256Text } from "./sha256";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON requires finite numbers.");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((k) => record[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
  }
  throw new Error(`Canonical JSON cannot encode ${typeof value}.`);
}

export function canonicalSha256(value: unknown): string {
  return sha256Text(canonicalJson(value));
}
