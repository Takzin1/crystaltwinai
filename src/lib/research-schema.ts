/**
 * Research Schema v2: source-native measurements, no automatic projection into
 * the educational v1 step model. Validation does not certify scientific validity.
 */
export const RESEARCH_SCHEMA_VERSION = 2 as const;
export const MAX_RESEARCH_BYTES = 1024 * 1024;
export const MAX_RESEARCH_ROWS = 10000;

export type ProvenanceType = "unverified" | "measured" | "simulated" | "synthetic" | "mixed";
export type ExperimentMode = "trajectory" | "equilibrium_curve" | "endpoint_sweep" | "distribution";
export type ConcentrationBasis =
  | "g_per_mL_solution" | "g_per_g_solvent" | "mol_per_L"
  | "mass_fraction" | "mass_percent" | "mole_fraction" | "other";
export const RESEARCH_FIELDS = [
  "time", "temperature", "concentration", "pressure", "solubility",
  "growthRate", "crystalYield", "coolingRate", "stirringSpeed",
  "supersaturation", "nucleationRate", "inductionTime", "d10", "d50", "d90",
] as const;
export type ResearchField = (typeof RESEARCH_FIELDS)[number];
export type ResearchMeasurement = Partial<Record<ResearchField, number>> & {
  conditionId?: string;
};
export interface ResearchMetadata {
  title: string;
  sourceUrl?: string;
  doi?: string;
  authors: string[];
  publicationYear?: number;
  license?: string;
  provenance: ProvenanceType;
  experimentMode: ExperimentMode;
  material: string;
  solvent?: string;
  processType?: string;
  concentrationBasis?: ConcentrationBasis;
  pressureBasis?: "gauge" | "absolute";
  temperatureSource?: "sample" | "bath" | "unknown";
  measurementMethod?: string;
  coolingRate?: number;
  stirringSpeed?: number;
  units: Partial<Record<ResearchField, string>>;
  sourceFileSha256?: string;
  notes?: string;
}
export interface ResearchDataset {
  schemaVersion: 2;
  metadata: ResearchMetadata;
  measurements: ResearchMeasurement[];
}

const SOURCE_TYPES: ProvenanceType[] = ["unverified","measured","simulated","synthetic","mixed"];
const MODES: ExperimentMode[] = ["trajectory","equilibrium_curve","endpoint_sweep","distribution"];
const BASES: ConcentrationBasis[] = [
  "g_per_mL_solution","g_per_g_solvent","mol_per_L",
  "mass_fraction","mass_percent","mole_fraction","other",
];
const FIELDS = new Set<string>(RESEARCH_FIELDS);
const UNIT_OPTIONS: Record<ResearchField, readonly string[]> = {
  time: ["s","min","h"],
  temperature: ["°C","K"],
  concentration: ["g/mL","g/g_solvent","mol/L","fraction","%","mole_fraction","native"],
  pressure: ["bar","kPa","MPa"],
  solubility: ["g/mL","g/g_solvent","mol/L","fraction","%","mole_fraction","native"],
  growthRate: ["µm/min","mm/h","a.u./min","native"],
  crystalYield: ["fraction","%","g","a.u.","native"],
  coolingRate: ["°C/min","K/h","K/min"],
  stirringSpeed: ["rpm"],
  supersaturation: ["ratio","relative"],
  nucleationRate: ["1/(mL·min)","1/(L·s)","native"],
  inductionTime: ["s","min","h"],
  d10: ["µm","mm","nm"],
  d50: ["µm","mm","nm"],
  d90: ["µm","mm","nm"],
};
const EXPECTED_BASIS_UNIT: Partial<Record<ConcentrationBasis, string>> = {
  g_per_mL_solution: "g/mL",
  g_per_g_solvent: "g/g_solvent",
  mol_per_L: "mol/L",
  mass_fraction: "fraction",
  mass_percent: "%",
  mole_fraction: "mole_fraction",
};

