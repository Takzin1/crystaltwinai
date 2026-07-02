/**
 * Core shared types for CrystalTwin-AI.
 *
 * Everything that flows between the simulation engine, the rule-based
 * recommendation layer and the UI is typed here, so that individual
 * modules (scoring, risk, recommendation) can be swapped out without
 * touching the rest of the app.
 */

export type LanguageCode = "ja" | "en";

/** A string that carries both display languages. */
export interface LocalizedText {
  ja: string;
  en: string;
}

/** Identifiers of the six controllable input parameters. */
export type ParameterId =
  | "temperature"
  | "concentration"
  | "stirringSpeed"
  | "coolingRate"
  | "impurityLevel"
  | "timeSteps";

/** Static definition of one input parameter (label, range, unit). */
export interface ParameterDefinition {
  id: ParameterId;
  label: LocalizedText;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description: LocalizedText;
}

/** A concrete set of input values chosen by the user. */
export type SimulationInput = Record<ParameterId, number>;

export type LogLevel = "info" | "warn" | "alert";

export interface LogEvent {
  step: number;
  level: LogLevel;
  message: LocalizedText;
}

/** State of the virtual process at one time step. */
export interface StepState {
  step: number;
  temperature: number;
  concentration: number;
  /** Supersaturation ratio S = C / C_sat(T). Growth requires S > 1. */
  supersaturation: number;
  /** Instantaneous linear growth rate (a.u., roughly µm/min). */
  growthRate: number;
  /** Cumulative crystal yield (a.u. 0–100). */
  crystalYield: number;
  /** Instantaneous process stability (0–100). */
  stability: number;
  /** Instantaneous expected crystal quality (0–100). */
  quality: number;
}

export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessment {
  level: RiskLevel;
  /** Human-readable reasons why this level was assigned. */
  reasons: LocalizedText[];
}

export interface Recommendation {
  id: string;
  /** What the operator could do next. */
  message: LocalizedText;
  /** Why the rule fired — explainability is a design requirement. */
  reason: LocalizedText;
  priority: number;
}

export interface SimulationSummary {
  avgGrowthRate: number;
  maxSupersaturation: number;
  nucleationEvents: number;
  finalYield: number;
  stabilityScore: number;
  qualityScore: number;
  risk: RiskAssessment;
  recommendations: Recommendation[];
}

/** Summary metrics before risk/recommendation are attached. */
export type SummaryMetrics = Omit<SimulationSummary, "risk" | "recommendations">;

export interface SimulationResult {
  input: SimulationInput;
  series: StepState[];
  log: LogEvent[];
  summary: SimulationSummary;
}
