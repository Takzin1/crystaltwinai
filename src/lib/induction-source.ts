/**
 * Real source-native induction-time data (University of Strathclyde workbook).
 * This is a comparison of observed induction-time ECDF and the AUTHOR'S
 * reported curves, NOT a fitted CrystalTwinAI nucleation model.
 *
 * Units of volume and induction-time columns were NOT written in the
 * attached spreadsheet. Do not silently claim mL, seconds, or J units.
 */
export const INDUCTION_SCHEMA="crystaltwin-induction-study-source/1" as const;
export const INDUCTION_EVIDENCE={
  url:"https://pureportal.strath.ac.uk/en/datasets/data-for-machine-learning-derived-correlations-for-scale-up-and-t/",
  workbook:"cg_2022_001925_data_for_article.xlsx",
  xlsxSha256:"0405f592a8cbb9f6d85b41db663c11d99699d795cd58aff3c194c01e2639b075",
  jsonSha256:"ddd39bb04189bd85e1e15c9752aeb4cc366712f90838742f3338e689102af708",
  cases:17,trainCases:14,holdoutCases:3,measurements:131,
  sourceSheets:["induction times and parameters","hydrodynamic features","prediction - induction times"],
} as const;
export const INDUCTION_MODELS=["J7+T8","J7+T9","J9+T8","J9+T9","J2+T2"] as const;
export type PaperModelName=typeof INDUCTION_MODELS[number];
export type InductionCase={
  id:string;vessel:string;volumeSource:number;impeller:string;rpm:number;
  partition:"train"|"holdout_source_label";
  inductionTimesSource:number[];
  sourceFittedJ:number;sourceReportedTg:number;sourceReportedRMSE:number;
  hydrodynamics:{sr_mean:number;ep_mean:number;Re:number;spec_power_input:number};
};
export type InductionHoldoutCurve={
  caseId:string;timeSource:number[];empiricalCdf:number[];
  paperModelCdf:Record<PaperModelName,number[]>;
};
export type InductionSourceBundle={
  schema:typeof INDUCTION_SCHEMA;
  sourceSha256:string;sourceUrl:string;sourceWorkbook:string;sourceSheets:string[];
  measurementTimeUnit:"not_stated_in_workbook";
  volumeUnit:"not_stated_in_workbook";
  modelReproducedByCrystalTwinAI:false;
  data:InductionCase[];heldoutSourceCdf:InductionHoldoutCurve[];
};
const obj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const num=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const fail=(s:string):never=>{throw new Error("Induction-time source rejected: "+s);};
function arr(v:unknown,label:string):unknown[]{
  if(!Array.isArray(v))throw new Error("Induction-time source missing "+label);
  return v;
}
function numArray(v:unknown,n:number,label:string,probability=false):number[]{
  const items=arr(v,label);
  if(items.length!==n||items.some(x=>!num(x)||x<(probability?0:0)||x>(probability?1:Number.MAX_VALUE)))
    throw new Error("Induction-time source bad "+label+" length/numeric range");
  return items as number[];
}
function increasing(xs:readonly number[],strict:boolean,label:string){
  if(xs.some((v,i)=>i>0&&(strict?v<=xs[i-1]:v<xs[i-1])))fail(label+" not sorted");
}
export function validateInductionSource(raw:unknown):InductionSourceBundle{
  if(!obj(raw))throw new Error("Induction source JSON must be an object");
  const s=raw;
  if(s.schema!==INDUCTION_SCHEMA||s.sourceSha256!==INDUCTION_EVIDENCE.xlsxSha256||
    s.sourceUrl!==INDUCTION_EVIDENCE.url||s.sourceWorkbook!==INDUCTION_EVIDENCE.workbook||
    JSON.stringify(s.sourceSheets)!==JSON.stringify(INDUCTION_EVIDENCE.sourceSheets)||
    s.measurementTimeUnit!=="not_stated_in_workbook"||
    s.volumeUnit!=="not_stated_in_workbook"||
    s.modelReproducedByCrystalTwinAI!==false)
    fail("provenance, unit boundary or evidence category changed");
  const data=arr(s.data,"source experiments");
  if(data.length!==INDUCTION_EVIDENCE.cases)fail("wrong number of experiment cases");
  const known=new Map<string,{record:InductionCase;count:number}>();
  let train=0,holdout=0,measurements=0;
  for(const v of data){
    if(!obj(v))throw new Error("Experiment must be a valid object");
    const x=v;
    if(typeof x.id!=="string"||known.has(x.id)||
      !["EasyMax","OptiMax","Miniplant"].includes(String(x.vessel))||
      !["RC","PBT"].includes(String(x.impeller))||
      !num(x.volumeSource)||x.volumeSource<=0||
      !Number.isInteger(x.rpm)||!num(x.rpm)||x.rpm<=0||
      x.id!==[x.vessel,x.volumeSource,x.impeller,x.rpm].join("-")||
      !["train","holdout_source_label"].includes(String(x.partition))||
      !num(x.sourceFittedJ)||x.sourceFittedJ<=0||
      !num(x.sourceReportedTg)||x.sourceReportedTg<=0||
      !num(x.sourceReportedRMSE)||x.sourceReportedRMSE<0||
      !obj(x.hydrodynamics))
      fail("invalid experiment metadata/identity");
    const obs=arr(x.inductionTimesSource,"induction samples");
    if(obs.length<5||obs.length>14||
      obs.some(t=>!Number.isInteger(t)||!num(t)||t<=0))
      fail("invalid measured induction sample");
    const hydro=x.hydrodynamics as Record<string,unknown>;
    if(Object.keys(hydro).sort().join(",")!==
      ["sr_mean","ep_mean","Re","spec_power_input"].sort().join(",")||
      Object.values(hydro).some(y=>!num(y)))
      fail("hydrodynamic original sheet mismatch");
    const id=x.id as string;
    const partition=x.partition as InductionCase["partition"];
    known.set(id,{record:x as InductionCase,count:obs.length});
    measurements+=obs.length;
    if(partition==="train")train++;else holdout++;
  }
  if(train!==14||holdout!==3||measurements!==INDUCTION_EVIDENCE.measurements)
    fail("source train/holdout partition or raw observation count modified");
  const curves=arr(s.heldoutSourceCdf,"published heldout ECDF");
  if(curves.length!==3)fail("expected three original heldout source curves");
  const seen=new Set<string>();
  for(const v of curves){
    if(!obj(v)||typeof v.caseId!=="string"||seen.has(v.caseId)||!obj(v.paperModelCdf))
      fail("bad published source CDF record");
    const matched=known.get(v.caseId);
    if(!matched||matched.record.partition!=="holdout_source_label")
      fail("published CDF assigned to a training experiment");
    seen.add(v.caseId);
    const n=matched.count;
    const ts=numArray(v.timeSource,n,"heldout times");
    increasing(ts,false,"heldout times");
    if(JSON.stringify(ts)!==JSON.stringify([...matched.record.inductionTimesSource].sort((a,b)=>a-b)))
      fail("heldout source times not equal to original observed sample set");
    const ecdf=numArray(v.empiricalCdf,n,"empirical CDF",true);
    if(ecdf.some((p,i)=>Math.abs(p-(i+1)/n)>1e-12))
      fail("empirical CDF not equal to original rank/n");
    const models=v.paperModelCdf as Record<string,unknown>;
    if(Object.keys(models).sort().join(",")!==[...INDUCTION_MODELS].sort().join(","))
      fail("model-name provenance differs");
    for(const name of INDUCTION_MODELS){
      const probabilities=numArray(models[name],n,name+" paper CDF",true);
      increasing(probabilities,false,"paper "+name+" CDF");
    }
  }
  if(seen.size!==holdout)fail("incomplete heldout CDF coverage");
  return s as unknown as InductionSourceBundle;
}
export function inductionCdfComparison(
  curve:InductionHoldoutCurve,name:PaperModelName,
){
 const expected=curve.empiricalCdf;
 const predicted=curve.paperModelCdf[name];
 const n=expected.length;
 const residuals=expected.map((p,i)=>predicted[i]-p);
 return {
   n,
   maeProbability:residuals.reduce((s,v)=>s+Math.abs(v),0)/n,
   rmseProbability:Math.sqrt(residuals.reduce((s,v)=>s+v*v,0)/n),
   biasModelMinusECDF:residuals.reduce((s,v)=>s+v,0)/n,
   label:"source_reported_model_vs_ecdf_not_crystaltwinai_prediction" as const,
 };
}