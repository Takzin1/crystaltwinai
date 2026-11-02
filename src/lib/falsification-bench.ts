/**
 * Synthetic software falsification bench; NOT experimental model validation.
 * Cross-checks bounded software invariants, exact repeatability and disagreements
 * among independently implemented (but partly assumption-sharing) toy models.
 * There are no measured observations, calibration, holdout scores or device I/O.
 */
import { SCENARIOS } from "../config/scenarios";
import { SCORING_CONFIG as C } from "../config/scoring.config";
import { auditConservativeReference, runConservativeReference, CONSERVATIVE_REFERENCE_ID,
  type ConservativeState } from "./conservative-reference";
import { runSimulation } from "./engine";
import { residualDiagnostics } from "./verification-statistics";
import { runAlternativeReference } from "./verification-models";
import { validateSimulationInput } from "./validation";
import type { SimulationInput, SimulationResult } from "./types";

export const FALSIFICATION_SCHEMA = "crystaltwin-falsification-bench/1" as const;
const EPS = 1e-9;
/** Teaching-only divergence prompt; NOT a scientific accuracy threshold. */
export const EDUCATIONAL_DISCREPANCY_ALERT_G_PER_ML = 0.01;

function approximate(a: number, b: number, epsilon = EPS): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
}

/** Independent software invariant checks, excluding uncalibrated "yield" as mass. */
export function auditPrimaryTrajectory(simulation: SimulationResult): string[] {
  validateSimulationInput(simulation.input);
  const {input, series, summary} = simulation;
  const issues: string[] = [];
  if (!Array.isArray(series) || series.length !== input.timeSteps) {
    return ["primary trajectory length mismatch"];
  }
  let priorTemp = input.temperature;
  let priorConcentration = input.concentration;
  let priorYield = 0;
  let sumGrowth = 0;
  let maximumSupersaturation = 0;
  let qualityWeighted = 0;
  let stabilityWeighted = 0;
  let weightTotal = 0;
  for (let index = 0; index < series.length; index++) {
    const point = series[index];
    const step = index + 1;
    if (!point || ![
      point.step, point.temperature, point.concentration, point.supersaturation,
      point.growthRate, point.crystalYield, point.quality, point.stability,
    ].every(v => typeof v === "number" && Number.isFinite(v))) {
      issues.push("primary nonfinite step " + step);
      continue;
    }
    if (point.step !== step) issues.push("primary noncontiguous step " + step);
    const expectedTemp = Math.max(C.minTemperature,
      input.temperature - step * input.coolingRate * C.dtMinutes);
    if (!approximate(point.temperature, expectedTemp) ||
        point.temperature > priorTemp + EPS) {
      issues.push("primary cooling schedule violation at step " + step);
    }
    if (point.concentration < -EPS ||
        point.concentration > priorConcentration + EPS) {
      issues.push("primary concentration monotonicity violation at step " + step);
    }
    if (point.supersaturation < 0) {
      issues.push("primary supersaturation must be nonnegative at step " + step);
    }
    if (point.growthRate < 0 || point.crystalYield < priorYield - EPS ||
        point.crystalYield > 100 + EPS || point.crystalYield < -EPS) {
      issues.push("primary growth/yield bounds violation at step " + step);
    }
    if (point.quality < 0 || point.quality > 100 ||
        point.stability < 0 || point.stability > 100) {
      issues.push("primary score bounds violation at step " + step);
    }
    priorTemp = point.temperature;
    priorConcentration = point.concentration;
    priorYield = point.crystalYield;
    sumGrowth += point.growthRate;
    maximumSupersaturation = Math.max(maximumSupersaturation,point.supersaturation);
    const weight = 1 + (C.lateStepWeight - 1) * index /
      Math.max(1,series.length - 1);
    qualityWeighted += point.quality * weight;
    stabilityWeighted += point.stability * weight;
    weightTotal += weight;
  }
  if (typeof summary?.finalYield !== "number" ||
      !approximate(summary.finalYield, priorYield, 1e-7)) {
    issues.push("primary final yield summary mismatch");
  }
  if (typeof summary?.avgGrowthRate !== "number" ||
      !approximate(summary.avgGrowthRate, sumGrowth / series.length, 1e-7)) {
    issues.push("primary growth mean summary mismatch");
  }
  if (![summary?.qualityScore,summary?.stabilityScore].every(v =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100)) {
    issues.push("primary summary score out of bounds");
  } else if (!approximate(summary.qualityScore,qualityWeighted/weightTotal,1e-7) ||
      !approximate(summary.stabilityScore,stabilityWeighted/weightTotal,1e-7)) {
    issues.push("primary weighted score summary mismatch");
  }
  if (!approximate(summary?.maxSupersaturation, maximumSupersaturation,1e-7)) {
    issues.push("primary max supersaturation summary mismatch");
  }
  if (typeof summary?.nucleationEvents !== "number" ||
      !Number.isInteger(summary.nucleationEvents) ||
      summary.nucleationEvents < 0 || summary.nucleationEvents > series.length) {
    issues.push("primary nucleation event summary invalid");
  }
  return issues;
}

