"use client";
import { useState } from "react";
import { runAnalyticPbeAccuracyStudy } from "../lib/pbe-analytic-accuracy";
import type { LanguageCode } from "../lib/types";

type Study=ReturnType<typeof runAnalyticPbeAccuracyStudy>;
export default function PbeAccuracyPanel({lang}:{lang:LanguageCode}){
  const [study,setStudy]=useState<Study|null>(null);
  const [error,setError]=useState<string|null>(null);
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;
  function run(profile:"top_hat"|"smooth_sin4"){
    setError(null);
    try{setStudy(profile==="smooth_sin4"?
      runAnalyticPbeAccuracyStudy({
        initialProfile:"smooth_sin4",initialSupportUm:[15,45],
        growthUmPerMin:0.6,timeMinutes:20,maxCourant:0.4,
      }):runAnalyticPbeAccuracyStudy());}
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
      <button type="button" className="dataset-clear" onClick={()=>run("top_hat")}>
        {t("矩形分布（不連続）のテスト","Top-hat discontinuity test")}
      </button>
      <button type="button" className="dataset-clear" onClick={()=>run("smooth_sin4")}>
        {t("滑らかな分布の収束テスト","Smooth sin⁴ convergence test")}
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
      <p className="dataset-muted">{study.settings.initialProfile==="smooth_sin4"
        ? t("滑らかなsin⁴分布：15–45 µm→27–57 µm（G=0.6 µm/min、20分）。各ビンの厳密積分と比較。CIには時間刻み0.4/0.2/0.1の独立収束結果も保存します。",
          "Smooth sin⁴ profile: 15–45 → 27–57 µm (G=0.6 µm/min, 20 min). Each numerical bin is compared with the exact integral. CI separately records CFL 0.4/0.2/0.1 self-convergence.")
        : t("矩形分布：10–20 µm→23–33 µm（G=0.65 µm/min、20分）。不連続な初期条件の数値拡散を検査。",
          "Top-hat: 10–20 → 23–33 µm (G=0.65 µm/min, 20 min). Tests numerical diffusion across discontinuous edges.")
      }</p>
      <p className="verification-caution">{t(
        "L1誤差と経験的な収束次数は、仮定した数値移流方程式の検証に限ります。実測の結晶成長速度・核発生・工業装置の予測精度ではありません。単一条件の収束は一般的な2次精度の証明ではありません。",
        "These L1 errors and empirical convergence rates verify only the mathematical advection scheme. They do NOT establish measured crystal growth, nucleation kinetics, industrial predictions or a general second-order accuracy certificate."
      )}</p>
    </div>}
  </section>;
}
