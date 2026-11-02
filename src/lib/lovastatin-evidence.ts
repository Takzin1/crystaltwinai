/** Lovastatin Excel evidence contract: local/private only, not a new PBE model. */
export const LOVASTATIN_SCHEMA="crystaltwin-lovastatin-local-evidence/1" as const;
export const LOVASTATIN_SOURCE_URL=
 "https://pureportal.strath.ac.uk/en/datasets/data-for-benchmarking-model-based-design-of-experiment-approaches/";
export const LOVASTATIN_BOOKS={
 growth:{sha256:"507dbcfd45d4db149a19f5c33cbc6d2a27879007a16193877ae39f30ed0f3594",n:37,experiments:5},
 primary:{sha256:"91130c164d5c47af854cb3385422353863f79989bb3743de69eba4b1496b4618",n:38,experiments:4},
 secondary:{sha256:"2b478e12fdaf13a54c6c3d53921915a7e80d027df7d03830c0d3bcffcf5f06a5",n:75,experiments:11},
} as const;
export type LovastatinPhase=keyof typeof LOVASTATIN_BOOKS;
export const LOVASTATIN_PHASES=["growth","primary","secondary"] as const;
export type LovastatinRow={
 experimentId:string;timeSource:number;measuredSource:number;
 reportedPredictionSource:number;reportedStdDevSource:number;xlsxRow:number;
};
type Metrics={
 count:number;maeSourceUnits:number;rmseSourceUnits:number;
 biasPredictionMinusMeasurement:number;rmsReportedStdDevNormalizedResidual:number;
};
export type LovastatinEvidence={
 schema:typeof LOVASTATIN_SCHEMA;sourceUrl:string;license:string;
 measuredVsPredicted:string;timeUnit:string;measurementUnit:string;
 reportedStandardDeviationMeaning:string;
 records:Record<LovastatinPhase,{
  fileSha256:string;rowCount:number;experiments:string[];
  rows:LovastatinRow[];publishedPredictionMetrics:Metrics;
 }>;
 leakageGate:{
  overlapGrowthSecondary:string[];overlapPrimarySecondary:string[];
  secondaryOnlyExperimentCandidates:string[];
  secondaryIsGloballyIndependentHoldout:boolean;
  sourcePredictionsProvenIndependent:false;
  canClaimIndependentModelValidation:false;
 };
 physicalClaims:{
  measurementUnitsAuthenticated:false;originalExperimentProtocolsAuthenticated:false;
  newKineticParametersEstimated:false;prospectivePredictionsExecuted:false;
  physicalPbeValidated:false;sourceDataRedistributionPermitted:false;
 };
};
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const fail=(message:string):never=>{throw new Error("Lovastatin evidence rejected: "+message);};
const numeric=(x:unknown):x is number=>typeof x==="number"&&Number.isFinite(x);
const keysEqual=(a:readonly string[],b:readonly string[])=>
 a.length===b.length&&a.every((v,i)=>v===b[i]);
