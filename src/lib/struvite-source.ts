/** Source-native struvite evidence from the user-supplied Mendeley Excel workbook.
 * This is data ingestion + visual comparison ONLY; no physical kinetic fitting.
 * Full numeric bundle is compressed, losslessly, to keep the public Git tree small.
 * Never interpret volumetric PSD as particle-number density.
 */
export const STRUVITE_EVIDENCE_VERSION="crystaltwin-struvite-poiseuille/1" as const;
export const STRUVITE_SOURCE={
  url:"https://data.mendeley.com/datasets/cwxzsth45r/1",
  zipSha256:"ece347014853a0a62005952bdf441ec3db7e730117f017ac5100b453ee0170df",
  xlsxSha256:"c803888c352935b6926b117fcb62eeb76e57f595623cc69d43cfbdbd6f4f2afe",
  normalizedJsonSha256:"970218d7bc26b4021e341c6fd6d66cf8f768b260507db714185fcb7d48306c6b",
  sourceSheet:"DATA",
  sizeBins:87,
} as const;
export type StruviteSI="0.8"|"1.0"|"1.4";
export type StruvitePsdGroup="rMeasured"|"rOptimizedModel"|"ijMeasuredValidation"|"ijGalbraithModel";
export type StruviteConcentrationGroup="rMeasured"|"optimizedModel"|"galbraithModel";
export type StruviteBundle={
  schema:typeof STRUVITE_EVIDENCE_VERSION;
  material:string;sourceDatasetURL:string;sourceTitle:string;
  sourceZipSha256:string;sourceXlsxSha256:string;originalSheet:string;
  siDefinition:string;particleSizeUnit:"µm";psdBasis:string;ciSemantics:string;
  modelValidationClaims:false;sizeUm:number[];
  psd:Record<StruvitePsdGroup,{
    kind:"measured"|"simulated";
    bySI:Record<StruviteSI,{volPercent:number[];ci95Reported?:number[]}>;
    sourceNote:string;
  }>;
  phosphate:{
    rMeasured:{
      kind:"measured";timeMin:number[];
      bySI:Record<StruviteSI,(number|null)[]>;
      reported95CiMolPerL:number;
    };
    optimizedModel:{
      kind:"simulated";timeMin:number[];bySI:Record<StruviteSI,(number|null)[]>;
    };
    galbraithModel:{
      kind:"simulated";timeMin:number[];bySI:Record<StruviteSI,(number|null)[]>;
    };
    unit:"mol/L";analyte:"PO4-P";timeUnit:"min";
  };
  provenance:string;physicsLimits:string[];
};
export const STRUVITE_SI=["0.8","1.0","1.4"] as const;
export const STRUVITE_PSD_GROUPS=[
 "rMeasured","rOptimizedModel","ijMeasuredValidation","ijGalbraithModel",
] as const;
const isObj=(v:unknown):v is Record<string,unknown>=>
  !!v&&typeof v==="object"&&!Array.isArray(v);
