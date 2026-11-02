"use client";
import { useState } from "react";
import { runAnalyticPbeAccuracyStudy } from "../lib/pbe-analytic-accuracy";
import type { LanguageCode } from "../lib/types";

type Study=ReturnType<typeof runAnalyticPbeAccuracyStudy>;
export default function PbeAccuracyPanel({lang}:{lang:LanguageCode}){
  const [study,setStudy]=useState<Study|null>(null);
  const [error,setError]=useState<string|null>(null);
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;
  function run(){
    setError(null);
    try{setStudy(runAnalyticPbeAccuracyStudy());}
    catch(e){setStudy(null);setError(e instanceof Error?e.message:"Accuracy study failed.");}
  }
  function download(){
    if(!study)return;
    try{
      const blob=new Blob([JSON.stringify(study,null,2)+"\n"],{type:"application/json"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download="crystaltwin-analytic-pbe-accuracy-v1.json";
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:"Export failed.");}
  }
  return <section className="panel pbe-accuracy-panel" aria-labelledby="pbe-accuracy-title">
    <h2 className="panel-title" id="pbe-accuracy-title">
      {t("PBE解析解ベンチマーク / 数値精度","PBE analytic reference / numeric accuracy")}
    </h2>
    <p className="dataset-muted">{t(
      "同じ初期粒径分布を、64・128・256ビンの格子に投影して解析解と比較。一次精度UpwindとMUSCL-minmod + SSP RK2のL1誤差を定量評価します。実験データでの物理モデル精度は評価していません。",
      "Compare upwind and MUSCL-minmod/SSP RK2 against an EXACT constant-growth advection solution on identical physical particle-size supports, using 64/128/256 grid cells. This does NOT measure experimental model accuracy."
    )}</p>
    <div className="dataset-actions">
      <button type="button" className="dataset-clear" onClick={run}>
        {t("解析解との数値誤差を測る","Measure exact-solution numeric error")}
      </button>
      <button type="button" className="dataset-clear" disabled={!study} onClick={download}>
        {t("数値誤差と全ビン結果をJSONで保存","Export full error and bin arrays")}
      </button>
    </div>
    {error&&<p role="alert" className="dataset-error">{error}</p>}
    {study&&<div aria-live="polite">
      <div className="bench-summary">
        <div><strong>{study.cases.length}</strong><span>{t("格子・方式の比較条件","Grid / scheme pairs")}</span></div>
        <div><strong>{study.trend.musclL1LowerAtEveryMesh?"YES":"NO"}</strong><span>{t("全格子でMUSCL誤差が小さいか","MUSCL error lower on all grids")}</span></div>
        <div><strong>{study.comparisons[2].musclImprovementFraction.toLocaleString(undefined,{style:"percent",maximumFractionDigits:1})}</strong>
          <span>{t("256ビン時の相対誤差低減","Relative L1 error reduction at 256 bins")}</span></div>
      </div>
      <div className="dataset-scroll"><table className="dataset-table">
        <thead><tr>
          <th scope="col">{t("粒径ビン数","Size bins")}</th>
          <th scope="col">Upwind L1</th><th scope="col">MUSCL L1</th>
          <th scope="col">{t("改善率","Error reduction")}</th>
        </tr></thead>
        <tbody>{study.comparisons.map(c=><tr key={c.bins}>
          <th scope="row">{c.bins}</th>
          <td>{c.upwindL1.toFixed(5)}</td>
          <td>{c.musclL1.toFixed(5)}</td>
          <td>{(100*c.musclImprovementFraction).toFixed(1)}%</td>
        </tr>)}</tbody>
      </table></div>
      <p className="dataset-muted">{t(
        "解析解：初期10–20 µmの均一粒子数分布を、仮定した成長速度0.65 µm/minで20分だけ平行移動。最終分布23–33 µm、粒子数の平均粒径28 µm。CFL上限0.4、境界流出なし。",
        "Exact test: translate a uniform 10–20 µm size-support by 0.65 µm/min for 20 min. Final support 23–33 µm, number-weighted mean 28 µm. Courant <=0.4; no outgoing boundary flux."
      )}</p>
      <p className="verification-caution">{t(
        "L1誤差の低減は数値解法の検証であって、実結晶の成長速度・核発生・PBE物理の精度保証ではありません。不連続な矩形分布では漸近2次精度を証明できません。元の教育用PBEの種晶配置とも別試験です。",
        "Reduced L1 error verifies the NUMERICAL ADVECTION SCHEME only—not real growth, nucleation or physical PBE. A discontinuous top-hat cannot certify asymptotic second-order convergence. This test is independent of the teaching PBE's first-bin seeds."
      )}</p>
    </div>}
  </section>;
}
