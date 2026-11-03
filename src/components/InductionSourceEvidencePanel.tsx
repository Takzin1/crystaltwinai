"use client";
import {useState} from "react";
import {
 INDUCTION_EVIDENCE,INDUCTION_MODELS,
 inductionCdfComparison,validateInductionSource,
 type InductionSourceBundle,type PaperModelName,type InductionHoldoutCurve
} from "../lib/induction-source";
import type {LanguageCode} from "../lib/types";

const FILE="/examples/induction-times-source-v1.json.gz.base64";
async function readSource():Promise<InductionSourceBundle>{
 const response=await fetch(FILE,{cache:"no-store"});
 if(!response.ok)throw new Error("Induction-source data is unavailable in this deployment.");
 const encoded=(await response.text()).trim();
 if(encoded.length<200||encoded.length>16000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
  throw new Error("Invalid induction-source encoding.");
 if(typeof DecompressionStream==="undefined")
  throw new Error("This browser does not support native gzip decoding.");
 const binary=atob(encoded);
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const json=await new Response(new Blob([bytes]).stream()
   .pipeThrough(new DecompressionStream("gzip"))).text();
 const sourceBuffer=new TextEncoder().encode(json);
 if(sourceBuffer.byteLength>250000)throw new Error("Expanded source too large.");
 const hash=await crypto.subtle.digest("SHA-256",sourceBuffer);
 const digest=Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,"0")).join("");
 if(digest!==INDUCTION_EVIDENCE.jsonSha256)
  throw new Error("Published source SHA-256 failed; refusing to display changed research data.");
 return validateInductionSource(JSON.parse(json));
}
function HoldoutCurve({curve,name}:{curve:InductionHoldoutCurve;name:PaperModelName}){
 const xMin=curve.timeSource[0],xMax=curve.timeSource[curve.timeSource.length-1];
 const x=(v:number)=>42+(v-xMin)/(xMax-xMin||1)*581;
 const y=(v:number)=>164-v*132;
 const path=(v:number[])=>v.map((p,i)=>(i?"L":"M")+x(curve.timeSource[i]).toFixed(2)+" "+y(p).toFixed(2)).join(" ");
 return <svg viewBox="0 0 657 215" style={{width:"100%",height:"auto"}}
  role="img" aria-label="Induction-time empirical CDF and publication-reported predicted CDF">
  <title>Measured induction-time ECDF and source author's model CDF, not CrystalTwinAI predictions</title>
  {[0,.25,.5,.75,1].map(level=><g key={level}>
    <line x1="40" y1={y(level)} x2="626" y2={y(level)}
     stroke="currentColor" opacity=".16"/>
    <text x="35" y={y(level)+3} textAnchor="end" fontSize="10" fill="currentColor">
     {level.toFixed(2)}</text>
   </g>)}
   <path d={path(curve.empiricalCdf)} fill="none" stroke="#22a5af" strokeWidth="2.6"/>
   <path d={path(curve.paperModelCdf[name])} fill="none" stroke="#aa91dd" strokeWidth="2.4"/>
   <text x="43" y="190" fill="currentColor" fontSize="10">{xMin}</text>
   <text x="624" y="190" fill="currentColor" fontSize="10" textAnchor="end">{xMax}</text>
   <text x="330" y="210" fill="currentColor" fontSize="10" textAnchor="middle">
    Induction time (original spreadsheet units not declared)
   </text>
 </svg>;
}
export default function InductionSourceEvidencePanel({lang}:{lang:LanguageCode}){
 const t=(ja:string,en:string)=>lang==="ja"?ja:en;
 const [data,setData]=useState<InductionSourceBundle|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [caseId,setCaseId]=useState("EasyMax-85-RC-250");
 const [model,setModel]=useState<PaperModelName>("J7+T8");
 const selected=data?.data.find(x=>x.id===caseId)??data?.data[14];
 const curve=data?.heldoutSourceCdf.find(x=>x.caseId===selected?.id);
 const comparison=curve?inductionCdfComparison(curve,model):null;
 async function load(){
  setBusy(true);setError(null);
  try{setData(await readSource());}
  catch(e){setError(e instanceof Error?e.message:String(e));setData(null);}
  finally{setBusy(false);}
 }
 const originalSorted=[...(selected?.inductionTimesSource??[])].sort((a,b)=>a-b);
 const median=originalSorted.length?originalSorted[Math.floor((originalSorted.length-1)/2)]:null;
 return <section className="panel" aria-labelledby="induction-source-heading">
  <p className="studio-eyebrow">EXPERIMENTAL INDUCTION-TIME EVIDENCE / 06</p>
  <h2 className="panel-title" id="induction-source-heading">{t(
   "結晶核発生：実測誘導時間と論文モデルの照合",
   "Crystallization nucleation: measured induction time vs published source models"
  )}</h2>
  <p className="dataset-muted">{t(
   "添付Excelの9シートを検査し、実験条件・流体特性・公表CDFを原本の数値のまま収録。14条件は学習側、3条件は原本で学習対象外として区別されています。",
   "The uploaded nine-sheet XLSX was inspected. Original inductions, flow features and source-published CDFs are preserved; 14 conditions are source-labeled training, 3 are outside source training."
  )}</p>
  <p className="verification-caution">{t(
   "このパネルの紫線は論文側で既に計算された予測値です。CrystalTwinAIが新たに核発生速度を同定・予測した証拠ではありません。時間・容積の単位はExcelの対象列に記載されていないため断定しません。",
   "The violet line is the source author's precomputed prediction, NOT a new CrystalTwinAI nucleation model. Original spreadsheet time/volume column units are not declared."
  )}</p>
  <div className="dataset-actions">
   <button type="button" className="dataset-clear" onClick={()=>{void load()}} disabled={busy}>
    {busy?t("原本を検証中…","Verifying source…"):t(
     "原本のSHA-256を検証して実験データを表示","Verify source SHA-256 and load observations")}
   </button>
  </div>
  {error&&<p role="alert" className="dataset-error">{error}</p>}
  {data&&selected&&<>
   <p className="dataset-muted">{data.data.length} {t("実験条件","cases")} ·
    {data.data.reduce((v,x)=>v+x.inductionTimesSource.length,0)} {t("誘導時間の観測点","observed induction times")} ·
    3 {t("論文内ホールドアウト","source-labeled holdouts")}</p>
   <div className="dataset-actions">
    <label>{t("実験条件","Experimental case")}
     <select value={selected.id} onChange={e=>setCaseId(e.target.value)}>
      {data.data.map(x=><option value={x.id} key={x.id}>
       {x.partition==="train"?"Train":"Holdout"} · {x.id}</option>)}
     </select>
    </label>
    {curve&&<label>{t("論文中の予測曲線","Source-reported parameter pair")}
     <select value={model} onChange={e=>setModel(e.target.value as PaperModelName)}>
      {INDUCTION_MODELS.map(m=><option value={m} key={m}>{m}</option>)}
     </select>
    </label>}
   </div>
   <p className="dataset-muted">{t("原本の誘導時間：","Observed induction time: ")}
    n={selected.inductionTimesSource.length} ·
    {t("標本中央値（原本単位）","sample median (source units)")}: {median} ·
    RPM {selected.rpm} · {selected.impeller} · {selected.vessel} ·
    Re {selected.hydrodynamics.Re.toFixed(1)}</p>
   {curve&&comparison?<div>
     <HoldoutCurve curve={curve} name={model}/>
     <p className="dataset-muted"><span style={{color:"#22a5af"}}>●</span> {t("実測ECDF","Measured ECDF")}
       {"　"}<span style={{color:"#aa91dd"}}>●</span> {t("論文の予測CDF","Source-reported predicted CDF")}</p>
     <p className="dataset-muted">{t("確率スケールの記述的誤差","Descriptive error on probability scale")}:{" "}
       MAE {comparison.maeProbability.toFixed(4)} ·
       RMSE {comparison.rmseProbability.toFixed(4)}</p>
     <p className="verification-caution">{t(
       "原本の3条件は学習対象外ですが、これだけで新モデルの独立外部検証を証明するものではありません。研究対象の物理条件、計測単位と再実験は別途検証が必要です。",
       "These three cases are source-labeled outside training, not proof of externally independent validation of a new model. Physical conditions, units and experimental reproduction require further checks."
     )}</p>
   </div>:<p className="dataset-muted">{t(
    "この実験条件は原本で「学習用」です。ホールドアウト予測曲線は表示しません。",
    "This experiment is labeled training by the source workbook; no heldout prediction CDF is available."
   )}</p>}
   <a href={data.sourceUrl} target="_blank" rel="noreferrer">{t(
     "公開データの出典（University of Strathclyde）",
     "Data attribution (University of Strathclyde)"
   )}</a>
  </>}
 </section>;
}