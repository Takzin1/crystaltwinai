"use client";

import { useState, type ChangeEvent } from "react";
import { MAX_RESEARCH_BYTES, parseResearchDataset } from "../lib/research-schema";
import { evaluateEquilibriumProtocolV2, type ModelKey } from "../lib/equilibrium-protocol-v2";
import type { LanguageCode } from "../lib/types";

type Report=ReturnType<typeof evaluateEquilibriumProtocolV2>;
interface Loaded {
  evaluation: Report;
  researchJsonSha256: string;
  originalJsonByteLength: number;
  origin: "bundled_compilation" | "user_selected_local_file";
}
const REFERENCE_PATH="/examples/bigsoldb21-paracetamol-ethanol.measured.json";
const KEYS: readonly ModelKey[] = ["constant","linear","vanthoff"];
const format=(value:number|null)=>value===null?"—":value.toExponential(4);
const labels: Record<ModelKey,{ja:string;en:string}>={
  constant:{ja:"学習平均（定数）",en:"Training mean"},
  linear:{ja:"モル分率・温度の直線",en:"Linear mole fraction vs T"},
  vanthoff:{ja:"van't Hoff型の見かけの近似",en:"Apparent van't Hoff fit"},
};

/** No data leave the browser; input is at most 1 MiB, hashed as exact bytes. */
export default function EquilibriumReferencePanel({lang}:{lang:LanguageCode}){
  const [loaded,setLoaded]=useState<Loaded|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;
  const compute=async(bytes:ArrayBuffer,origin:Loaded["origin"])=>{
    if(bytes.byteLength<1||bytes.byteLength>MAX_RESEARCH_BYTES)
      throw new Error("Research v2 JSON must be 1 byte to 1 MiB.");
    if(typeof crypto==="undefined"||!crypto.subtle)
      throw new Error("Exact-byte SHA-256 requires HTTPS or localhost.");
    const json=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    const dataset=parseResearchDataset(json);
    if(origin==="bundled_compilation" && (
      dataset.metadata.doi!=="10.1007/s10953-005-9007-8"||
      dataset.metadata.material.indexOf("Paracetamol")===-1||
      dataset.metadata.solvent!=="ethanol"||
      dataset.measurements.length!==5
    ))throw new Error("Bundled reference identity mismatch.");
    const evaluation=evaluateEquilibriumProtocolV2(dataset);
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    const researchJsonSha256=Array.from(new Uint8Array(digest),
      value=>value.toString(16).padStart(2,"0")).join("");
    setLoaded({evaluation,researchJsonSha256,
      originalJsonByteLength:bytes.byteLength,origin});
  };
  async function runBundled(){
    if(busy)return;
    setError(null);setLoaded(null);setBusy(true);
    try{
      const response=await fetch(REFERENCE_PATH,{cache:"no-store"});
      if(!response.ok)throw new Error("Bundled reference JSON not available.");
      await compute(await response.arrayBuffer(),"bundled_compilation");
    }catch(e){
      setError(e instanceof Error?e.message:"Bundled reference evaluation failed.");
    }finally{setBusy(false);}
  }
  async function runUserFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value="";
    if(!file||busy)return;
    setError(null);setLoaded(null);setBusy(true);
    try{
      if(!file.name.toLowerCase().endsWith(".json"))
        throw new Error("Select a Research Schema v2 .json file.");
      if(file.size<1||file.size>MAX_RESEARCH_BYTES)
        throw new Error("Research v2 JSON must be 1 byte to 1 MiB.");
      await compute(await file.arrayBuffer(),"user_selected_local_file");
    }catch(e){
      setError(e instanceof Error?e.message:"Local research evaluation failed.");
    }finally{setBusy(false);}
  }
  function exportReport(){
    if(!loaded)return;
    try{
      const data={
        ...loaded,
        sourceJsonSHA256Meaning:"Exact bytes of the selected Research Schema v2 JSON; not a publisher or laboratory signature.",
      };
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+"\n"],
        {type:"application/json"}));
      const a=document.createElement("a");
      a.href=url;a.download="crystaltwin-equilibrium-evaluation-v2.json";
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"Export failed.");}
  }
  const report=loaded?.evaluation;
  const source=report?.declaredSource;
  return <section className="panel reference-benchmark-panel" aria-labelledby="equilibrium-reference-title">
    <h2 className="panel-title" id="equilibrium-reference-title">
      {t("Equilibrium Lab / 溶解度の外挿評価","Equilibrium Lab / Extrapolation protocol")}
    </h2>
    <p className="dataset-muted">{t(
      "BigSolDB文献由来の付属例か、任意の研究用JSONを評価できます。モル分率の溶解度と温度だけを使い、学習平均・温度直線・van't Hoff型近似の3手法を同一の高温側Holdoutで比較します。",
      "Evaluate the bundled literature-compiled BigSolDB example or a local Research v2 JSON. Three predeclared descriptive baselines use native solute mole fraction and temperature, then share the same held-out high-temperature extrapolation."
    )}</p>
    <div className="dataset-actions">
      <button className="dataset-clear" type="button" disabled={busy} onClick={runBundled}>
        {busy?t("読み込み・評価中…","Evaluating…"):
          t("付属BigSolDB例を評価","Evaluate bundled BigSolDB subset")}
      </button>
      <label className="dataset-upload">
        {t("自分の研究用JSONを評価","Evaluate local Research v2 JSON")}
        <input type="file" accept=".json,application/json" onChange={runUserFile} disabled={busy}/>
      </label>
      <a href={REFERENCE_PATH} download>{t("付属研究用JSONを保存","Download bundled research JSON")}</a>
      {loaded && <button className="dataset-clear" type="button" onClick={exportReport}>
        {t("評価と出典監査をJSONで保存","Export evaluation & provenance JSON")}
      </button>}
    </div>
    <p className="dataset-muted">{t(
      "ローカルJSONはブラウザ内だけで解析・SHA-256計算します。HTTPSまたはlocalhostが必要で、最大1 MiB。元実験の真正性や再配布権限は別途確認が必要です。",
      "Local JSON is parsed and SHA-256 hashed entirely in the browser (HTTPS/localhost, 1 MiB maximum). File-byte consistency does not establish laboratory authenticity or rights."
    )}</p>
    {error&&<p className="dataset-error" role="alert">{error}</p>}
    {report && loaded && source && <div className="reference-benchmark-result" aria-live="polite">
      <strong>{source.title}</strong>
      <p className="dataset-muted">
        {source.material} · {source.solvent} · {source.provenance} ({t("申告","declared")})
        {source.solidForm ? " · "+source.solidForm : "" }
      </p>
      <p className="dataset-checksum">Imported Research JSON SHA-256: <code>{loaded.researchJsonSha256}</code></p>
      <div className="bench-summary">
        <div><strong>{report.protocol.trainedCount}</strong><span>{t("学習点","Training points")}</span></div>
        <div><strong>{report.protocol.holdoutCount}</strong><span>{t("高温側Holdout","High-temperature holdout")}</span></div>
        <div><strong>{report.holdoutMetrics.vanthoff.status==="scored"?
          format(report.holdoutMetrics.vanthoff.rmse):"—"}</strong>
          <span>{t("van't Hoff型 RMSE（モル分率）","Van't Hoff-type RMSE (mole fraction)")}</span></div>
      </div>
      <div className="dataset-scroll">
        <table className="dataset-table">
          <thead><tr>
            <th scope="col">{t("事前指定モデル","Prespecified baseline")}</th>
            <th scope="col">MAE</th><th scope="col">RMSE</th>
            <th scope="col">{t("平均符号誤差","Signed bias")}</th>
            <th scope="col">{t("評価状態","Status")}</th>
          </tr></thead>
          <tbody>{KEYS.map(k=><tr key={k}>
            <th scope="row">{labels[k][lang]}</th>
            <td>{format(report.holdoutMetrics[k].mae)}</td>
            <td>{format(report.holdoutMetrics[k].rmse)}</td>
            <td>{format(report.holdoutMetrics[k].signedBias)}</td>
            <td>{report.holdoutMetrics[k].status==="scored"?
              t("評価可能","Scored"):t("物理範囲外","Invalid forecast")}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="dataset-scroll">
        <table className="dataset-table">
          <thead><tr>
            <th scope="col">T (K)</th><th scope="col">{t("観測モル分率","Observed mole fraction")}</th>
            <th scope="col">{t("定数","Constant")}</th>
            <th scope="col">{t("直線","Linear")}</th>
            <th scope="col">van't Hoff</th>
          </tr></thead>
          <tbody>{report.predictions.map(p=><tr key={p.temperatureK}>
            <td>{p.temperatureK.toFixed(2)}</td>
            <td>{p.observedMoleFraction.toFixed(6)}</td>
            <td>{p.constant?.toFixed(6)??"—"}</td>
            <td>{p.linear?.toFixed(6)??"—"}</td>
            <td>{p.vanthoff?.toFixed(6)??"—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="dataset-muted">DOI: {source.doi??t("未記載","not declared")}
        {" · "}{t("測定手法","Measurement method")}: {source.measurementMethod??t("未確認","unspecified")}
        {" · "}{t("結晶形","Solid form")}: {source.solidForm??t("未確認","unspecified")}</p>
      {source.sourceUrl&& <p className="dataset-muted">
        <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
          {t("申告された原典URL","Declared source URL")}
        </a>
      </p>}
      <p className="verification-caution">{t(
        "評価値が小さくても結晶成長・核発生・PBEの検証にはなりません。モデル選択を同じHoldoutの結果に基づいて繰り返すと評価バイアスが生じます。論文への掲載には独立した別データでの再評価が必要です。",
        "A small error does not validate growth, nucleation or PBE. Repeatedly selecting models based on this same holdout creates evaluation bias; independent confirmatory experiments/data are needed."
      )}</p>
      <ul className="reference-limitations">
        {report.limitations.map((message,i)=><li key={i}>{message}</li>)}
      </ul>
    </div>}
  </section>;
}
