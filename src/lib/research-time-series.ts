import type { ResearchDataset } from "./research-schema";
import { hoursToMinutes, secondsToMinutes, kelvinToCelsius } from "./units";

/**
 * Source-native rows stay unmodified. This produces a separate normalized view.
 * No extrapolation; interpolation is allowed only across sufficiently short gaps.
 */
export interface TimeValue {
  timeMinutes: number;
  value: number;
}
export function normalizedTrajectory(
  dataset: ResearchDataset, field: "temperature" | "pressure" | "concentration"
): TimeValue[] {
  if (dataset.metadata.experimentMode !== "trajectory") throw new Error("Not a trajectory.");
  const timeUnit = dataset.metadata.units.time;
  if (!timeUnit) throw new Error("Missing time unit.");
  const unit = dataset.metadata.units[field];
  if (!unit) throw new Error("Missing " + field + " unit.");
  if (field === "concentration" &&
    (dataset.metadata.concentrationBasis !== "g_per_mL_solution" || unit !== "g/mL")) {
    throw new Error("Cannot normalize concentration without g/mL of solution.");
  }
  if (field === "pressure" &&
    (dataset.metadata.pressureBasis !== "absolute" || unit !== "bar")) {
    throw new Error("Cannot normalize gauge or non-bar pressure without explicit conversion.");
  }
  const out: TimeValue[] = [];
  for (const row of dataset.measurements) {
    if (row[field] === undefined || row.time === undefined) continue;
    const timeMinutes = timeUnit === "s" ? secondsToMinutes(row.time) :
      timeUnit === "h" ? hoursToMinutes(row.time) : row.time;
    const value = field === "temperature" && unit === "K" ? kelvinToCelsius(row[field]) : row[field];
    out.push({timeMinutes,value});
  }
  return out;
}
export function alignByTime(
  observations: TimeValue[],
  targetsMinutes: number[],
  maxGapMinutes = 5,
): Array<number | null> {
  if (!(maxGapMinutes > 0) || !Number.isFinite(maxGapMinutes)) throw new Error("Invalid max gap.");
  if (!observations.length) return targetsMinutes.map(() => null);
  for (let i=0;i<observations.length;i++) {
    if (!Number.isFinite(observations[i].value) || !Number.isFinite(observations[i].timeMinutes)) {
      throw new Error("Non-finite observation.");
    }
    if (i > 0 && observations[i].timeMinutes <= observations[i-1].timeMinutes) {
      throw new Error("Observation times must strictly increase.");
    }
  }
  return targetsMinutes.map(time => {
    if (!Number.isFinite(time)) throw new Error("Invalid target time.");
    if (time < observations[0].timeMinutes || time > observations[observations.length-1].timeMinutes) return null;
    let left=0,right=observations.length-1;
    while (left <= right) {
      const middle = Math.floor((left+right)/2);
      if (observations[middle].timeMinutes === time) return observations[middle].value;
      if (observations[middle].timeMinutes < time) left=middle+1;
      else right=middle-1;
    }
    if (right < 0 || left >= observations.length) return null;
    const a=observations[right], b=observations[left], gap=b.timeMinutes-a.timeMinutes;
    if (gap > maxGapMinutes) return null;
    return a.value+(time-a.timeMinutes)/gap*(b.value-a.value);
  });
}
