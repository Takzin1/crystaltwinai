/** Source-native ibuprofen size-distribution measurements; NOT PBE number density.
 * Original ZIP/XLSX fingerprints verified from user-provided bytes.
 * Exact nonzero entries are stored once per unique curve; zero values and
 * source-null entries are restored without interpolation or renormalization.
 */
export const IBUPROFEN_SCHEMA="crystaltwin-ibuprofen-sparse-observed-psd/1" as const;
export const IBUPROFEN_SOURCE={
  url:"https://data.mendeley.com/datasets/kzn8b86gvg/1",
  zipSha256:"f4415166435662c3d5da98c60c3cb72f2fe263b6961d29add24abaf7750e8975",
  xlsxSha256:"5e427f49ecbce2121fe9f58877d7d25a60d580f213847493f6014c67f66e25da",
  normalizedSparseJsonSha256:"716612c990d7b4a9f1e31616d9c356ba448bdf99548fed44f565a8a807f9cbda",
  bins:142,conditions:23,uniqueCurves:17,
  sourceSheets:[
    "solvent composition","cooling endpoint temperature",
    "liquid film thickness","liquid film diameter",
  ] as const,
} as const;
export type IbuprofenStudy="solvent_composition"|"cooling_endpoint_temperature"|
  "liquid_film_thickness"|"liquid_film_diameter";
export const IBUPROFEN_STUDIES=[
  "solvent_composition","cooling_endpoint_temperature",
  "liquid_film_thickness","liquid_film_diameter",
] as const;
export type IbuprofenCurve={
  nonzero:[number,number][];missing:number[];
};
export type IbuprofenCondition={
  id:string;study:IbuprofenStudy;sourceSheet:string;sourceColumn:number;
  settings:Record<string,string|number>;curve:number;
};
export type IbuprofenSourceBundle={
  schema:typeof IBUPROFEN_SCHEMA;sourceUrl:string;
  sourceZipSha256:string;sourceXlsxSha256:string;sourceSheetNames:string[];
  particleDiameterUnit:"nm";
  reportedDistributionBasis:"reported_percent_per_bin_weighting_unverified";
  sizeNm:number[];curves:IbuprofenCurve[];conditions:IbuprofenCondition[];
};
const fail=(v:string):never=>{throw new Error("Ibuprofen source rejected: "+v);};
const obj=(v:unknown):v is Record<string,unknown>=>
  !!v&&typeof v==="object"&&!Array.isArray(v);
