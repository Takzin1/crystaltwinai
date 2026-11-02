"use client";
import { useMemo,useState } from "react";
import {
 LOVASTATIN_BOOKS,LOVASTATIN_PHASES,lovastatinRunComparison,
 validateLovastatinEvidence,type LovastatinEvidence,type LovastatinPhase
} from "../lib/lovastatin-evidence";
import type { LanguageCode } from "../lib/types";

function Curve({rows}:{rows:LovastatinEvidence["records"]["growth"]["rows"]}){
 const lo=rows[0].timeSource,hi=rows[rows.length-1].timeSource;
 const values=rows.flatMap(r=>[r.measuredSource,r.reportedPredictionSource]);
 const ymin=Math.min(...values),ymax=Math.max(...values);
 const x=(n:number)=>45+(n-lo)/(hi-lo||1)*580;
 const y=(n:number)=>155-(n-ymin)/(ymax-ymin||1)*125;
 const path=(field:"measuredSource"|"reportedPredictionSource")=>
  rows.map((r,i)=>(i?"L":"M")+x(r.timeSource).toFixed(2)+" "+y(r[field]).toFixed(2)).join(" ");
 return <svg role="img" aria-label="Source measured versus published predicted values, units unknown" viewBox="0 0 650 200" style={{maxWidth:"100%",height:"auto"}}>
  <title>Published Lovastatin source measurements vs the source's own predictions</title>
  {[0,.5,1].map(v=><g key={v}>
   <line x1="45" x2="625" y1={y(ymin+(ymax-ymin)*v)} y2={y(ymin+(ymax-ymin)*v)} stroke="currentColor" opacity=".16"/>
   <text x="41" y={y(ymin+(ymax-ymin)*v)+4} fontSize="10" textAnchor="end" fill="currentColor">{(ymin+(ymax-ymin)*v).toFixed(3)}</text>
  </g>)}
  <path d={path("measuredSource")} stroke="#28a3a8" strokeWidth="2.6" fill="none"/>
  <path d={path("reportedPredictionSource")} stroke="#9985d7" strokeWidth="2.4" fill="none"/>
  <text x="46" y="180" fill="currentColor" fontSize="10">{lo}</text>
  <text x="625" y="180" fill="currentColor" fontSize="10" textAnchor="end">{hi}</text>
  <text x="335" y="197" fill="currentColor" fontSize="11" textAnchor="middle">Time (source units unverified)</text>
 </svg>;
}
export default function LovastatinEvidencePanel({lang}:{lang:LanguageCode}){
 const t=(ja:string,en:string)=>lang==="ja"?ja:en;
 const [data,setData]=useState<LovastatinEvidence|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [phase,setPhase]=useState<LovastatinPhase>("growth");
 const [run,setRun]=useState<string>("");
 const source=useMemo(()=>data?.records[phase], [data,phase]);
 const selected=run&&source?.experiments.includes(run)?run:source?.experiments[0];
 const comparison=data&&selected?lovastatinRunComparison(data,phase,selected):null;
 async function readLocal(file:File|null){
  setError(null);setData(null);setRun("");
  if(!file)return;
  try{
   if(file.size<100||file.size>1024*1024)throw new Error("Expected local-only JSON smaller than 1 MiB.");
   const raw=JSON.parse(await file.text());
   const parsed=validateLovastatinEvidence(raw);
   setData(parsed);setPhase("growth");setRun(parsed.records.growth.experiments[0]);
  }catch(e){setError(e instanceof Error?e.message:"Invalid Lovastatin evidence file");}
 }
 return <section className="panel" aria-labelledby="lovastatin-evidence-title">
  <p className="studio-eyebrow">LOCAL EXPERIMENT EVIDENCE / 04</p>
  <h2 className="panel-title" id="lovastatin-evidence-title">{t(
   "Lovastatin：成長・一次・二次の実測比較","Lovastatin: growth, primary and secondary source comparisons")}</h2>
  <p className="dataset-muted">{t(
   "3冊の原本Excelは配布せず、手元で変換したJSONをこのブラウザ内だけで解析します。サーバー送信なし。時間・測定値の単位は原本シートで未定義。",
   "Three source workbooks are NOT redistributed. Open the locally converted JSON inside this browser only; no server upload. Original time and measurement units remain unknown."
  )}</p>
  <p className="verification-caution">{t(
   "GrowthとSecondaryは5実験IDが重複します。Secondary全体を独立ホールドアウトと主張することは禁止。公表予測値の残差は新しいPBEモデルの予測精度ではありません。",
   "Growth and Secondary share five experiment IDs. Secondary is NOT a fully independent holdout. Residuals of published predictions are NOT accuracy evidence for a new PBE model."
  )}</p>
  <label className="dataset-muted" htmlFor="lovastatin-file">{t(
   "オフライン変換したLovastatin JSONを選択","Choose privately converted Lovastatin JSON")}</label>
  <input id="lovastatin-file" type="file" accept=".json,application/json"
   onChange={e=>{void readLocal(e.currentTarget.files?.[0]??null)}} />
  {error&&<p role="alert" className="dataset-error">{error}</p>}
  <p className="dataset-muted">{t("原本の監査済み件数","Audited source inventory")}:{" "}
   {LOVASTATIN_PHASES.map(p=>p+" "+LOVASTATIN_BOOKS[p].n).join(" / ")}
   {" — "}<a href="https://pureportal.strath.ac.uk/en/datasets/data-for-benchmarking-model-based-design-of-experiment-approaches/" rel="noreferrer" target="_blank">Strathclyde source</a>
  </p>
  {data&&source&&<div>
   <div className="dataset-actions">
    <label>{t("データ区分","Workbook")}
     <select value={phase} onChange={e=>{setPhase(e.target.value as LovastatinPhase);setRun("")}}>
      {LOVASTATIN_PHASES.map(p=><option value={p} key={p}>{p} ({LOVASTATIN_BOOKS[p].n})</option>)}
     </select>
    </label>
    <label>{t("実験ID","Experiment ID")}
     <select value={selected??""} onChange={e=>setRun(e.target.value)}>
      {source.experiments.map(id=><option value={id} key={id}>{id}</option>)}
     </select>
    </label>
   </div>
   {comparison&&<>
    <Curve rows={comparison.rows}/>
    <p className="dataset-muted"><span style={{color:"#28a3a8"}}>●</span> {t("原本測定値","Published measurements")}
    {"　"}<span style={{color:"#9985d7"}}>●</span> {t("原本の公表予測値","Published predicted values")}</p>
    <p className="dataset-muted">n={comparison.metrics.count} · MAE={comparison.metrics.maeSourceUnits.toPrecision(4)} ·
     RMSE={comparison.metrics.rmseSourceUnits.toPrecision(4)} ·
     Bias={comparison.metrics.biasPredictionMinusMeasurement.toPrecision(4)}
     {" "}{t("（元シートの単位）","(unverified source units)")}</p>
    {comparison.sharesGrowthIdentity&&<p className="verification-caution">{t(
     "このSecondary実験はGrowthに同一IDが存在します。独立性はありません。",
     "This Secondary experiment ID also appears in Growth; it is not independent.")}</p>}
    <p className="verification-caution">{t(
     "独立予測を認証する証拠・測定単位・実験プロトコルは未確認。標準偏差の定義も未検証です。",
     "Independent prediction provenance, measurement units, experimental protocol and standard-deviation semantics remain unverified.")}</p>
   </>}
  </div>}
 </section>;
}
