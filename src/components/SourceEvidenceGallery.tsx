"use client";
import { useState } from "react";
import { MAX_RESEARCH_BYTES, parseResearchDataset } from "../lib/research-schema";
import { SOURCE_GALLERY, SOURCE_COMPILATION, EXTERNAL_SOURCE_CANDIDATES } from "../lib/source-gallery";
import type { LanguageCode } from "../lib/types";

type Series={id:string;points:{temperature:number;solubility:number}[];title:string};
const neat=(n:number)=>n.toExponential(3);
function Curve({points}:{points:Series["points"]}){
  const xs=points.map(p=>p.temperature),ys=points.map(p=>p.solubility);
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const maxY=Math.max(...ys)*1.14;
  const x=(v:number)=>50+(v-minX)/(maxX-minX)*570;
  const y=(v:number)=>172-v/maxY*130;
  const line=points.map((p,i)=>(i===0?"M":"L")+x(p.temperature).toFixed(2)+" "+y(p.solubility).toFixed(2)).join(" ");
  return <svg viewBox="0 0 650 208" className="source-curve" role="img" aria-label="Source-native solubility by Kelvin temperature">
    <title>Observed mole fraction versus Kelvin temperature</title>
    {[0,.5,1].map(f=><g key={f}>
      <line x1="49" x2="623" y1={y(f*maxY)} y2={y(f*maxY)} stroke="currentColor" opacity=".15"/>
      <text x="43" y={y(f*maxY)+4} textAnchor="end" fill="currentColor" fontSize="11">{neat(f*maxY)}</text>
    </g>)}
    <path d={line} fill="none" stroke="var(--cyan)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    {points.map(p=><circle key={p.temperature} cx={x(p.temperature)} cy={y(p.solubility)}
      r="4.4" stroke="var(--bg)" strokeWidth="2" fill="var(--cyan)"/>)}
    <text x="50" y="198" fill="currentColor" fontSize="11">{minX.toFixed(1)} K</text>
    <text x="622" y="198" textAnchor="end" fill="currentColor" fontSize="11">{maxX.toFixed(1)} K</text>
    <text x="49" y="11" fill="currentColor" fontSize="10">mole fraction</text>
  </svg>;
}
export default function SourceEvidenceGallery({lang}:{lang:LanguageCode}){
  const [selected,setSelected]=useState<string>(SOURCE_GALLERY[0].id);
  const [series,setSeries]=useState<Series|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const current=SOURCE_GALLERY.find(s=>s.id===selected)??SOURCE_GALLERY[0];
  const t=(ja:string,en:string)=>lang==="ja"?ja:en;
  async function load(id:string){
    if(busy)return;
    setSelected(id);setSeries(null);setError(null);setBusy(true);
    const item=SOURCE_GALLERY.find(v=>v.id===id);
    if(!item){setBusy(false);return;}
    try{
      const response=await fetch(item.path,{cache:"no-store"});
      if(!response.ok)throw new Error("Bundled research source unavailable.");
      const raw=await response.text();
      if(new TextEncoder().encode(raw).byteLength>MAX_RESEARCH_BYTES)throw new Error("Research JSON exceeds 1 MiB.");
      const dataset=parseResearchDataset(raw);
      if(dataset.metadata.doi!==item.doi||dataset.metadata.material!==item.material||
         dataset.metadata.solvent!=="ethanol"||dataset.metadata.units.temperature!=="K"||
         dataset.metadata.units.solubility!=="mole_fraction"||
         dataset.metadata.concentrationBasis!=="mole_fraction"||
         dataset.measurements.length!==item.points)
        throw new Error("Bundled source DOI, identity or units mismatch.");
      const values=dataset.measurements.map(row=>{
        if(typeof row.temperature!=="number"||typeof row.solubility!=="number"||
           row.solubility<=0||row.solubility>=1)throw new Error("Invalid native observation.");
        return {temperature:row.temperature,solubility:row.solubility};
      }).sort((a,b)=>a.temperature-b.temperature);
      if(values.some((p,i)=>i>0&&p.temperature<=values[i-1].temperature))
        throw new Error("Duplicate source temperatures.");
      setSeries({id:item.id,points:values,title:dataset.metadata.title});
    }catch(e){setError(e instanceof Error?e.message:"Source validation failed.");}
    finally{setBusy(false);}
  }
  const shown=series?.id===selected?series:null;
  return <section className="panel source-gallery-panel" aria-labelledby="source-gallery-title">
    <div className="source-gallery-head">
      <div>
        <p className="studio-eyebrow">RESEARCH EVIDENCE / 02</p>
        <h2 id="source-gallery-title">{t("公開実験由来データのギャラリー","Published observation gallery")}</h2>
        <p>{t(
          "公開ビューアで数値を照合した文献集約データ。原著の生データや結晶形は独立検証していません。",
          "Literature-compiled observations checked against the public viewer. Original laboratory measurements and solid phase are not independently authenticated."
        )}</p>
      </div>
      <span className="studio-source-chip">CC BY 4.0 · COMPILATION</span>
    </div>
    <div className="source-sample-grid">
      {SOURCE_GALLERY.map(item=><article className={"source-sample-card"+(selected===item.id?" is-selected":"")} key={item.id}>
        <div className="source-mini-label">{t("文献集約のサンプル","Literature subset")} · {item.points} pts</div>
        <h3>{item.material}</h3>
        <p>{item.formula} <span>· ethanol</span></p>
        <p className="source-range">{item.temperatureRangeK[0]}–{item.temperatureRangeK[1]} K</p>
        <button type="button" onClick={()=>load(item.id)} disabled={busy}>
          {selected===item.id&&busy?t("照合中…","Loading…"):t("数値と曲線を確認","Inspect source-native curve")}
        </button>
        <a href={item.path} download>{t("研究用JSON","Download research JSON")}</a>
      </article>)}
    </div>
    {error&&<p role="alert" className="dataset-error">{error}</p>}
    {shown&&<div className="source-readout" aria-live="polite">
      <div className="source-readout-heading">
        <strong>{shown.title}</strong><span>{shown.points.length} SOURCE ROWS · K / MOLE FRACTION</span>
      </div>
      <Curve points={shown.points}/>
      <div className="source-readout-footer">
        <span>{t("最低値","Min")}: {neat(Math.min(...shown.points.map(p=>p.solubility)))}</span>
        <span>{t("最高値","Max")}: {neat(Math.max(...shown.points.map(p=>p.solubility)))}</span>
        <a href={"https://doi.org/"+current.doi} target="_blank" rel="noopener noreferrer">
          {t("原論文DOI","Original paper DOI")}
        </a>
      </div>
    </div>}
    <div className="source-boundary">
      <strong>{t("出典境界","Evidence boundary")}</strong>
      <p>{t(
        "確認したのは公開ビューアの数値と配布ライセンス。原著の生データ、結晶形、再現測定、PBEの物理的妥当性は未確認。教育用シミュレーターへは自動投入しません。",
        "Viewer values and compilation license were reviewed; original lab records, polymorph, replicates and PBE physics remain unauthenticated. Nothing is injected into the educational simulator."
      )}</p>
      <a href={SOURCE_COMPILATION.url} target="_blank" rel="noopener noreferrer">BigSolDB v2.1 ↗</a>
    </div>
    <div className="source-next">
      <h3>{t("次の実験データ候補","Next experimental evidence candidates")}</h3>
      {EXTERNAL_SOURCE_CANDIDATES.map(candidate=><div className="source-next-row" key={candidate.doi}>
        <div><strong>{candidate.title}</strong>
          <p>{candidate.modality}</p>
          <span>{candidate.license==="license_not_verified"?t("ライセンス確認待ち","License review pending"):candidate.license}
            {" · "}{t("未取り込み","Not imported")}</span></div>
        <a href={candidate.url} target="_blank" rel="noopener noreferrer">{t("原典を開く","Open source")} ↗</a>
      </div>)}
    </div>
  </section>;
}
