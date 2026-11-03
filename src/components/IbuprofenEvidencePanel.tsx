"use client";

import {useState} from "react";
import {
  IBUPROFEN_SOURCE,IBUPROFEN_STUDIES,
  ibuprofenCurveForCondition,ibuprofenSourceLabel,validateIbuprofenSource,
  type IbuprofenSourceBundle,type IbuprofenStudy
} from "../lib/ibuprofen-source";
import type {LanguageCode} from "../lib/types";

const FILE="/examples/ibuprofen-psd-sparse-v1.json.gz.base64";
const STUDY_LABELS:Record<IbuprofenStudy,[string,string]>={
 solvent_composition:["溶媒組成・溶質濃度","Solvent composition / concentration"],
 cooling_endpoint_temperature:["冷却終点温度","Cooling endpoint temperature"],
 liquid_film_thickness:["液膜厚さ（単位未記載）","Liquid film thickness (unit missing)"],
 liquid_film_diameter:["液膜直径","Liquid film diameter"],
};
async function sourceVerifiedLoad():Promise<IbuprofenSourceBundle>{
 const response=await fetch(FILE,{cache:"no-store"});
 if(!response.ok)throw new Error("The ibuprofen source file was not found.");
 const encoded=(await response.text()).trim();
 if(encoded.length<1000||encoded.length>25000||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
   throw new Error("Invalid source encoding.");
 if(typeof DecompressionStream==="undefined")
   throw new Error("Browser gzip support is unavailable.");
 const binary=atob(encoded);
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const raw=await new Response(new Blob([bytes]).stream()
   .pipeThrough(new DecompressionStream("gzip"))).text();
 const buffer=new TextEncoder().encode(raw);
 if(buffer.byteLength>500000)throw new Error("Oversized source JSON.");
 const digest=await crypto.subtle.digest("SHA-256",buffer);
 const sha=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
 if(sha!==IBUPROFEN_SOURCE.normalizedSparseJsonSha256)
   throw new Error("Original-transcription SHA-256 mismatch.");
 return validateIbuprofenSource(JSON.parse(raw));
}
function Plot({size,first,other}:{
 size:number[],first:(number|null)[],other:(number|null)[]|null,
}){
 const maxValue=Math.max(1,...first.filter((x):x is number=>x!==null),
  ...(other??[]).filter((x):x is number=>x!==null));
 const x=(v:number)=>48+(Math.log10(v)-Math.log10(size[0]))/
   (Math.log10(size[size.length-1])-Math.log10(size[0]))*575;
 const y=(v:number)=>180-v/maxValue*152;
 function path(values:(number|null)[]){
  let broken=true;
  return values.map((v,i)=>{
   if(v===null){broken=true;return "";}
   const segment=(broken?"M":"L")+x(size[i]).toFixed(2)+" "+y(v).toFixed(2);
   broken=false;
   return segment;
  }).join(" ");
 }
 return <svg viewBox="0 0 650 224" style={{width:"100%",height:"auto"}}
  role="img" aria-label="Observed ibuprofen particle-size reported percent per bin, logarithmic nm axis">
  <title>Source-reported ibuprofen distribution, size nm (log scale), weighting unspecified</title>
  {[0,.25,.5,.75,1].map(f=><g key={f}>
   <line x1="46" x2="625" y1={y(f*maxValue)} y2={y(f*maxValue)}
    stroke="currentColor" opacity=".12"/>
   <text x="40" y={y(f*maxValue)+4} textAnchor="end" fill="currentColor" fontSize="10">
    {(f*maxValue).toFixed(1)}</text>
  </g>)}
  <path d={path(first)} fill="none" stroke="#29a9b3" strokeWidth="2.5"/>
  {other&&<path d={path(other)} fill="none" stroke="#b29cec" strokeWidth="2.2"/>}
  {[.3,1,10,100,1000,10000].map(v=>
   <text key={v} x={x(v)} y="203" fill="currentColor" fontSize="10" textAnchor="middle">{v}</text>)}
  <text x="334" y="221" fill="currentColor" fontSize="10" textAnchor="middle">
   Particle diameter (nm · log scale)
  </text>
 </svg>;
}
export default function IbuprofenEvidencePanel({lang}:{lang:LanguageCode}){
 const t=(ja:string,en:string)=>lang==="ja"?ja:en;
 const [data,setData]=useState<IbuprofenSourceBundle|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [study,setStudy]=useState<IbuprofenStudy>("solvent_composition");
 const [conditionId,setConditionId]=useState("solvent-c5-e0");
 const [comparisonId,setComparisonId]=useState("");
 const currentOptions=data?.conditions.filter(c=>c.study===study)??[];
 const selected=currentOptions.some(c=>c.id===conditionId)?conditionId:currentOptions[0]?.id;
 const primary=data&&selected?ibuprofenCurveForCondition(data,selected):null;
 const secondary=data&&comparisonId&&currentOptions.some(c=>c.id===comparisonId)?
   ibuprofenCurveForCondition(data,comparisonId):null;
 const repeatedCount=primary&&data?data.conditions.filter(c=>c.curve===primary.condition.curve).length:0;
 const sameCurve=primary&&secondary&&primary.condition.curve===secondary.condition.curve;
 const absoluteDifference=primary&&secondary?primary.distribution.reduce<number>((sum,v,i)=>
   sum+Math.abs((v??0)-(secondary.distribution[i]??0)),0):null;
 async function load(){
  setLoading(true);setError(null);
  try{setData(await sourceVerifiedLoad());}
  catch(e){setData(null);setError(e instanceof Error?e.message:"Source parsing failed.");}
  finally{setLoading(false);}
 }
 return <section className="panel" aria-labelledby="ibuprofen-title">
  <p className="studio-eyebrow">SOURCE-NATIVE EXPERIMENT / 05</p>
  <h2 id="ibuprofen-title" className="panel-title">
   {t("Ibuprofen：原本Excelの粒径分布比較","Ibuprofen: original Excel particle-size comparison")}
  </h2>
  <p className="dataset-muted">{t(
   "4シート・142粒径ビン・23条件を展開し、原本に再掲された同一曲線を識別。nm表記と実測のパーセント値を保持し、未定義の分布重み付けを推定しません。",
   "Four sheets, 142 size bins and 23 condition entries, with duplicated curves identified. Source nm axis and reported percentages are preserved; weighting is not inferred."
  )}</p>
  <div className="dataset-actions">
   <button type="button" className="dataset-clear" disabled={loading} onClick={()=>{void load();}}>
    {loading?t("検証中…","Verifying…"):t("原本の数値ハッシュを検証して表示","Verify source and show observations")}
   </button>
  </div>
  {error&&<p role="alert" className="dataset-error">{error}</p>}
  {data&&primary&&<>
   <div className="dataset-actions">
    <label>{t("実験条件の分類","Condition family")}
     <select value={study} onChange={e=>{setStudy(e.target.value as IbuprofenStudy);setConditionId("");setComparisonId("");}}>
      {IBUPROFEN_STUDIES.map(s=><option value={s} key={s}>
       {STUDY_LABELS[s][lang==="ja"?0:1]}</option>)}
     </select>
    </label>
    <label>{t("観測条件A","Observed condition A")}
     <select value={primary.condition.id} onChange={e=>setConditionId(e.target.value)}>
      {currentOptions.map(c=><option key={c.id} value={c.id}>{ibuprofenSourceLabel(c)}</option>)}
     </select>
    </label>
    <label>{t("比較条件B","Compare condition B")}
     <select value={secondary?.condition.id??""} onChange={e=>setComparisonId(e.target.value)}>
      <option value="">{t("比較しない","No comparison")}</option>
      {currentOptions.filter(c=>c.id!==primary.condition.id).map(c=>
       <option value={c.id} key={c.id}>{ibuprofenSourceLabel(c)}</option>)}
     </select>
    </label>
   </div>
   <Plot size={data.sizeNm} first={primary.distribution}
     other={secondary?.distribution??null}/>
   <p className="dataset-muted">
    <span style={{color:"#29a9b3"}}>●</span> {ibuprofenSourceLabel(primary.condition)}
    {secondary&&<>{"　"}<span style={{color:"#b29cec"}}>●</span>
     {" "}{ibuprofenSourceLabel(secondary.condition)}</>}
   </p>
   <p className="dataset-muted">{t(
    "累積50%到達ビンの粒径（概算・分布の重み付け未検証）",
    "Diameter at 50% cumulative reported bins (approximate; weighting unverified)"
   )}: {primary.d50ReportedBinNm?.toPrecision(4)} nm</p>
   {secondary&&<p className="dataset-muted">{t("条件間の総絶対差","Total absolute bin percentage-point differences")}:
    {" "}{absoluteDifference?.toFixed(3)} {t("ポイント","points")}</p>}
   {(repeatedCount>1||sameCurve)&&<p className="verification-caution">{t(
    "同じ数値の分布が別シート・条件にも存在します。独立した複数実験として数えません。",
    "An exact curve is reused across worksheet conditions. These are not counted as independent experimental replicates."
   )}</p>}
   <p className="verification-caution">{t(
    "Excelは粒径をnmと明記していますが、分布が体積・個数・散乱強度のどの重み付けなのか記載がありません。PBEの粒子数分布や実験的な成長速度への自動変換、物理精度の認証はしません。707.2液膜厚さ条件の末尾1セルは欠損のまま保持します。",
    "The diameter unit is nm, but whether the distribution is volume-, number- or intensity-weighted is not declared. No conversion to number-based PBE, physical growth kinetics or accuracy certification. One missing final cell in the 707.2 film-thickness condition remains null."
   )}</p>
   <a target="_blank" rel="noreferrer" href={data.sourceUrl}>
    {t("元データの公開ページ（Mendeley Data）","Original data source (Mendeley Data)")}
   </a>
  </>}
 </section>;
}