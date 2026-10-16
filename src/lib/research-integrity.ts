import type {
  ResearchDataset, ResearchField, ResearchMeasurement, TransformationRecord,
} from "./research-schema";

/**
 * Structural diagnostics; neither claimed provenance nor physical model
 * validity is authenticated by the importer.
 */
function seriesKey(row:ResearchMeasurement):string {
  return JSON.stringify([row.runId??"",row.cycleId??"",row.channelId??""]);
}
export interface SeriesSummary {
  runId:string | null;
  cycleId:string | null;
  channelId:string | null;
  rows:number;
  missingFields:number;
}
export interface ResearchSummary {
  series: SeriesSummary[];
  missingByField: Partial<Record<ResearchField,number>>;
  unverifiedClaims: string[];
  transformationCount:number;
}
export function summarizeResearchDataset(dataset:ResearchDataset):ResearchSummary {
  const series=new Map<string,SeriesSummary>();
  const missingByField: ResearchSummary["missingByField"]={};
  for (const row of dataset.measurements) {
    const key=seriesKey(row);
    let summary=series.get(key);
    if(!summary) {
      summary={runId:row.runId??null,cycleId:row.cycleId??null,channelId:row.channelId??null,rows:0,missingFields:0};
      series.set(key,summary);
    }
    summary.rows++;
    for(const field of Object.keys(row.missingReasons??{}) as ResearchField[]) {
      summary.missingFields++;
      missingByField[field]=(missingByField[field]??0)+1;
    }
  }
  const metadata=dataset.metadata;
  const unverifiedClaims=[
    ...(!metadata.doi ? ["DOI not declared"] : []),
    ...(!metadata.license ? ["License not declared"] : []),
    ...(!metadata.sourceFileSha256 ? ["Original source file SHA-256 not declared or verified"] :
      ["Original source file SHA-256 is DECLARED, not independently verified"]),
    ...(metadata.provenance === "unverified" ? ["Provenance not established"] :
      ["Provenance category is user-declared, not independently verified"]),
    ...(!metadata.timeOrigin && metadata.experimentMode === "trajectory"
      ? ["Time origin is unspecified"] : []),
  ];
  return {series:[...series.values()],missingByField,unverifiedClaims,transformationCount:metadata.transformations?.length??0};
}

/**
 * Strict comparability gate. Matching declarations are necessary but cannot
 * establish that underlying measurement conditions or materials actually match.
 */
export function assessResearchComparability(
  first:ResearchDataset,
  second:ResearchDataset,
  field:ResearchField,
): {comparable:boolean; reasons:string[]} {
  const a=first.metadata,b=second.metadata;
  const reasons:string[]=[];
  function same(name:string,x:unknown,y:unknown) {
    if(typeof x !== "string" || !x.trim() || typeof y !== "string" || !y.trim()) {
      reasons.push(name+": incomplete metadata");
    } else if(x.trim().toLowerCase() !== y.trim().toLowerCase()) {
      reasons.push(name+": mismatch");
    }
  }
  same("material",a.material,b.material);
  same("solvent",a.solvent,b.solvent);
  same("experiment mode",a.experimentMode,b.experimentMode);
  same("unit",a.units[field],b.units[field]);
  if(a.experimentMode==="trajectory" && b.experimentMode==="trajectory") {
    same("time origin",a.timeOrigin,b.timeOrigin);
    if(a.timeOrigin==="unknown" || b.timeOrigin==="unknown") reasons.push("Time origin is unknown.");
    // Deliberately require equal declared time units, even though separate conversions exist.
    same("time unit",a.units.time,b.units.time);
    if(summarizeResearchDataset(first).series.length!==1 || summarizeResearchDataset(second).series.length!==1) {
      reasons.push("Choose exactly one run/cycle/channel from each dataset before comparison.");
    }
  }
  if(field==="temperature") {
    same("temperature sensor type",a.temperatureSource,b.temperatureSource);
    if(a.temperatureSource==="unknown" || b.temperatureSource==="unknown") reasons.push("Temperature sensor provenance unknown.");
  }
  if(field==="pressure")same("pressure basis",a.pressureBasis,b.pressureBasis);
  if(field==="concentration" || field==="solubility"){
    same("concentration basis",a.concentrationBasis,b.concentrationBasis);
  }
  if(!first.measurements.some(row => typeof row[field]==="number") ||
     !second.measurements.some(row => typeof row[field]==="number")) {
    reasons.push("Both datasets must contain actual observed values for the selected field.");
  }
  return {comparable:reasons.length===0,reasons};
}
/** Caller must provide real evidence; this only appends a declaration. */
export function appendDeclaredTransformation(
  dataset:ResearchDataset,
  record:TransformationRecord,
):ResearchDataset {
  if(!record.software?.trim() || !record.version?.trim()) throw new Error("Transformation software and version required.");
  if(!["source_mapping","unit_conversion","time_alignment","filter","derived"].includes(record.operation)){
    throw new Error("Unknown transformation operation.");
  }
  const previous=dataset.metadata.transformations??[];
  if(previous.length>=100)throw new Error("Maximum 100 transformation records.");
  return {...dataset,metadata:{...dataset.metadata,
    transformations:[...previous,{...record}],
  }};
}
