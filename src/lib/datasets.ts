import type { StepState } from "./types";

/**
 * Versioned, client-only experimental data import.
 * This data is NEVER used to drive the educational simulation or equipment.
 */
export const DATASET_SCHEMA_VERSION = 1;
export const MAX_DATASET_BYTES = 512 * 1024;
export const MAX_DATASET_ROWS = 200;

export const DATA_FIELDS = [
  "temperature",
  "concentration",
  "growthRate",
  "crystalYield",
  "quality",
] as const;
export type DataField = (typeof DATA_FIELDS)[number];
export type Measurement = { step: number } & Partial<Record<DataField, number>>;
export interface ExperimentalDataset {
  schemaVersion: 1;
  name: string;
  rows: Measurement[];
  fields: DataField[];
}
export interface FieldError {
  field: DataField;
  count: number;
  mae: number;
  rmse: number;
  bias: number;
}
export interface DatasetComparison {
  matchedRows: number;
  unmatchedRows: number;
  fields: FieldError[];
}

const FIELD_LIMITS: Record<DataField, [number, number]> = {
  temperature: [0, 150],
  concentration: [0, 1],
  growthRate: [0, 200],
  crystalYield: [0, 100],
  quality: [0, 100],
};
const ALLOWED_HEADERS = new Set<string>(["step", ...DATA_FIELDS]);
const REQUIRED = ["step", "temperature", "concentration"];
const NUMERIC = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      if (cell.length !== 0 || closed) throw new Error("Invalid CSV quoting.");
      quoted = true;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && input[i + 1] === "\n") i++;
        if (row.some((v) => v.trim() !== "")) rows.push(row);
        row = [];
        if (rows.length > MAX_DATASET_ROWS + 1) throw new Error("Too many rows.");
      }
    } else {
      if (closed && c !== " " && c !== "\t") throw new Error("Invalid characters after quote.");
      cell += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

function parseNumber(raw: unknown, key: string, line: number): number {
  if (typeof raw === "string") {
    if (!NUMERIC.test(raw.trim())) throw new Error(`Row ${line}: ${key} must be a finite number.`);
    raw = Number(raw.trim());
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(`Row ${line}: ${key} must be a finite number.`);
  }
  return raw;
}

function normalizeRows(rawRows: unknown[], name: string): ExperimentalDataset {
  if (rawRows.length < 2 || rawRows.length > MAX_DATASET_ROWS) {
    throw new Error(`Dataset must contain 2–${MAX_DATASET_ROWS} observations.`);
  }
  const rows: Measurement[] = [];
  const available = new Set<DataField>();
  let previousStep = 0;
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Row ${i + 1}: expected an object.`);
    }
    const record = raw as Record<string, unknown>;
    const keys = Object.keys(record);
    for (const key of keys) {
      if (!ALLOWED_HEADERS.has(key)) throw new Error(`Row ${i + 1}: unknown column "${key}".`);
    }
    for (const key of REQUIRED) {
      if (!(key in record) || record[key] === "" || record[key] === null) {
        throw new Error(`Row ${i + 1}: missing required ${key}.`);
      }
    }
    const step = parseNumber(record.step, "step", i + 1);
    if (!Number.isInteger(step) || step < 1 || step > MAX_DATASET_ROWS || step <= previousStep) {
      throw new Error(`Row ${i + 1}: step must be a strictly increasing integer in 1–${MAX_DATASET_ROWS}.`);
    }
    previousStep = step;
    const output: Measurement = { step };
    for (const field of DATA_FIELDS) {
      const value = record[field];
      if (value === undefined || value === null || value === "") {
        if (field === "temperature" || field === "concentration") {
          throw new Error(`Row ${i + 1}: missing required ${field}.`);
        }
        continue;
      }
      const numeric = parseNumber(value, field, i + 1);
      const [min, max] = FIELD_LIMITS[field];
      if (numeric < min || numeric > max) {
        throw new Error(`Row ${i + 1}: ${field} outside allowed range [${min}, ${max}].`);
      }
      output[field] = numeric;
      available.add(field);
    }
    rows.push(output);
  }
  return { schemaVersion: 1, name: name.slice(0, 120), rows, fields: DATA_FIELDS.filter((key) => available.has(key)) };
}

/** Rejects oversized data before parsing. Caller must separately check File.size. */
export function parseDataset(content: string, format: "csv" | "json", name = "dataset"): ExperimentalDataset {
  if (new TextEncoder().encode(content).byteLength > MAX_DATASET_BYTES) {
    throw new Error("File exceeds the 512 KiB import limit.");
  }
  if (format === "csv") {
    const parsed = parseCsvRows(content.replace(/^\uFEFF/, ""));
    const header = parsed.shift()?.map((s) => s.trim());
    if (!header?.length || new Set(header).size !== header.length) throw new Error("Missing or duplicate CSV headers.");
    if (header.some((key) => !ALLOWED_HEADERS.has(key))) throw new Error("CSV contains unknown headers.");
    if (REQUIRED.some((key) => !header.includes(key))) throw new Error("CSV must include step, temperature, concentration.");
    const rows = parsed.map((cells, i) => {
      if (cells.length !== header.length) throw new Error(`CSV row ${i + 2}: wrong number of columns.`);
      return Object.fromEntries(header.map((key, j) => [key, cells[j].trim()]));
    });
    return normalizeRows(rows, name);
  }
  let data: unknown;
  try { data = JSON.parse(content.replace(/^\uFEFF/, "")); }
  catch { throw new Error("Invalid JSON."); }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("JSON root must be {schemaVersion:1, rows:[...]}.");
  }
  const obj = data as Record<string, unknown>;
  if (obj.schemaVersion !== DATASET_SCHEMA_VERSION || !Array.isArray(obj.rows)) {
    throw new Error("Unsupported JSON schema. Expected schemaVersion: 1 and rows array.");
  }
  return normalizeRows(obj.rows, typeof obj.name === "string" ? obj.name : name);
}

/**
 * Compare matching time steps only. No calibration, actuation or model updates.
 * bias = observation - simulation, all errors in native field units.
 */
export function compareDataset(dataset: ExperimentalDataset, simulated: StepState[]): DatasetComparison {
  const byStep = new Map(simulated.map((row) => [row.step, row]));
  const matched = dataset.rows.filter((row) => byStep.has(row.step));
  const fields: FieldError[] = [];
  for (const field of dataset.fields) {
    const diffs = matched
      .filter((row) => row[field] !== undefined)
      .map((row) => (row[field] as number) - (byStep.get(row.step) as StepState)[field]);
    if (diffs.length === 0) continue;
    fields.push({
      field,
      count: diffs.length,
      mae: diffs.reduce((n, d) => n + Math.abs(d), 0) / diffs.length,
      rmse: Math.sqrt(diffs.reduce((n, d) => n + d * d, 0) / diffs.length),
      bias: diffs.reduce((n, d) => n + d, 0) / diffs.length,
    });
  }
  return { matchedRows: matched.length, unmatchedRows: dataset.rows.length - matched.length, fields };
}
