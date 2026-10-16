import type { MissingReason, ResearchDataset } from "./research-schema";
import { hoursToMinutes, secondsToMinutes, kelvinToCelsius } from "./units";

/** A single sensor channel. Never concatenate unrelated experiments. */
export interface SeriesSelector { runId: string; cycleId: string; channelId: string }
export interface TimeValue {
  timeMinutes: number;
  /** Null means explicitly missing OR not reported; never a synthetic zero. */
  value: number | null;
  missingReason?: MissingReason | "not_reported";
}
export interface AlignedValue {
  timeMinutes: number;
  value: number | null;
  origin: "observed" | "interpolated" | "unavailable";
  reason?: string;
}
function identity(row: {runId?:string;cycleId?:string;channelId?:string}): string {
  return JSON.stringify([row.runId??"",row.cycleId??"",row.channelId??""]);
}
/** Keeps measurement nulls as explicit interpolation barriers. */
export function normalizedTrajectory(
  dataset: ResearchDataset,
  field: "temperature" | "pressure" | "concentration",
  selector?: SeriesSelector,
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
  const keys=new Set(dataset.measurements.map(identity));
  if (keys.size > 1 && !selector) {
    throw new Error("Multi-series trajectory requires explicit runId/cycleId/channelId selector.");
  }
  const selected = selector
    ? dataset.measurements.filter(row => identity(row) === identity(selector))
    : dataset.measurements;
  if (!selected.length) throw new Error("Selected research series not found.");
  const out: TimeValue[] = [];
  for (const row of selected) {
    if (typeof row.time !== "number") throw new Error("Trajectory requires numeric time.");
    const timeMinutes = timeUnit === "s" ? secondsToMinutes(row.time) :
      timeUnit === "h" ? hoursToMinutes(row.time) : row.time;
    const native = row[field];
    if (native === undefined) {
      out.push({timeMinutes,value:null,missingReason:row.missingReasons?.[field] ?? "not_reported"});
      continue;
    }
    const value = field === "temperature" && unit === "K" ? kelvinToCelsius(native) : native;
    out.push({timeMinutes,value});
  }
  return out;
}

/**
 * No extrapolation and no interpolation over explicit missing/not-reported rows.
 * Return origin labels so derived values can never be mistaken for measurements.
 */
export function alignByTimeDetailed(
  observations: TimeValue[],
  targetsMinutes: number[],
  maxGapMinutes = 5,
): AlignedValue[] {
  if (!(maxGapMinutes > 0) || !Number.isFinite(maxGapMinutes)) throw new Error("Invalid max gap.");
  if (!observations.length) {
    return targetsMinutes.map(time => ({timeMinutes:time,value:null,origin:"unavailable" as const,reason:"no_observations"}));
  }
  for (let i=0;i<observations.length;i++) {
    const p=observations[i];
    if (!Number.isFinite(p.timeMinutes) || (p.value !== null && !Number.isFinite(p.value))) {
      throw new Error("Non-finite observation.");
    }
    if (i > 0 && p.timeMinutes <= observations[i-1].timeMinutes) {
      throw new Error("Observation times must strictly increase.");
    }
  }
  return targetsMinutes.map(time => {
    if (!Number.isFinite(time)) throw new Error("Invalid target time.");
    if (time < observations[0].timeMinutes || time > observations[observations.length-1].timeMinutes) {
      return {timeMinutes:time,value:null,origin:"unavailable" as const,reason:"out_of_range"};
    }
    let left=0,right=observations.length-1;
    while (left <= right) {
      const middle=Math.floor((left+right)/2);
      if (observations[middle].timeMinutes === time) {
        const p=observations[middle];
        return p.value===null
          ? {timeMinutes:time,value:null,origin:"unavailable" as const,reason:p.missingReason ?? "explicit_missing"}
          : {timeMinutes:time,value:p.value,origin:"observed" as const};
      }
      if (observations[middle].timeMinutes < time) left=middle+1;
      else right=middle-1;
    }
    if (right < 0 || left >= observations.length) {
      return {timeMinutes:time,value:null,origin:"unavailable" as const,reason:"out_of_range"};
    }
    const a=observations[right], b=observations[left], gap=b.timeMinutes-a.timeMinutes;
    if (a.value===null || b.value===null) {
      return {timeMinutes:time,value:null,origin:"unavailable" as const,reason:"missing_observation_barrier"};
    }
    if (gap > maxGapMinutes) {
      return {timeMinutes:time,value:null,origin:"unavailable" as const,reason:"gap_too_large"};
    }
    return {
      timeMinutes:time,
      value:a.value+(time-a.timeMinutes)/gap*(b.value-a.value),
      origin:"interpolated" as const,
    };
  });
}

/** Compatibility wrapper for existing v2 callers. */
export function alignByTime(
  observations: TimeValue[],
  targetsMinutes: number[],
  maxGapMinutes = 5,
): Array<number | null> {
  return alignByTimeDetailed(observations,targetsMinutes,maxGapMinutes).map(p=>p.value);
}
