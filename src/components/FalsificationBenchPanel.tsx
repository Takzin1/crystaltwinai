"use client";

import { useState } from "react";
import {
  runFalsificationBenchmark, type FalsificationReport,
} from "../lib/falsification-bench";
import type { LanguageCode, SimulationInput } from "../lib/types";

/** On-demand synthetic software audit, never model/process certification. */
export default function FalsificationBenchPanel({lang,input}: {
  lang: LanguageCode; input: SimulationInput;
}) {
  const [report,setReport]=useState<FalsificationReport|null>(null);
  const [sourceInput,setSourceInput]=useState("");
  const [error,setError]=useState<string|null>(null);
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;
  const stale=report!==null && sourceInput!==JSON.stringify(input);
  const run=()=>{
    setError(null);
    try {
      const next=runFalsificationBenchmark({...input});
      setReport(next);
      setSourceInput(JSON.stringify(input));
    } catch(e) {
      setReport(null);
      setError(e instanceof Error?e.message:"Benchmark failed");
    }
  };
  const download=()=>{
    if(!report || stale) return;
    try {
      const content=JSON.stringify(report,null,2)+"\n";
      const blob=new Blob([content],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download="crystaltwin-synthetic-falsification-v1.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"Export failed");}
  };
  return (
    <section className="panel verification-panel bench-panel" aria-labelledby="falsification-title">
      <h2 className="panel-title" id="falsification-title">
        {t("反証ベンチ / SYNTHETIC FALSIFICATION", "Falsification bench / SYNTHETIC")}
      </h2>
      <p className="dataset-muted">{t(
        "教育用プリセット4条件と現在の入力で、ソフトウェア不変条件・再現性・3モデルの濃度差を検査します。実験結果や物理モデルの精度は検証しません。",
        "Check software invariants, deterministic replay and concentration disagreement across four fictional presets plus current inputs. No experiments or physical accuracy checks."
      )}</p>
      <div className="dataset-actions">
        <button className="dataset-clear" type="button" onClick={run}>
          {t("5条件で反証テスト実行", "Run five synthetic scenarios")}
        </button>
        <button className="dataset-clear" type="button" onClick={download}
          disabled={!report||stale}>
          {t("JSONレポートを保存", "Export JSON report")}
        </button>
      </div>
      {error && <p role="alert" className="dataset-error">{error}</p>}
      {stale && <p role="status" className="verification-caution">{t(
        "現在の入力が変更されています。旧レポートはこの条件に対応しません。再実行してください。",
        "Current inputs have changed; the previous report is stale. Run again."
      )}</p>}
      {report && <div className="bench-results" aria-live="polite">
        <div className="bench-summary">
          <div><strong>{report.summary.cases}</strong><span>{t("合成条件","Synthetic cases")}</span></div>
          <div><strong>{report.summary.softwareFailures}</strong><span>{t("ソフトウェア不整合","Software failures")}</span></div>
          <div><strong>{report.summary.modelDisagreementAlerts}</strong><span>{t("モデル間の濃度差アラート","Disagreement alerts")}</span></div>
        </div>
        <div className="dataset-scroll">
          <table className="dataset-table">
            <thead><tr>
              <th scope="col">{t("条件","Scenario")}</th>
              <th scope="col">{t("整合性","Software checks")}</th>
              <th scope="col">A–B RMSE (g/mL)</th>
              <th scope="col">A–C RMSE (g/mL)</th>
              <th scope="col">{t("Cの質量収支最大残差","C closure max")}</th>
            </tr></thead>
            <tbody>{report.cases.map(c=><tr key={c.id}>
              <th scope="row">{c.id}</th>
              <td>{c.softwareInvariantsPass?t("適合","Pass"):t("不整合","Failure")}</td>
              <td>{c.primaryVsRelaxation.concentrationRmse.toExponential(3)}</td>
              <td>{c.primaryVsConservative.concentrationRmse.toExponential(3)}
                {c.concentrationDisagreementAlert?" *":""}</td>
              <td>{c.conservativeClosureMaxAbs.toExponential(2)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="dataset-muted">* {t(
          "1つ以上の濃度RMSEが教育用の表示閾値0.01 g/mLを超えています。これは精度・合否の判定ではありません。",
          "At least one concentration RMSE exceeds the illustrative 0.01 g/mL alert level. This is not a model-accuracy or pass/fail verdict."
        )}</p>
        {report.cases.filter(c=>!c.softwareInvariantsPass).map(c=><p role="alert"
          className="dataset-error" key={c.id}>
          {c.id}: {[...c.primarySoftwareIssues,...c.conservativeSoftwareIssues,
            ...(c.deterministicRepeat?[]:["deterministic replay failed"])].join("; ")}
        </p>)}
      </div>}
      <p className="verification-caution">{t(
        "A＝既存の教育用主モデル、B＝一次緩和モデル、C＝二相の質量収支を保つ簡略モデル。Cの残差はC自身の内部整合性であり、Aの収量スコアを質量に換算したものではありません。3モデルとも未校正で、線形溶解度と冷却仮定を共有します。",
        "A is the original toy model, B is a first-order relaxation model and C is a mass-conserving two-compartment toy model. C's closure applies only to C. All three are uncalibrated and share linear-solubility and cooling assumptions."
      )}</p>
    </section>
  );
}