function obj(value: unknown, at: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(at + " must be an object.");
  }
  return value as Record<string, unknown>;
}
function nonempty(value: unknown, name: string, max=240): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(name + " must be a non-empty string (max " + max + " characters).");
  }
  return value.trim();
}
function optional(value: unknown, name: string, max=500): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) throw new Error(name + " is invalid.");
  return value.trim();
}
function number(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(name + " must be a finite JSON number.");
  }
  return value;
}
function optionalNumber(value: unknown, name: string): number | undefined {
  return value === undefined ? undefined : number(value, name);
}
function choice<T extends string>(value: unknown, choices: readonly T[], name: string): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new Error(name + " is not supported.");
  }
  return value as T;
}
function url(value: unknown, name: string): string | undefined {
  const s = optional(value, name);
  if (!s) return s;
  let result: URL;
  try { result = new URL(s); } catch { throw new Error(name + " must be an https URL."); }
  if (result.protocol !== "https:" || !result.hostname) {
    throw new Error(name + " must be an https URL.");
  }
  return result.toString();
}
function metadataFrom(raw: unknown): ResearchMetadata {
  const m = obj(raw, "metadata");
  const mode = choice(m.experimentMode, MODES, "experimentMode");
  const provenance = choice(m.provenance, SOURCE_TYPES, "provenance");
  const unitInput = obj(m.units, "metadata.units");
  const units: ResearchMetadata["units"] = {};
  for (const [key, value] of Object.entries(unitInput)) {
    if (!FIELDS.has(key)) throw new Error("Unknown unit field: " + key);
    const field = key as ResearchField;
    units[field] = choice(value, UNIT_OPTIONS[field], "unit for " + key);
  }
  const authors = m.authors;
  if (!Array.isArray(authors) || authors.length > 40) throw new Error("authors must be an array (max 40).");
  const publicationYear = optionalNumber(m.publicationYear, "publicationYear");
  if (publicationYear !== undefined && (!Number.isInteger(publicationYear) || publicationYear < 1800 || publicationYear > 2200)) {
    throw new Error("publicationYear is invalid.");
  }
  const concentrationBasis = m.concentrationBasis === undefined
    ? undefined : choice(m.concentrationBasis, BASES, "concentrationBasis");
  const basisUnit = concentrationBasis && EXPECTED_BASIS_UNIT[concentrationBasis];
  if (basisUnit) {
    for (const field of ["concentration","solubility"] as const) {
      if (units[field] !== undefined && units[field] !== basisUnit) {
        throw new Error(field + " unit does not match concentrationBasis.");
      }
    }
  }
  const pressureBasis = m.pressureBasis === undefined
    ? undefined : choice(m.pressureBasis, ["gauge","absolute"] as const, "pressureBasis");
  const temperatureSource = m.temperatureSource === undefined
    ? undefined : choice(m.temperatureSource, ["sample","bath","unknown"] as const, "temperatureSource");
  const doi = optional(m.doi, "doi", 180);
  if (doi && !/^10\.\d{4,9}\/\S+$/i.test(doi)) throw new Error("Invalid DOI.");
  const sourceFileSha256 = optional(m.sourceFileSha256, "sourceFileSha256", 64);
  if (sourceFileSha256 && !/^[a-f0-9]{64}$/i.test(sourceFileSha256)) throw new Error("Invalid SHA-256.");
  return {
    title: nonempty(m.title,"title"),
    sourceUrl: url(m.sourceUrl,"sourceUrl"),
    doi,
    authors: authors.map((a,i) => nonempty(a,"authors[" + i + "]",160)),
    publicationYear,
    license: optional(m.license, "license",120),
    provenance, experimentMode: mode,
    material: nonempty(m.material,"material",160),
    solvent: optional(m.solvent,"solvent",160),
    processType: optional(m.processType,"processType",160),
    concentrationBasis, pressureBasis, temperatureSource,
    measurementMethod: optional(m.measurementMethod,"measurementMethod",300),
    coolingRate: optionalNumber(m.coolingRate,"coolingRate"),
    stirringSpeed: optionalNumber(m.stirringSpeed,"stirringSpeed"),
    units,
    sourceFileSha256,
    notes: optional(m.notes,"notes",1000),
  };
}
function rowFrom(raw: unknown, index: number, meta: ResearchMetadata): ResearchMeasurement {
  const r = obj(raw, "measurement " + index);
  const output: ResearchMeasurement = {};
  let count=0;
  for (const [key, value] of Object.entries(r)) {
    if (key === "conditionId") {
      output.conditionId = nonempty(value,"conditionId",120);
      continue;
    }
    if (!FIELDS.has(key)) {
      throw new Error("measurement " + index + ": unsupported field " + key + " (e.g. quality is not a physical measurement).");
    }
    const field = key as ResearchField;
    if (value === null) continue; // explicit missingness is not zero
    const v = number(value,"measurement " + index + "." + key);
    if (!meta.units[field]) throw new Error("Missing declared unit for " + key + ".");
    if (["concentration","solubility"].includes(key)) {
      if (!meta.concentrationBasis) throw new Error("concentrationBasis required for concentration / solubility.");
      if (v < 0) throw new Error(key + " cannot be negative.");
      if (["mass_fraction","mole_fraction"].includes(meta.concentrationBasis) && v > 1) throw new Error(key + " fraction > 1.");
      if (meta.concentrationBasis === "mass_percent" && v > 100) throw new Error(key + " percent > 100.");
    }
    if (field === "temperature" && meta.units.temperature === "K" && v < 0) throw new Error("Kelvin below zero.");
    if (field === "temperature" && meta.units.temperature === "°C" && v < -273.15) throw new Error("Temperature below absolute zero.");
    if (field === "pressure") {
      if (!meta.pressureBasis) throw new Error("pressureBasis required for pressure.");
      if (meta.pressureBasis === "absolute" && v < 0) throw new Error("Absolute pressure cannot be negative.");
    }
    if (["time","inductionTime","d10","d50","d90","nucleationRate","stirringSpeed"].includes(key) && v < 0) {
      throw new Error(key + " cannot be negative.");
    }
    if (field === "crystalYield" && meta.units.crystalYield === "fraction" && (v < 0 || v > 1)) throw new Error("Invalid yield fraction.");
    if (field === "crystalYield" && meta.units.crystalYield === "%" && (v < 0 || v > 100)) throw new Error("Invalid yield percent.");
    output[field] = v; count++;
  }
  if (count === 0) throw new Error("measurement " + index + " has no numeric observations.");
  return output;
}
/**
 * Accepts only self-describing research JSON, never XLSX/CSV without a
 * separately verified column mapping, substance, concentration basis & units.
 */