const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
export function expandIbuprofenCurve(
  bins:number,curve:IbuprofenCurve,
):(number|null)[]{
  const out:(number|null)[]=Array(bins).fill(0);
  const seen=new Set<number>();
  for(const pair of curve.nonzero){
    if(!Array.isArray(pair)||pair.length!==2||
      !Number.isInteger(pair[0])||pair[0]<0||pair[0]>=bins||
      !finite(pair[1])||pair[1]<=0||pair[1]>100||
      seen.has(pair[0]))fail("Nonzero index/value invalid or duplicated");
    seen.add(pair[0]);out[pair[0]]=pair[1];
  }
  for(const i of curve.missing){
    if(!Number.isInteger(i)||i<0||i>=bins||seen.has(i))
      fail("Missing cell index invalid or overwrites a measured value");
    seen.add(i);out[i]=null;
  }
  return out;
}
export function validateIbuprofenSource(raw:unknown):IbuprofenSourceBundle{
  if(!obj(raw))throw new Error("Ibuprofen source is not an object.");
  if(raw.schema!==IBUPROFEN_SCHEMA||
    raw.sourceUrl!==IBUPROFEN_SOURCE.url||
    raw.sourceZipSha256!==IBUPROFEN_SOURCE.zipSha256||
    raw.sourceXlsxSha256!==IBUPROFEN_SOURCE.xlsxSha256||
    raw.particleDiameterUnit!=="nm"||
    raw.reportedDistributionBasis!=="reported_percent_per_bin_weighting_unverified")
    fail("Unrecognized source, unit, basis or file fingerprint");
  if(!Array.isArray(raw.sourceSheetNames)||
     JSON.stringify(raw.sourceSheetNames)!==JSON.stringify(IBUPROFEN_SOURCE.sourceSheets))
    fail("Original sheet identity was changed");
  const sizeNm=raw.sizeNm;
  if(!Array.isArray(sizeNm))throw new Error("Missing ibuprofen numeric diameter grid.");
  if(sizeNm.length!==IBUPROFEN_SOURCE.bins||
     sizeNm.some((v:unknown,i:number)=>!finite(v)||v<=0||
       (i>0&&v<=sizeNm[i-1]))||
     Math.abs(sizeNm[0]-.20947417959189)>1e-12||
     Math.abs(sizeNm.at(-1)-19095.4322284161)>1e-7)
    fail("Particle diameters are not source-native, finite or increasing");
  const curves=raw.curves;
  if(!Array.isArray(curves))throw new Error("Missing source PSD curves.");
  if(curves.length!==IBUPROFEN_SOURCE.uniqueCurves)
    fail("Unique source curve count changed");
  const signatures=new Set<string>();
  const restored=(curves as unknown[]).map((item,i)=>{
    if(!obj(item))throw new Error("Invalid source curve object "+i);
    if(!Array.isArray(item.nonzero)||!Array.isArray(item.missing))
      throw new Error("Invalid source curve entries "+i);
    const c=item as IbuprofenCurve;
    const v=expandIbuprofenCurve(IBUPROFEN_SOURCE.bins,c);
    const total=v.reduce<number>((sum,x)=>sum+(x??0),0);
    if(Math.abs(total-100)>1e-6)
      fail("Source curve sum must equal 100 reported percentage points");
    const signature=JSON.stringify(v);
    if(signatures.has(signature))fail("Duplicate curve not deduplicated");
    signatures.add(signature);
    return v;
  });
  const conditions=raw.conditions;
  if(!Array.isArray(conditions))throw new Error("Missing experimental conditions.");
  if(conditions.length!==IBUPROFEN_SOURCE.conditions)
    fail("Expected 23 distinct recorded experimental-condition series");
  const sourceSheetByStudy:Record<IbuprofenStudy,string>={
    solvent_composition:"solvent composition",
    cooling_endpoint_temperature:"cooling endpoint temperature",
    liquid_film_thickness:"liquid film thickness",
    liquid_film_diameter:"liquid film diameter",
  };
  const expectedColumns:Record<IbuprofenStudy,readonly number[]>={
    solvent_composition:[2,3,4,7,8,9,12,13,14],
    cooling_endpoint_temperature:[2,3,4,7,8,9],
    liquid_film_thickness:[2,3,4,5],
    liquid_film_diameter:[2,3,4,5],
  };
  const usedId=new Set<string>(),usedCells=new Set<string>();
  const count:Record<IbuprofenStudy,number>={
    solvent_composition:0,cooling_endpoint_temperature:0,
    liquid_film_thickness:0,liquid_film_diameter:0,
  };
  const curveRefs=new Set<number>();
  for(const item of conditions as unknown[]){
    if(!obj(item))throw new Error("Invalid source condition object.");
    const c=item;
    if(typeof c.id!=="string"||!(/^[a-z0-9_.-]+$/).test(c.id)||
       usedId.has(c.id)||
       typeof c.study!=="string"||!(c.study in count)||
       !Number.isInteger(c.curve)||typeof c.curve!=="number"||
       c.curve<0||c.curve>=restored.length||
       !Number.isInteger(c.sourceColumn)||!obj(c.settings))
      fail("Invalid condition identity, model or raw spreadsheet column");
    const study=c.study as IbuprofenStudy;
    if(c.sourceSheet!==sourceSheetByStudy[study]||
       !expectedColumns[study].includes(c.sourceColumn as number))
      fail("Source worksheet-column mapping altered");
    const slot=c.sourceSheet+":"+c.sourceColumn;
    if(usedCells.has(slot))fail("Duplicate source spreadsheet column");
    usedId.add(c.id as string);usedCells.add(slot);
    curveRefs.add(c.curve as number);count[study]++;
    const settings=c.settings as Record<string,unknown>;
    const keys=Object.keys(settings);
    if(study==="solvent_composition"){
      if(keys.length!==2||!finite(settings.soluteConcentrationGPerMl)||
         ![.05,.1,.3].includes(settings.soluteConcentrationGPerMl)||
         !finite(settings.ethanolVolumeFraction)||
         ![0,.1,.2].includes(settings.ethanolVolumeFraction))
        fail("Source solvent/concentration settings invalid");
    }else if(study==="cooling_endpoint_temperature"){
      if(keys.length!==2||!finite(settings.soluteConcentrationGPerMl)||
         ![.1,.3].includes(settings.soluteConcentrationGPerMl)||
         !finite(settings.coolingEndpointC)||
         ![25,5,-5].includes(settings.coolingEndpointC))
        fail("Source cooling settings invalid");
    }else if(study==="liquid_film_thickness"){
      if(keys.length!==2||!finite(settings.liquidFilmThicknessSourceValue)||
        ![55.4,176.8,353.6,707.2].includes(settings.liquidFilmThicknessSourceValue)||
        settings.liquidFilmThicknessUnit!=="not_declared_in_sheet")
        fail("Film-thickness units are unsupported");
    }else if(keys.length!==1||!finite(settings.liquidFilmDiameterCm)||
      ![2,4,6,12].includes(settings.liquidFilmDiameterCm))
      fail("Film-diameter source settings invalid");
  }
  if(count.solvent_composition!==9||count.cooling_endpoint_temperature!==6||
    count.liquid_film_thickness!==4||count.liquid_film_diameter!==4||
    curveRefs.size!==IBUPROFEN_SOURCE.uniqueCurves)
    fail("Incomplete source observation coverage");
  const missing=restored.flatMap((v,curve)=>v.map((n,index)=>n===null?{curve,index}:null)
      .filter((x):x is {curve:number;index:number}=>x!==null));
  const oneMissing=(conditions as unknown[]).find(c=>obj(c)&&c.id==="thickness-707_2");
  if(missing.length!==1||missing[0].index!==141||!obj(oneMissing)||
     oneMissing.curve!==missing[0].curve)
    fail("One missing original final spreadsheet cell must remain null");
  return raw as IbuprofenSourceBundle;
}
export function ibuprofenCurveForCondition(
  source:IbuprofenSourceBundle,id:string,
):{condition:IbuprofenCondition;distribution:(number|null)[];totalPercent:number;
  d50ReportedBinNm:number|null}{
  const condition=source.conditions.find(c=>c.id===id);
  if(!condition)throw new Error("Unknown ibuprofen source condition");
  const distribution=expandIbuprofenCurve(source.sizeNm.length,source.curves[condition.curve]);
  let total=0,at50:null|number=null;
  for(let i=0;i<distribution.length;i++){
    total+=distribution[i]??0;
    if(at50===null&&total>=50)at50=source.sizeNm[i];
  }
  return {condition,distribution,totalPercent:total,d50ReportedBinNm:at50};
}
export function ibuprofenSourceLabel(condition:IbuprofenCondition):string{
  const s=condition.settings;
  if(condition.study==="solvent_composition")
    return s.soluteConcentrationGPerMl+" g/mL · ethanol vol fraction "+s.ethanolVolumeFraction;
  if(condition.study==="cooling_endpoint_temperature")
    return s.soluteConcentrationGPerMl+" g/mL · "+s.coolingEndpointC+" °C";
  if(condition.study==="liquid_film_thickness")
    return "thickness "+s.liquidFilmThicknessSourceValue+" (unit unspecified)";
  return "film diameter "+s.liquidFilmDiameterCm+" cm";
}