const sorted=(v:readonly string[])=>[...v].sort();
const get=(raw:unknown,key:string):Record<string,unknown>=>{
 if(!object(raw)||!object(raw[key]))fail("Missing "+key);
 return raw[key] as Record<string,unknown>;
};
export function lovastatinMetrics(rows:readonly LovastatinRow[]):Metrics{
 if(!rows.length)fail("Cannot measure an empty experiment");
 let a=0,sq=0,signed=0,weighted=0;
 for(const r of rows){
  const d=r.reportedPredictionSource-r.measuredSource;
  a+=Math.abs(d);sq+=d*d;signed+=d;weighted+=(d/r.reportedStdDevSource)**2;
 }
 return {count:rows.length,maeSourceUnits:a/rows.length,
  rmseSourceUnits:Math.sqrt(sq/rows.length),
  biasPredictionMinusMeasurement:signed/rows.length,
  rmsReportedStdDevNormalizedResidual:Math.sqrt(weighted/rows.length)};
}
function compareMetrics(actual:Metrics,record:unknown,name:string){
 if(!object(record))fail("Missing original "+name+" metrics");
 for(const key of Object.keys(actual) as (keyof Metrics)[]){
  if(!numeric(record[key])||Math.abs(actual[key]-record[key])>1e-10*Math.max(1,Math.abs(actual[key])))
   fail(name+" published metric differs from recomputed source comparison: "+key);
 }
}
function assertStringList(value:unknown,label:string):string[]{
 if(!Array.isArray(value)||value.some(v=>typeof v!=="string")||
    value.some((v,i)=>i>0&&v<=value[i-1]))fail("Noncanonical "+label);
 return value as string[];
}
export function validateLovastatinEvidence(input:unknown):LovastatinEvidence{
 if(!object(input)||input.schema!==LOVASTATIN_SCHEMA||
   input.sourceUrl!==LOVASTATIN_SOURCE_URL||
   input.timeUnit!=="unknown_in_uploaded_workbook"||
   input.measurementUnit!=="unknown_in_uploaded_workbook"||
   typeof input.license!=="string"||!input.license.includes("CC BY-NC-ND")||
   typeof input.measuredVsPredicted!=="string"||
   !(input.measuredVsPredicted.includes("NO model calibration")||
      input.measuredVsPredicted.includes("no new physical model run")))fail("Source identity/units/rights changed");
 const rec=get(input,"records");
 const groups:Record<LovastatinPhase,string[]>={growth:[],primary:[],secondary:[]};
 for(const phase of LOVASTATIN_PHASES){
  const group=get(rec,phase);
  const expected=LOVASTATIN_BOOKS[phase];
  if(group.fileSha256!==expected.sha256||group.rowCount!==expected.n||
     !Array.isArray(group.rows)||group.rows.length!==expected.n)
     fail(phase+" original workbook sha/row count mismatch");
  const latest=new Map<string,number>();
  const observedRows:LovastatinRow[]=[];
  for(const [i,r] of (group.rows as unknown[]).entries()){
   if(!object(r)||typeof r.experimentId!=="string"||
      !/^PICKL[0-9]{2,4}$/.test(r.experimentId)||
      !Number.isInteger(r.xlsxRow)||r.xlsxRow!==i+2||
      !numeric(r.timeSource)||r.timeSource<0||
      !numeric(r.measuredSource)||r.measuredSource<0||
      !numeric(r.reportedPredictionSource)||r.reportedPredictionSource<0||
      !numeric(r.reportedStdDevSource)||r.reportedStdDevSource<=0||
      r.timeSource<=(latest.get(r.experimentId)??-Infinity))
     fail(phase+" malformed row/time/provenance at "+i);
   latest.set(r.experimentId,r.timeSource);
   observedRows.push(r as LovastatinRow);
  }
  const fromRows=sorted([...latest.keys()]);
  const declared=assertStringList(group.experiments,phase+" experiment names");
  if(!keysEqual(fromRows,declared)||fromRows.length!==expected.experiments)
    fail(phase+" experiment identity/count mismatch");
  compareMetrics(lovastatinMetrics(observedRows),group.publishedPredictionMetrics,phase);
  groups[phase]=fromRows;
 }
 const overlapGrowth=groups.growth.filter(x=>groups.secondary.includes(x));
 const overlapPrimary=groups.primary.filter(x=>groups.secondary.includes(x));
 const secondaryOnly=groups.secondary.filter(x=>
  !groups.growth.includes(x)&&!groups.primary.includes(x));
 const gate=get(input,"leakageGate");
 const checks={
  overlapGrowthSecondary:overlapGrowth,
  overlapPrimarySecondary:overlapPrimary,
  secondaryOnlyExperimentCandidates:secondaryOnly
 };
 for(const [k,v] of Object.entries(checks))
  if(!keysEqual(v,assertStringList(gate[k],k)))fail("Source overlap gate mismatch "+k);
 if(gate.secondaryIsGloballyIndependentHoldout!==(
    overlapGrowth.length===0&&overlapPrimary.length===0)||
    gate.sourcePredictionsProvenIndependent!==false||
    gate.canClaimIndependentModelValidation!==false)
    fail("Independent validation falsely certified");
 const claims=get(input,"physicalClaims");
 for(const v of ["measurementUnitsAuthenticated","originalExperimentProtocolsAuthenticated",
  "newKineticParametersEstimated","prospectivePredictionsExecuted","physicalPbeValidated",
  "sourceDataRedistributionPermitted"])
  if(claims[v]!==false)fail("Unsupported physical validation claim "+v);
 return input as LovastatinEvidence;
}
export function lovastatinRunComparison(
  d:LovastatinEvidence,phase:LovastatinPhase,runId:string
){
 const rows=d.records[phase].rows.filter(r=>r.experimentId===runId);
 if(!rows.length)fail("Unknown experiment "+runId);
 return {rows,metrics:lovastatinMetrics(rows),
  sharesGrowthIdentity:phase==="secondary"&&d.leakageGate.overlapGrowthSecondary.includes(runId),
  canClaimIndependentPrediction:false as const};
}