export function parseResearchDataset(content: string): ResearchDataset {
  if (new TextEncoder().encode(content).byteLength > MAX_RESEARCH_BYTES) {
    throw new Error("Research JSON exceeds 1 MiB.");
  }
  let raw: unknown;
  try { raw = JSON.parse(content.replace(/^\uFEFF/,"")); }
  catch { throw new Error("Invalid research JSON."); }
  const root = obj(raw,"dataset");
  if (root.schemaVersion !== 2) throw new Error("Expected research schemaVersion: 2.");
  const metadata = metadataFrom(root.metadata);
  if (!Array.isArray(root.measurements) || root.measurements.length < 1 || root.measurements.length > MAX_RESEARCH_ROWS) {
    throw new Error("Research dataset must have 1–" + MAX_RESEARCH_ROWS + " measurements.");
  }
  const rows: ResearchMeasurement[] = [];
  let previousTime = -Infinity;
  const conditionIds = new Set<string>();
  for (let i=0;i<root.measurements.length;i++) {
    const row = rowFrom(root.measurements[i], i+1, metadata);
    if (metadata.experimentMode === "trajectory") {
      if (row.time === undefined) throw new Error("Trajectory requires time in every row.");
      if (row.time <= previousTime) throw new Error("Trajectory times must strictly increase.");
      previousTime = row.time;
    }
    if (metadata.experimentMode === "equilibrium_curve" &&
        (row.temperature === undefined || row.solubility === undefined)) {
      throw new Error("Equilibrium curve requires temperature and solubility per row.");
    }
    if (metadata.experimentMode === "endpoint_sweep") {
      if (!row.conditionId) throw new Error("Endpoint sweep requires conditionId per row.");
      if (conditionIds.has(row.conditionId)) throw new Error("Duplicate conditionId.");
      conditionIds.add(row.conditionId);
    }
    if (metadata.experimentMode === "distribution" &&
      row.inductionTime === undefined && row.d10 === undefined && row.d50 === undefined && row.d90 === undefined) {
      throw new Error("Distribution requires induction time or particle-size data.");
    }
    if (row.d10 !== undefined && row.d50 !== undefined && row.d10 > row.d50) throw new Error("d10 exceeds d50.");
    if (row.d50 !== undefined && row.d90 !== undefined && row.d50 > row.d90) throw new Error("d50 exceeds d90.");
    rows.push(row);
  }
  return {schemaVersion:2,metadata,measurements:rows};
}