function fail(msg:string):never{throw new Error("Struvite evidence: "+msg);}
function numericArray(x:unknown,size:number,label:string,nullable=false):number[]{
  if(!Array.isArray(x)||x.length!==size)fail(label+" requires "+size+" aligned observations.");
  return x.map((v,i)=>{
    if(v===null&&nullable)return NaN;
    if(typeof v!=="number"||!Number.isFinite(v)||v<0)
      fail(label+" has an invalid observation at "+i);
    return v;
  });
}
function monotonic(xs:number[],label:string){
  if(xs.some((x,i)=>i>0&&x<=xs[i-1]))fail(label+" must strictly increase.");
}
function validatePsd(name:StruvitePsdGroup,raw:unknown,bins:number){
  if(!isObj(raw)||!isObj(raw.bySI))fail("Missing PSD group "+name);
  const expectedKind=name==="rMeasured"||name==="ijMeasuredValidation"?"measured":"simulated";
  if(raw.kind!==expectedKind)fail(name+" measured/simulated provenance was relabeled.");
  for(const si of STRUVITE_SI){
    const series=raw.bySI[si];
    if(!isObj(series))fail("Missing "+name+" SI="+si);
    const y=numericArray(series.volPercent,bins,name+" "+si);
    if(y.some(x=>x>100))fail("Volume percentages outside [0,100].");
    const total=y.reduce((a,b)=>a+b,0);
    if(Math.abs(total-100)>0.12)fail(name+" "+si+" volume percent sum != 100: "+total);
    const shouldCI=name!=="ijGalbraithModel";
    if(shouldCI){
      const ci=numericArray(series.ci95Reported,bins,name+" reported CI "+si);
      if(ci.some(x=>x>100))fail("CI column exceeds 100.");
    }else if(series.ci95Reported!==undefined){
      fail("Galbraith model cannot fabricate confidence limits.");
    }
  }
}
function validatePhosphate(name:StruviteConcentrationGroup,raw:unknown){
  if(!isObj(raw)||!isObj(raw.bySI)||!Array.isArray(raw.timeMin))
    fail("Missing PO4-P series "+name);
  const expectedKind=name==="rMeasured"?"measured":"simulated";
  if(raw.kind!==expectedKind)fail("PO4-P provenance relabeled "+name);
  const t=numericArray(raw.timeMin,name==="rMeasured"?9:15,"time in "+name);
  monotonic(t,name+" time");
  for(const si of STRUVITE_SI){
    const vals=numericArray(raw.bySI[si],t.length,"PO4-P "+name+" "+si,true);
    if(vals.some(x=>Number.isFinite(x)&&x>1))
      fail("Unphysical PO4-P > 1 mol/L in source bundle.");
    // Explicit nulls in the R mixer table are NOT zeros.
    if(name==="rMeasured"&&si==="1.4" &&
       (raw.bySI[si] as unknown[]).slice(-3).some(x=>x!==null))
      fail("Unreported measured SI=1.4 tail cannot be imputed.");
  }
  if(name==="rMeasured"&&raw.reported95CiMolPerL!==8.88e-5)
    fail("Source phosphate CI header altered.");
}
export function validateStruviteBundle(raw:unknown):StruviteBundle {
  if(!isObj(raw)||raw.schema!==STRUVITE_EVIDENCE_VERSION)
    fail("Unknown schema version.");
  if(raw.sourceZipSha256!==STRUVITE_SOURCE.zipSha256||
     raw.sourceXlsxSha256!==STRUVITE_SOURCE.xlsxSha256||
     raw.sourceDatasetURL!==STRUVITE_SOURCE.url||
     raw.originalSheet!==STRUVITE_SOURCE.sourceSheet)
    fail("Source provenance fingerprint changed.");
  if(raw.particleSizeUnit!=="µm"||
     raw.psdBasis!=="volume_percent_per_reported_size_bin"||
     raw.modelValidationClaims!==false)fail("Unit, basis or validation claims changed.");
  const sizes=numericArray(raw.sizeUm,STRUVITE_SOURCE.sizeBins,"sizeUm");
  monotonic(sizes,"sizeUm");
  if(sizes[0]!==.01||sizes[sizes.length-1]!==586)
    fail("Source particle-size grid fingerprint changed.");
  if(!isObj(raw.psd)||!isObj(raw.phosphate))fail("Missing modalities.");
  for(const name of STRUVITE_PSD_GROUPS)
    validatePsd(name,raw.psd[name],sizes.length);
  for(const name of ["rMeasured","optimizedModel","galbraithModel"] as const)
    validatePhosphate(name,raw.phosphate[name]);
  if(raw.phosphate.unit!=="mol/L"||raw.phosphate.analyte!=="PO4-P"||
    raw.phosphate.timeUnit!=="min")fail("Source phosphate concentration basis changed.");
  if(!Array.isArray(raw.physicsLimits)||raw.physicsLimits.length<5)
    fail("Missing scientific limitations.");
  return raw as StruviteBundle;
}
export function measuredVsSimulatedPsdL1(
  bundle:StruviteBundle,site:"R"|"IJ",si:StruviteSI,
):{absoluteVolumePercentagePointSum:number;normalizedL1Fraction:number;comparisonType:string}{
  const observed=bundle.psd[site==="R"?"rMeasured":"ijMeasuredValidation"].bySI[si].volPercent;
  const predicted=bundle.psd[site==="R"?"rOptimizedModel":"ijGalbraithModel"].bySI[si].volPercent;
  const absoluteVolumePercentagePointSum=observed.reduce((v,x,i)=>v+Math.abs(x-predicted[i]),0);
  return {
    absoluteVolumePercentagePointSum,
    normalizedL1Fraction:absoluteVolumePercentagePointSum/100,
    comparisonType:site==="R"?
      "reported_fit_side_optimized_vs_r_measured":
      "galbraith_literature_model_vs_ij_validation_observations_not_optimized_model_holdout",
  };
}
