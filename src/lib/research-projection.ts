import type { ExperimentalDataset, Measurement, DataField } from "./datasets";
import type { ResearchDataset } from "./research-schema";
import { normalizedTrajectory } from "./research-time-series";

/**
 * ONLY a bounded technical v1 representation.
 * This is NOT scientific comparability, physical validation, or calibration.
 * The existing educational model remains a generic pedagogical approximation.
 */
export function projectResearchToEducationalV1(
  dataset: ResearchDataset,
  explicitAcknowledgement: boolean,
): ExperimentalDataset {
  if (!explicitAcknowledgement) throw new Error("Explicit educational-only acknowledgement required.");
  const m=dataset.metadata;
  if (m.experimentMode !== "trajectory") throw new Error("Only trajectories can be projected to v1.");
  const series=new Set(dataset.measurements.map(row =>
    JSON.stringify([row.runId??"",row.cycleId??"",row.channelId??""])
  ));
  if (series.size !== 1) throw new Error("v1 projection cannot combine multiple runs/cycles/channels.");
  if (dataset.measurements.some(row => row.missingReasons?.temperature || row.missingReasons?.concentration)) {
    throw new Error("v1 projection refuses explicitly missing temperature or concentration.");
  }
  if (m.concentrationBasis !== "g_per_mL_solution" || m.units.concentration !== "g/mL") {
    throw new Error("Concentration is not explicitly g/mL of solution.");
  }
  if (m.timeOrigin !== "relative_to_run_start") {
    throw new Error("v1 projection requires explicitly declared relative_to_run_start time origin.");
  }
  if (!m.units.time || !m.units.temperature || m.temperatureSource !== "sample") {
    throw new Error("Explicit time units and sample-temperature semantics required.");
  }
  const t = normalizedTrajectory(dataset,"temperature");
  const allRows=dataset.measurements;
  if (t.length !== allRows.length) throw new Error("Missing temperature observations.");
  if (allRows.length < 2 || allRows.length > 200) throw new Error("v1 accepts 2–200 rows.");
  const data: Measurement[]=[];
  for (let i=0;i<allRows.length;i++) {
    const point = t[i];
    if (point.value === null) throw new Error("v1 projection refuses missing temperature.");
    const step = point.timeMinutes; // v1 step = 1 minute since reference origin
    if (!Number.isInteger(step) || step < 1 || step > 200) {
      throw new Error("Cannot project non-integer, out-of-range or zero-origin time to v1.");
    }
    if (i > 0 && step <= data[i-1].step) throw new Error("Non-monotonic time.");
    const concentration=allRows[i].concentration;
    if (concentration === undefined) throw new Error("Missing concentration.");
    if (point.value < 0 || point.value > 150 || concentration < 0 || concentration > 1) {
      throw new Error("Measurement exceeds v1 supported ranges.");
    }
    data.push({step,temperature:point.value,concentration});
  }
  // Explicitly omit v2 PSD, pressure, experimental growth kinetics and quality.
  const fields: DataField[]=["temperature","concentration"];
  return {schemaVersion:1,name:m.title,rows:data,fields};
}
