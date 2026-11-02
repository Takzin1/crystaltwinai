"use client";

import { useState } from "react";
import type { LanguageCode } from "../lib/types";
import {
  DEFAULT_PBE_SETTINGS, runPbeUpwind, auditPbeReport, studyPbeGridRefinement,
  type PbeReport,
} from "../lib/pbe-upwind";

type GridStudy=ReturnType<typeof studyPbeGridRefinement>;
const metric=(n:number)=>Number.isFinite(n)?n.toExponential(3):"—";
function exportJSON(content:object){
  const b=new Blob([JSON.stringify(content,null,2)+"\n"],{type:"application/json"});
  const url=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=url;a.download="crystaltwin-pbe-synthetic-numerical-v1.json";
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
export default function PbeNumericalPanel({lang}:{lang:LanguageCode}){
  const [growth,setGrowth]=useState(DEFAULT_PBE_SETTINGS.growthUmPerMin);
  const [nucleation,setNucleation]=useState(DEFAULT_PBE_SETTINGS.nucleationCountPerMlMin);
  const [report,setReport]=useState<PbeReport|null>(null);
  const [grid,setGrid]=useState<GridStudy|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [evaluated,setEvaluated]=useState("");
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;
  const settings={...DEFAULT_PBE_SETTINGS,
    growthUmPerMin:growth,nucleationCountPerMlMin:nucleation};
  const current=JSON.stringify(settings);
  const stale=Boolean(report&&current!==evaluated);
  function run(){
    setError(null);setReport(null);setGrid(null);
    try{
      const data=runPbeUpwind(settings);
      const audit=auditPbeReport(data);
      if(!audit.passed)throw new Error("Independent PBE software audit: "+audit.issues.join("; "));
      const {bins:unused,...refineInput}=settings;
      void unused;
      const refinement=studyPbeGridRefinement(refineInput);
      if(!refinement.allSoftwareAuditsPass)
        throw new Error("Grid study software audit failed.");
      setReport(data);setGrid(refinement);setEvaluated(current);
    }catch(e){setError(e instanceof Error?e.message:"PBE bench failed.");}
  }
  function download(){
    if(!report||!grid||stale)return;
    try{exportJSON({report,grid,audit:auditPbeReport(report)});}
    catch(e){setError(e instanceof Error?e.message:"Export failed.");}
  }
  const last=report?.frames.at(-1);
  const binAggregates=last&&report?
    Array.from({length:32},(_,i)=>
      last.binNumberPerMl.slice(i*report.settings.bins/32,
        (i+1)*report.settings.bins/32).reduce((a,b)=>a+b,0)):null;
  const peak=binAggregates?Math.max(...binAggregates,1e-12):1;
  const scale=(v:number)=>Math.max(0,v/peak);
  return <section className="panel pbe-panel" aria-labelledby="pbe-title">
    <h2 className="panel-title" id="pbe-title">
      {t("PBE数値実験室 / 合成粒径分布","PBE Numerical Lab / SYNTHETIC")}
    </h2>
    <p className="dataset-muted">{t(
      "粒径構造を持つ離散PBEを、明示的な上流化・CFL制御・溶液/結晶の質量収支で実行します。成長・核発生パラメータは実測値ではなく教育用の固定入力です。",
      "Run a size-structured toy population balance with upwind advection, CFL control and liquid/solid mass accounting. Growth and nucleation are synthetic constants, not fitted kinetics."
    )}</p>
    <div className="pbe-controls">
      <label>{t("仮定した成長速度 (µm/min)","Assumed growth (µm/min)")}
        <input type="number" min="0" max="2" step="0.05" value={growth}
          onChange={e=>setGrowth(Number(e.target.value))}/>
      </label>
      <label>{t("仮定した核発生数 (個/mL/min)","Assumed births (particles/mL/min)")}
        <input type="number" min="0" max="100000000" step="5000" value={nucleation}
          onChange={e=>setNucleation(Number(e.target.value))}/>
      </label>
    </div>
    <div className="dataset-actions">
      <button type="button" className="dataset-clear" onClick={run}>
        {t("PBE・格子感度・質量収支を検査","Run PBE, grid and closure audits")}
      </button>
      <button type="button" className="dataset-clear" disabled={!report||!grid||stale} onClick={download}>
        {t("再現用JSONレポートを保存","Export reproducible JSON")}
      </button>
    </div>
    {stale&&<p role="status" className="verification-caution">
      {t("パラメータが変わりました。再実行するまで旧レポートは無効です。",
        "Inputs changed. The previous report is stale; rerun before export.")}
    </p>}
    {error&&<p role="alert" className="dataset-error">{error}</p>}
    {report&&grid&&last&&<div className="pbe-results" aria-live="polite">
      <div className="bench-summary">
        <div><strong>{last.d50NumberUm?.toFixed(2)??"—"}</strong>
          <span>{t("d50（数基準 µm）","Number-weighted d50 (µm)")}</span></div>
        <div><strong>{metric(report.summary.maximumMassClosureResidualGPerMl)}</strong>
          <span>{t("最大質量収支残差 (g/mL)","Max mass closure residual (g/mL)")}</span></div>
        <div><strong>{report.summary.maximumCourant.toFixed(3)}</strong>
          <span>{t("最大CFL","Max Courant number")}</span></div>
      </div>
      <p className="dataset-muted">{t(
        "数基準の最終粒径分布。縦軸は各サイズ区画の粒子数（全て合成値）、棒は32区画へ集約しています。",
        "Final number-weighted particle-size distribution. All counts are synthetic; bars aggregate the grid into 32 display bins."
      )}</p>
      <div className="pbe-histogram" role="img" aria-label={t(
        "最終時刻の合成粒子数分布ヒストグラム",
        "Synthetic final particle-number histogram"
      )}>
        <svg viewBox="0 0 680 168" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <line x1="30" x2="660" y1="139" y2="139" stroke="currentColor" opacity=".38"/>
          {binAggregates?.map((amount,i)=><rect key={i}
            x={31+i*19.6} y={139-116*scale(amount)}
            width={15.8} height={116*scale(amount)}
            fill="var(--cyan)" opacity={0.84}/>)}
          <text x="31" y="158" fill="currentColor" fontSize="11">{report.settings.minLengthUm} µm</text>
          <text x="566" y="158" fill="currentColor" fontSize="11">{report.settings.maxLengthUm} µm</text>
        </svg>
      </div>
      <p className="dataset-muted">
        {t("d10 / d50 / d90（数基準）","Number-weighted d10 / d50 / d90")}:{" "}
        {last.d10NumberUm?.toFixed(2)??"—"} / {last.d50NumberUm?.toFixed(2)??"—"} / {last.d90NumberUm?.toFixed(2)??"—"} µm
        {" · "}{t("溶液残存量","Remaining dissolved mass")}: {metric(last.liquidGPerMl)} g/mL
      </p>
      {report.summary.cappedAtUpperBoundary&&<p role="status" className="verification-caution">
        {t("上端ビンで成長を打ち切ったため、粒径の予測値は境界の影響を受けています。",
          "Particles reached the upper-size boundary and were capped; size predictions are boundary-sensitive.")}
      </p>}
      <h3>{t("格子の細分化による感度（検証済み収束次数ではない）",
        "Grid-refinement sensitivity (not certified convergence)")}</h3>
      <div className="dataset-scroll"><table className="dataset-table">
        <thead><tr>
          <th scope="col">{t("ビン数","Bins")}</th>
          <th scope="col">d50 (µm)</th>
          <th scope="col">{t("数平均粒径 (µm)","Number mean size (µm)")}</th>
          <th scope="col">{t("固相質量 (g/mL)","Solid mass (g/mL)")}</th>
          <th scope="col">{t("上端境界","Upper boundary")}</th>
        </tr></thead>
        <tbody>{grid.results.map(item=><tr key={item.bins}>
          <td>{item.bins}</td>
          <td>{item.d50NumberUm?.toFixed(3)??"—"}</td>
          <td>{item.numberMeanUm?.toFixed(3)??"—"}</td>
          <td>{metric(item.solidGPerMl)}</td>
          <td>{item.upperBoundaryCapped?t("到達","Reached"):t("未到達","Clear")}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="verification-caution">{t(
        "これは合成条件によるソフトウェア検証で、実験から校正されたPBEではありません。格子幅によって初期種晶の代表粒径が変わり、van't Hoff型の溶解度評価とは独立しています。装置の制御・収量予測には使わないでください。",
        "This is a synthetic numerical audit, NOT an experimentally calibrated PBE. First-bin seed size shifts with grid resolution, and this module is independent of the solubility benchmark. Never use it to control equipment or predict real yields."
      )}</p>
    </div>}
  </section>;
}
