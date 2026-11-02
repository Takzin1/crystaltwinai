"use client";

import { useState, type ChangeEvent } from "react";
import { MAX_RESEARCH_BYTES, parseResearchDataset, type ResearchDataset } from "../lib/research-schema";
import { summarizeResearchDataset } from "../lib/research-integrity";
import {
  assessSourceBytes, makeResearchEvidenceManifest, MAX_SOURCE_EVIDENCE_BYTES,
  type LocalSourceFile,
} from "../lib/research-evidence";
import type { LanguageCode } from "../lib/types";

export default function ResearchDatasetPanel({ lang }: { lang: LanguageCode }) {
  const [dataset,setDataset] = useState<ResearchDataset | null>(null);
  const [checksum,setChecksum] = useState<string | null>(null);
  const [error,setError] = useState<string | null>(null);
  const [busy,setBusy] = useState(false);
  const [originalFile, setOriginalFile] = useState<LocalSourceFile | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  async function sha256Bytes(bytes: ArrayBuffer): Promise<string> {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      throw new Error("SHA-256 requires a secure browser context (HTTPS or localhost).");
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2,"0")).join("");
  }

  async function selectOriginalFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !dataset || !checksum) return;
    setSourceError(null);
    setOriginalFile(null);
    setSourceBusy(true);
    try {
      if (file.size < 1 || file.size > MAX_SOURCE_EVIDENCE_BYTES) {
        throw new Error("Original source must be 1 byte to 32 MiB.");
      }
      const bytes = await file.arrayBuffer();
      const sha256 = await sha256Bytes(bytes);
      const candidate = { name: file.name, byteLength: bytes.byteLength, sha256 };
      assessSourceBytes(dataset.metadata.sourceFileSha256, candidate);
      setOriginalFile(candidate);
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : "Source evidence check failed.");
    } finally {
      setSourceBusy(false);
    }
  }

  function exportEvidence() {
    if (!dataset || !checksum) return;
    try {
      const manifest = makeResearchEvidenceManifest({
        dataset, researchJsonSha256: checksum,
        originalSourceFile: originalFile, generatedAt: new Date().toISOString(),
      });
      const url = URL.createObjectURL(new Blob(
        [JSON.stringify(manifest, null, 2) + "\\n"], {type:"application/json"}
      ));
      const link = document.createElement("a");
      link.href = url;
      link.download = "crystaltwin-research-evidence-v1.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setSourceError(e instanceof Error ? e.message : "Evidence export failed.");
    }
  }
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value="";
    if (!file) return;
    setError(null);
    setDataset(null);
    setChecksum(null);
    setOriginalFile(null);
    setSourceError(null);
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Research v2 currently accepts JSON only.");
      if (file.size > MAX_RESEARCH_BYTES) throw new Error("Research file exceeds 1 MiB.");
      const bytes=await file.arrayBuffer();
      const content=new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed=parseResearchDataset(content);
      const hash=await sha256Bytes(bytes);
      setDataset(parsed);
      setChecksum(hash);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research import failed.");
    } finally { setBusy(false); }
  }
  const meta=dataset?.metadata;
  const sourceEvidence = meta ? assessSourceBytes(meta.sourceFileSha256, originalFile) : null;
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
        {dataset && <button className="dataset-clear" type="button" onClick={()=>{setDataset(null);setChecksum(null);setOriginalFile(null);setSourceError(null);setError(null);}}>
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
        {checksum && <p className="dataset-checksum">Imported JSON (exact bytes) SHA-256: <code>{checksum}</code></p>}
        <div className="research-evidence-intake">
          <h3>{lang === "ja" ? "原本ファイルと証拠マニフェスト" : "Original-source bytes and evidence manifest"}</h3>
          <p className="dataset-muted">{lang === "ja"
            ? "研究JSONとは別に、元の実験ファイル（CSV、NeXusなど任意の形式）を選び、宣言済みSHA-256とバイト単位で照合します。ファイルの内容は解釈しません。"
            : "Select the original scientific file separately from the research JSON. Compare exact bytes against the declared SHA-256; its scientific contents are not interpreted."}</p>
          <div className="dataset-actions">
            <label className="dataset-upload">
              {sourceBusy ? (lang === "ja" ? "原本照合中…" : "Hashing…") :
                (lang === "ja" ? "原本ファイルを照合（最大32 MiB）" : "Check source file (max 32 MiB)")}
              <input type="file" onChange={selectOriginalFile} disabled={sourceBusy || busy} />
            </label>
            {checksum && <button className="dataset-clear" type="button" onClick={exportEvidence} disabled={sourceBusy}>
              {lang === "ja" ? "証拠マニフェストを保存" : "Export evidence manifest"}
            </button>}
            {originalFile && <button type="button" className="dataset-clear"
              onClick={() => { setOriginalFile(null); setSourceError(null); }}>
              {lang === "ja" ? "原本照合を解除" : "Clear source evidence"}
            </button>}
          </div>
          {sourceError && <p role="alert" className="dataset-error">{sourceError}</p>}
          {sourceEvidence && <div className="research-evidence-status" aria-live="polite">
            <strong>{sourceEvidence.status === "matches_declared_digest"
              ? (lang === "ja" ? "照合一致（申告ハッシュとの一致のみ）" : "Matching bytes (declared hash only)")
              : sourceEvidence.status === "digest_mismatch"
                ? (lang === "ja" ? "不一致：原本の同一性を確認できません" : "Mismatch: source is not byte-consistent")
                : sourceEvidence.status === "declared_digest_missing"
                  ? (lang === "ja" ? "申告SHA-256がないため照合保留" : "No declared checksum to compare")
                  : (lang === "ja" ? "原本未選択・未検証" : "No original source selected")}</strong>
            {sourceEvidence.computedSha256 && <p className="dataset-checksum">Original source SHA-256: <code>{sourceEvidence.computedSha256}</code></p>}
            {sourceEvidence.declaredSha256 && <p className="dataset-checksum">Declared source SHA-256: <code>{sourceEvidence.declaredSha256}</code></p>}
          </div>}
          <p className="dataset-muted">{lang === "ja"
            ? "一致しても、原典の真正性・測定結果の妥当性・著作権上の利用許諾・物理モデルの精度は未検証です。マニフェストは原本を含まないローカル監査記録です。"
            : "Matching bytes never authenticate the publisher, measurements, rights or model accuracy. The exported manifest contains no raw source bytes."}</p>
        </div>
        {diagnostics && <p className="dataset-muted">{diagnostics.unverifiedClaims.join(" · ")}</p>}
        {issues.length > 0 && <p className="dataset-error">{lang==="ja"?"未確認事項: ":"Warnings: "}{issues.join(" · ")}</p>}
        <p className="dataset-muted">{lang==="ja"
          ? "注意：この検証は形式・数値・単位宣言の整合性チェックです。原典の正当性や物理モデルの妥当性を証明しません。"
          : "Checks data structure and declared units, not source authenticity or physical model validity."}</p>
      </div>}
    </section>
  );
}
