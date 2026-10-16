"use client";

import { useState, type ChangeEvent } from "react";
import { MAX_RESEARCH_BYTES, parseResearchDataset, type ResearchDataset } from "../lib/research-schema";
import { summarizeResearchDataset } from "../lib/research-integrity";
import type { LanguageCode } from "../lib/types";

export default function ResearchDatasetPanel({ lang }: { lang: LanguageCode }) {
  const [dataset,setDataset] = useState<ResearchDataset | null>(null);
  const [checksum,setChecksum] = useState<string | null>(null);
  const [error,setError] = useState<string | null>(null);
  const [busy,setBusy] = useState(false);
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value="";
    if (!file) return;
    setError(null);
    setDataset(null);
    setChecksum(null);
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Research v2 currently accepts JSON only.");
      if (file.size > MAX_RESEARCH_BYTES) throw new Error("Research file exceeds 1 MiB.");
      const content=await file.text();
      const parsed=parseResearchDataset(content);
      let hash: string | null = null;
      if (typeof crypto !== "undefined" && crypto.subtle) {
        const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(content));
        hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,"0")).join("");
      }
      setDataset(parsed);
      setChecksum(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research import failed.");
    } finally { setBusy(false); }
  }
  const meta=dataset?.metadata;
  const diagnostics=dataset ? summarizeResearchDataset(dataset) : null;
  const keys=dataset ? Array.from(new Set(dataset.measurements.flatMap(row=>Object.keys(row)))).sort() : [];
  const issues = meta ? [
    ...(!meta.doi ? ["DOI not declared"] : []),
    ...(!meta.license ? ["License not declared"] : []),
    ...(meta.provenance === "unverified" ? ["Provenance not independently verified"] : []),
    ...(!meta.sourceFileSha256 ? ["Original source file hash not declared"] : []),
  ] : [];
  return (
    <section className="panel research-panel" aria-label="Research Schema v2 importer">
      <h2 className="panel-title">{lang==="ja" ? "Research Schema v2 / 研究データ" : "Research Schema v2 / research data"}</h2>
      <p className="dataset-muted">{lang==="ja"
        ? "実験データの原単位・出所・実験モードを維持して検証します。教育用v1や設備制御には自動接続しません。"
        : "Validate research data while preserving declared native units, provenance and experiment mode. No automatic v1 comparison or equipment control."}</p>
      <div className="dataset-actions">
        <label className="dataset-upload">
          {busy ? (lang==="ja"?"検証中…":"Validating…") : (lang==="ja"?"研究用JSONを選択":"Choose research JSON")}
          <input type="file" accept=".json,application/json" onChange={selectFile} disabled={busy} />
        </label>
        <a href="/examples/research-v2-synthetic.json" download>{lang==="ja"?"合成例をダウンロード":"Synthetic example"}</a>
        {dataset && <button className="dataset-clear" type="button" onClick={()=>{setDataset(null);setChecksum(null);setError(null);}}>
          {lang==="ja"?"読み込みを解除":"Clear"}
        </button>}
      </div>
      <p className="dataset-muted">{lang==="ja"
        ? "JSONのみ・最大1 MiB / 10,000行。XLSXと生CSVの自動変換は未対応。元ファイルは送信・保存しません。"
        : "JSON only; 1 MiB / 10,000 rows. Raw XLSX/CSV needs explicit column mapping. No file upload or persistence."}</p>
      {error && <p role="alert" className="dataset-error">{error}</p>}
      {dataset && meta && <div className="research-summary" aria-live="polite">
        <strong>{meta.title}</strong>
        <p className="dataset-muted">
          {meta.experimentMode} · {meta.provenance} ({lang==="ja"?"申告値":"declared"}) · {dataset.measurements.length} {lang==="ja"?"行":"rows"}
        </p>
        <p className="dataset-muted">{lang==="ja"?"物質":"Material"}: {meta.material} · {lang==="ja"?"溶媒":"Solvent"}: {meta.solvent || (lang==="ja"?"未入力":"unspecified")}</p>
        {meta.doi && <p className="dataset-muted">DOI: {meta.doi}</p>}
        {meta.license && <p className="dataset-muted">License: {meta.license}</p>}
        {meta.sourceUrl && <p className="dataset-muted"><a href={meta.sourceUrl} rel="noopener noreferrer" target="_blank">{lang==="ja"?"申告された出典URL":"Declared source URL"}</a></p>}
        <div className="dataset-scroll">
          <table className="dataset-table">
            <thead><tr><th scope="col">{lang==="ja"?"項目":"Field"}</th><th scope="col">{lang==="ja"?"申告単位":"Declared unit"}</th></tr></thead>
            <tbody>{keys.map(key=><tr key={key}><th scope="row">{key}</th><td>{key==="conditionId"?"—":meta.units[key as keyof typeof meta.units] || "—"}</td></tr>)}</tbody>
          </table>
        </div>
        {diagnostics && <>
          <p className="dataset-muted">
            {lang==="ja" ? "系列数" : "Distinct series"}: {diagnostics.series.length} ·
            {lang==="ja" ? " 変換記録（申告）" : " Declared transformations"}: {diagnostics.transformationCount}
          </p>
          <div className="dataset-scroll">
            <table className="dataset-table">
              <thead><tr>
                <th scope="col">Run</th><th scope="col">Cycle</th><th scope="col">Channel</th>
                <th scope="col">Rows</th><th scope="col">{lang==="ja"?"欠損項目":"Missing"}</th>
              </tr></thead>
              <tbody>{diagnostics.series.map((item,index)=><tr key={index}>
                <td>{item.runId??"—"}</td><td>{item.cycleId??"—"}</td><td>{item.channelId??"—"}</td>
                <td>{item.rows}</td><td>{item.missingFields}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {Object.keys(diagnostics.missingByField).length>0 && <p className="dataset-muted">
            {lang==="ja"?"欠損内訳":"Missing by field"}: {Object.entries(diagnostics.missingByField).map(([key,value])=>`${key}: ${value}`).join(" / ")}
          </p>}
        </>}
        {checksum && <p className="dataset-checksum">Imported JSON SHA-256: <code>{checksum}</code></p>}
        {diagnostics && <p className="dataset-muted">{diagnostics.unverifiedClaims.join(" · ")}</p>}
        {issues.length > 0 && <p className="dataset-error">{lang==="ja"?"未確認事項: ":"Warnings: "}{issues.join(" · ")}</p>}
        <p className="dataset-muted">{lang==="ja"
          ? "注意：この検証は形式・数値・単位宣言の整合性チェックです。原典の正当性や物理モデルの妥当性を証明しません。"
          : "Checks data structure and declared units, not source authenticity or physical model validity."}</p>
      </div>}
    </section>
  );
}
