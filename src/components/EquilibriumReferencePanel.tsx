"use client";

import { useState } from "react";
import { parseResearchDataset } from "../lib/research-schema";
import { evaluateEquilibriumReference } from "../lib/equilibrium-reference";
import type { LanguageCode } from "../lib/types";

type Report=ReturnType<typeof evaluateEquilibriumReference>;
const REFERENCE_PATH="/examples/bigsoldb21-paracetamol-ethanol.measured.json";
const format=(value:number)=>Number.isFinite(value)?value.toExponential(4):"—";

export default function EquilibriumReferencePanel({lang}: {lang:LanguageCode}) {
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;

  async function load() {
    setBusy(true);
    setReport(null);
    setError(null);
    try {
      const response=await fetch(REFERENCE_PATH,{cache:"no-store"});
      if(!response.ok)throw new Error("Bundled reference JSON unavailable.");
      const content=await response.text();
      const dataset=parseResearchDataset(content);
      if(dataset.metadata.doi!=="10.1007/s10953-005-9007-8"||
        dataset.metadata.material.indexOf("Paracetamol")===-1||
        dataset.metadata.solvent!=="ethanol"||
        dataset.measurements.length!==5)
        throw new Error("Bundled reference identity mismatch.");
      setReport(evaluateEquilibriumReference(dataset));
    }catch(e) {
      setError(e instanceof Error?e.message:"Reference validation failed.");
    }finally{setBusy(false);}
  }
  function exportReport(){
    if(!report)return;
    try {
      const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+"\n"],
        {type:"application/json"}));
      const a=document.createElement("a");
      a.href=url;
      a.download="bigsoldb21-paracetamol-ethanol-holdout.json";
      document.body.appendChild(a);
      a.click();a.remove();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"Report export failed");}
  }
  return <section className="panel reference-benchmark-panel" aria-labelledby="equilibrium-reference-title">
    <h2 className="panel-title" id="equilibrium-reference-title">
      {t("実測文献データ / Equilibrium Reference", "Published observations / Equilibrium Reference")}
    </h2>
    <p className="dataset-muted">{t(
      "BigSolDB v2.1（CC BY 4.0）に収録されたパラセタモール×エタノールの溶解度5点。文献に報告されたモル分率をそのまま用い、低温側3点のみで直線を推定し、高温側2点を外挿で評価します。",
      "Five compiled paracetamol/ethanol solubility observations from BigSolDB v2.1 (CC BY 4.0). Fit a line using only the lower-temperature three points and extrapolate to two untouched higher-temperature points."
    )}</p>
    <div className="dataset-actions">
      <button type="button" className="dataset-clear" disabled={busy} onClick={load}>
        {busy?t("測定値を検査中…","Validating observations…"):
          t("公開実測データを読み込んで評価","Load published observations & run holdout")}
      </button>
      <a href={REFERENCE_PATH} download>{t("研究用JSONを保存","Download Research v2 JSON")}</a>
      {report&&<button type="button" className="dataset-clear" onClick={exportReport}>
        {t("評価レポートを保存","Export holdout JSON")}
      </button>}
    </div>
    {error&&<p role="alert" className="dataset-error">{error}</p>}
    {report&&<div aria-live="polite" className="reference-benchmark-result">
      <p className="dataset-muted">{report.reference.title}</p>
      <div className="bench-summary">
        <div><strong>{report.partition.trainingCount}</strong><span>{t("学習点","Training points")}</span></div>
        <div><strong>{report.partition.holdoutCount}</strong><span>{t("未使用の評価点","Untouched evaluation points")}</span></div>
        <div><strong>{format(report.holdout.linear.rmse)}</strong><span>{t("外挿RMSE（モル分率）","Extrapolation RMSE (mole fraction)")}</span></div>
      </div>
      <div className="dataset-scroll">
        <table className="dataset-table">
          <thead><tr><th scope="col">{t("温度（K）","Temperature (K)")}</th>
          <th scope="col">{t("測定モル分率","Observed mole fraction")}</th>
          <th scope="col">{t("直線予測","Linear prediction")}</th>
          <th scope="col">{t("定数予測","Constant prediction")}</th></tr></thead>
          <tbody>{report.predictions.map(p=><tr key={p.temperatureK}>
            <td>{p.temperatureK.toFixed(2)}</td>
            <td>{p.observed.toFixed(6)}</td>
            <td>{p.linearPredicted.toFixed(6)}</td>
            <td>{p.constantPredicted.toFixed(6)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="dataset-muted">{t("直線 MAE: ","Linear MAE: ")}{format(report.holdout.linear.mae)}
        {" · "}{t("定数モデル RMSE: ","Constant RMSE: ")}{format(report.holdout.constant.rmse)}</p>
      <p className="dataset-muted">
        <a href="https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1" target="_blank" rel="noopener noreferrer">
          BigSolDB v2.1
        </a>{" · "}
        <a href="https://doi.org/10.1007/s10953-005-9007-8" target="_blank" rel="noopener noreferrer">
          {t("原著論文DOI","Original article DOI")}
        </a>
      </p>
    </div>}
    <p className="verification-caution">{t(
      "これは5測定点を用いた溶解度の外挿テストで、結晶成長・核発生・冷却結晶化の精度を示すものではありません。原著の生データ、結晶形、測定法を独立確認したわけではなく、装置運転には使用できません。",
      "This is an extrapolation test of a five-point equilibrium solubility curve—not validation of crystal growth, nucleation or cooling crystallization. Original raw observations, solid form and measurement protocol were not independently authenticated. Never use for equipment control."
    )}</p>
  </section>;
}