export interface BenchmarkCase {
  id: string;
  input: SimulationInput;
  primarySoftwareIssues: string[];
  conservativeSoftwareIssues: string[];
  deterministicRepeat: boolean;
  primaryVsRelaxation: {
    temperatureMaxAbs: number;
    concentrationRmse: number;
  };
  primaryVsConservative: {
    temperatureMaxAbs: number;
    concentrationRmse: number;
  };
  conservativeClosureMaxAbs: number;
  /** Model discrepancy is *not* an accuracy or physical-validity verdict. */
  concentrationDisagreementAlert: boolean;
  softwareInvariantsPass: boolean;
}
export interface FalsificationReport {
  schemaVersion: typeof FALSIFICATION_SCHEMA;
  kind: "synthetic_software_falsification_only";
  models: {
    primary: "crystaltwin_educational_supersaturation";
    relaxation: "first_order_relaxation_v1";
    conservative: typeof CONSERVATIVE_REFERENCE_ID;
  };
  evaluationPolicy: {
    softwareTolerance: number;
    educationalDiscrepancyAlertGPerMl: number;
    comparisonFields: ["temperature", "concentration"];
  };
  cases: BenchmarkCase[];
  summary: {
    cases: number;
    softwareFailures: number;
    modelDisagreementAlerts: number;
    largestConcentrationRmse: number;
  };
  evidence: {
    experimentalDataUsed: false;
    trainedOrCalibrated: false;
    holdoutValidated: false;
    physicalModelValidated: false;
    hardwareExecuted: false;
  };
  limitations: string[];
}

function maxAbsDifference(
  reference: readonly {temperature: number}[],
  candidate: readonly {temperature: number}[],
): number {
  return Math.max(...reference.map((r, i) => Math.abs(r.temperature - candidate[i].temperature)));
}
function concentrationRmse(
  primary: SimulationResult,
  other: readonly {concentration: number}[],
): number {
  return residualDiagnostics(primary.series.map((p, i) => other[i].concentration - p.concentration)).rmse;
}
function convertConservative(rows: readonly ConservativeState[]) {
  return rows.map(p => ({temperature: p.temperature, concentration: p.liquidConcentration}));
}
export function runFalsificationBenchmark(
  currentInput?: SimulationInput,
): FalsificationReport {
  if (currentInput) validateSimulationInput(currentInput);
  const trials = [
    ...SCENARIOS.map(s => ({id:s.id,input:{...s.input}})),
    ...(currentInput ? [{id:"current-user-input",input:{...currentInput}}] : []),
  ];
  const cases: BenchmarkCase[] = trials.map(({id,input}) => {
    const main = runSimulation(input);
    const repeat = runSimulation(input);
    const relaxation = runAlternativeReference(input);
    const conservative = runConservativeReference(input);
    const closure = auditConservativeReference(input, conservative);
    const primarySoftwareIssues = auditPrimaryTrajectory(main);
    const determinism = JSON.stringify(main) === JSON.stringify(repeat);
    const relaxDiff = {
      temperatureMaxAbs: maxAbsDifference(relaxation, main.series),
      concentrationRmse: concentrationRmse(main, relaxation),
    };
    const conservativeShape = convertConservative(conservative);
    const massDiff = {
      temperatureMaxAbs: maxAbsDifference(conservativeShape, main.series),
      concentrationRmse: concentrationRmse(main, conservativeShape),
    };
    const softwareInvariantsPass = primarySoftwareIssues.length === 0 &&
      closure.accepted && determinism && relaxDiff.temperatureMaxAbs <= EPS &&
      massDiff.temperatureMaxAbs <= EPS;
    return {
      id,input,primarySoftwareIssues,conservativeSoftwareIssues:closure.violations,
      deterministicRepeat:determinism,primaryVsRelaxation:relaxDiff,
      primaryVsConservative:massDiff,
      conservativeClosureMaxAbs:closure.maxAbsMassClosureError,
      concentrationDisagreementAlert: Math.max(relaxDiff.concentrationRmse,
        massDiff.concentrationRmse) > EDUCATIONAL_DISCREPANCY_ALERT_G_PER_ML,
      softwareInvariantsPass,
    };
  });
  return {
    schemaVersion: FALSIFICATION_SCHEMA,kind:"synthetic_software_falsification_only",
    models: {
      primary:"crystaltwin_educational_supersaturation",
      relaxation:"first_order_relaxation_v1",
      conservative:CONSERVATIVE_REFERENCE_ID,
    },
    evaluationPolicy: {
      softwareTolerance:EPS,
      educationalDiscrepancyAlertGPerMl:EDUCATIONAL_DISCREPANCY_ALERT_G_PER_ML,
      comparisonFields:["temperature","concentration"],
    },
    cases,
    summary: {
      cases:cases.length,
      softwareFailures:cases.filter(item=>!item.softwareInvariantsPass).length,
      modelDisagreementAlerts:cases.filter(item=>item.concentrationDisagreementAlert).length,
      largestConcentrationRmse:Math.max(...cases.flatMap(item=>[
        item.primaryVsRelaxation.concentrationRmse,
        item.primaryVsConservative.concentrationRmse,
      ])),
    },
    evidence: {
      experimentalDataUsed:false,trainedOrCalibrated:false,holdoutValidated:false,
      physicalModelValidated:false,hardwareExecuted:false,
    },
    limitations: [
      "All inputs and outcomes are synthetic and rule-based.",
      "All three illustrative models share the same linear solubility and cooling assumptions.",
      "The conservative reference checks its own mass closure, not the primary model's arbitrary yield score.",
      "A model-to-model concentration disagreement does not reveal which model is correct.",
      "No independent physical measurements, calibration, statistical holdout, or hardware execution.",
      "Discrepancy alert threshold is for teaching only, not calibrated to any material or process.",
    ],
  };
}
