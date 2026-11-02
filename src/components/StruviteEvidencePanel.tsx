"use client";
import { useState } from "react";
import {
  measuredVsSimulatedPsdL1, STRUVITE_SOURCE, STRUVITE_SI,
  validateStruviteBundle, type StruviteBundle, type StruviteSI,
} from "../lib/struvite-source";
import type { LanguageCode } from "../lib/types";

const SOURCE_PATH="/examples/struvite-poiseuille-source-v1.json.gz.base64";
function Spectrum({size,observed,predicted}:{size:number[],observed:number[],predicted:number[]}){
  const x=(v:number)=>42+(Math.log10(v)-Math.log10(size[0]))/
    (Math.log10(size[size.length-1])-Math.log10(size[0]))*585;
  const y=(v:number)=>172-v/12*145;
  const path=(values:number[])=>values.map((v,i)=>
    (i===0?"M":"L")+x(size[i]).toFixed(2)+" "+y(v).toFixed(2)).join(" ");
  return <svg role="img" aria-label="Experimental volume percentage particle size distribution and source reported model curve on logarithmic particle-size axis" viewBox="0 0 655 218" style={{maxWidth:"100%",height:"auto"}}>
    <title>Experimental vs publication model, size distribution in volume percent</title>
    {[0,4,8,12].map(v=><g key={v}>
      <line x1="40" y1={y(v)} x2="629" y2={y(v)} stroke="currentColor" opacity=".13"/>
      <text x="34" y={y(v)+4} textAnchor="end" fill="currentColor" fontSize="11">{v}</text>
    </g>)}
    <path d={path(predicted)} fill="none" stroke="#b2a2ef" strokeWidth="2.5"/>
    <path d={path(observed)} fill="none" stroke="#29a9b3" strokeWidth="2.5"/>
    {[.01,.1,1,10,100].map(v=><text key={v} x={x(v)} y="195" textAnchor="middle" fill="currentColor" fontSize="11">{v}</text>)}
    <text x="330" y="213" textAnchor="middle" fill="currentColor" fontSize="10">Particle size (µm, log)</text>
    <text x="48" y="13" fill="currentColor" fontSize="10">Vol % / bin</text>
  </svg>;
}
async function decode(){
  const response=await fetch(SOURCE_PATH,{cache:"no-store"});
  if(!response.ok)throw new Error("Bundled struvite data cannot be loaded.");
  const b64=(await response.text()).trim();
  if(b64.length<1000||b64.length>25000||!(/^[A-Za-z0-9+/]+={0,2}$/).test(b64))
    throw new Error("Compressed data format invalid.");
  if(typeof DecompressionStream==="undefined")
    throw new Error("This browser lacks native gzip decompression.");
  const binary=atob(b64);
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const text=await new Response(new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream("gzip"))).text();
  if(new TextEncoder().encode(text).length>200000)
    throw new Error("Unexpectedly large expanded research bundle.");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  const hex=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,"0")).join("");
  if(hex!==STRUVITE_SOURCE.normalizedJsonSha256)
    throw new Error("Source-normalized bundle SHA-256 mismatch.");
  return validateStruviteBundle(JSON.parse(text));
}
export default function StruviteEvidencePanel({lang}:{lang:LanguageCode}){
  const [data,setData]=useState<StruviteBundle|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [si,setSi]=useState<StruviteSI>("1.0");
  const [mixer,setMixer]=useState<"R"|"IJ">("R");
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;
  async function load(){
    setBusy(true);setError(null);
    try{setData(await decode());}
    catch(err){setData(null);setError(err instanceof Error?err.message:"Source load failed.");}
    finally{setBusy(false);}
  }
  function exportData(){
    if(!data)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+"\n"],{type:"application/json"}));
    const a=document.createElement("a");
    a.href=url;a.download="struvite-poiseuille-observed-and-reported-models-v1.json";
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  const obs=data?.psd[mixer==="R"?"rMeasured":"ijMeasuredValidation"].bySI[si].volPercent;
  const model=data?.psd[mixer==="R"?"rOptimizedModel":"ijGalbraithModel"].bySI[si].volPercent;
  const diff=data?measuredVsSimulatedPsdL1(data,mixer,si):null;
  return <section className="panel" aria-labelledby="struvite-source-title">
    <p className="studio-eyebrow">SOURCE-NATIVE EXPERIMENT / 03</p>
    <h2 className="panel-title" id="struvite-source-title">{t(
      "Struvite実測PSD × 公表モデル比較",
      "Struvite measured PSD vs source-reported simulations"
    )}</h2>
    <p className="dataset-muted">{t(
      "提供されたExcelの87粒径ビンを無補間で保持。Rミキサー実測は最適化側、IJミキサー実測は原本で『検証用』と記載。両モデルの計算値は実験測定値ではありません。",
      "All 87 size bins are source-native and uninterpolated. R mixer observations belong to the fitting-side evidence; IJ mixer observations are source-labeled validation. Simulated curves are NEVER experimental measurements."
    )}</p>
    <div className="dataset-actions">
      <button type="button" className="dataset-clear" disabled={busy} onClick={load}>
        {busy?t("読み込み中","Loading"):t("実測Excel由来データを検証して表示","Verify and load bundled XLSX data")}
      </button>
      <button type="button" className="dataset-clear" disabled={!data} onClick={exportData}>
        {t("全データJSON保存","Export complete decoded JSON")}
      </button>
    </div>
    {error&&<p role="alert" className="dataset-error">{error}</p>}
    {data&&obs&&model&&diff&&<div>
      <div className="dataset-actions">
        <button type="button" className="dataset-clear" aria-pressed={mixer==="R"} onClick={()=>setMixer("R")}>
          {t("Rミキサー：最適化側","R mixer: fit side")}
        </button>
        <button type="button" className="dataset-clear" aria-pressed={mixer==="IJ"} onClick={()=>setMixer("IJ")}>
          {t("IJミキサー：原本の検証側","IJ mixer: reported validation")}
        </button>
        <label>{t("条件 SI","SI condition")}
          <select value={si} onChange={e=>setSi(e.target.value as StruviteSI)}>
            {STRUVITE_SI.map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <Spectrum size={data.sizeUm} observed={obs} predicted={model}/>
      <p className="dataset-muted">
        <span style={{color:"#29a9b3"}}>●</span> {t("実測・体積％","Measured · volume %")}
        {"　"}
        <span style={{color:"#b2a2ef"}}>●</span> {mixer==="R"?
          t("最適化パラメータの公表計算値","Source optimized-parameter simulation"):
          t("Galbraithパラメータの公表計算値","Source Galbraith-parameter simulation")}
      </p>
      <p className="dataset-muted">{t("87ビンでの総絶対差","Sum absolute differences over 87 bins")}:{" "}
        <strong>{diff.absoluteVolumePercentagePointSum.toFixed(2)}</strong>{" "}
        {t("体積パーセントポイント","volume percentage points")}。
        {t("粒子数密度や実験再現精度の証明ではありません。","Not a particle-number density or laboratory accuracy certificate.")}
      </p>
      <p className="verification-caution">{mixer==="R"?
        t("Rの計算値は最適化側の比較です。訓練データに対する誤差を独立ホールドアウトとして扱いません。",
          "R model is a fitting-side comparison. In-sample error is NOT an independent holdout."):
        t("IJ側の比較相手はGalbraithパラメータのモデルです。最適化後パラメータによるIJの独立予測が含まれているとは主張しません。",
          "IJ comparison uses Galbraith parameters; it is NOT an independent evaluation of newly optimized model parameters.")}</p>
      <p className="dataset-muted">{t(
        "付属データ：Rミキサー出口PO4-P濃度の実測時系列（最大9時刻）と、2系統のモデル時系列（各15時刻）。実測値は55分から、モデルは0分から始まるため、自動時間整列・誤差算出はしていません。",
        "Also bundled: R-mixer measured PO4-P traces (up to 9 times) and two simulated traces (15 times each). Observation times start at 55 min vs model at 0 min: no implicit time alignment or RMSE is computed."
      )}</p>
      <a href={data.sourceDatasetURL} target="_blank" rel="noreferrer">
        {t("元データ出典（Mendeley Data）","Original data attribution (Mendeley Data)")}
      </a>
    </div>}
  </section>;
}
