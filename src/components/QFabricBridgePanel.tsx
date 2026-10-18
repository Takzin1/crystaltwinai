"use client";

import { useState, type ChangeEvent } from "react";
import {
  MAX_QFABRIC_REPORT_BYTES,
  buildQFabricSnapshot,
  parseQFabricBridgeReport,
  type QFabricBridgeReport,
} from "../lib/qfabric-bridge";
import type { LanguageCode, SimulationResult } from "../lib/types";

/**
 * Explicit, offline interoperability demo. Browser files stay local and
 * reports are presented as unverified synthetic educational artifacts.
 */
export default function QFabricBridgePanel({
  lang,
  result,
}: {
  lang: LanguageCode;
  result: SimulationResult;
}) {
  const [report, setReport] = useState<QFabricBridgeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function exportSnapshot() {
    try {
      const snapshot = buildQFabricSnapshot(result);
      const contents = JSON.stringify(snapshot, null, 2) + "\n";
      const blob = new Blob([contents], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "crystaltwin-qfabric-snapshot.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Snapshot export failed.");
    }
  }

  async function readReport(file: File) {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("QFabric reports must be JSON.");
      }
      if (file.size > MAX_QFABRIC_REPORT_BYTES) {
        throw new Error("QFabric report exceeds 512 KiB.");
      }
      setReport(parseQFabricBridgeReport(await file.text()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "QFabric report import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function selectReport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) await readReport(file);
  }

  async function loadSyntheticSample() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/examples/qfabric-bridge-report.synthetic.json");
      if (!response.ok) throw new Error("Demo report is unavailable.");
      const text = await response.text();
      setReport(parseQFabricBridgeReport(text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Demo loading failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel research-panel" aria-label="QFabric CUDA research bridge">
      <h2 className="panel-title">QFabric × CrystalTwinAI · NVIDIA Research Bridge</h2>
      <p className="dataset-muted">
        {lang === "ja"
          ? "教育用の結晶化ツイン結果を、QFabricの量子制御計画（実機未実行）と合成IQ解析レポートへ連結します。演算はCPUまたは実際のCUDA環境です。"
          : "Link the educational crystal twin to a QFabric quantum-control plan (never executed) and synthetic IQ report, computed on CPU or an actual CUDA device."}
      </p>
      <div className="dataset-actions">
        <button type="button" className="dataset-clear" onClick={exportSnapshot}>
          {lang === "ja" ? "現在のツインをJSON出力" : "Export current twin JSON"}
        </button>
        <label className="dataset-upload">
          {busy ? (lang === "ja" ? "読み込み中…" : "Loading…")
            : (lang === "ja" ? "QFabricレポートを読み込む" : "Import QFabric report")}
          <input type="file" accept=".json,application/json" disabled={busy} onChange={selectReport} />
        </label>
        <button type="button" className="dataset-clear" onClick={loadSyntheticSample} disabled={busy}>
          {lang === "ja" ? "合成サンプルを表示" : "Load synthetic example"}
        </button>
        {report && (
          <button type="button" className="dataset-clear" onClick={() => setReport(null)}>
            {lang === "ja" ? "クリア" : "Clear"}
          </button>
        )}
      </div>
      <p className="dataset-muted">
        {lang === "ja"
          ? "操作手順: JSONを保存 → QFabric側で scripts/crystaltwin_bridge.py を実行 → 出力レポートを取り込む。サーバー送信・設備制御はありません。"
          : "Workflow: download JSON → run scripts/crystaltwin_bridge.py in QFabric → import report. No upload, quantum hardware access or equipment control."}
      </p>
      <p className="dataset-muted">
        <a href="https://github.com/Takzin1/QFabric/blob/main/docs/integrations/crystaltwin-nvidia.md"
          target="_blank" rel="noreferrer">QFabric design / CLI instructions</a>
      </p>
      {error && <p role="alert" className="dataset-error">{error}</p>}
      {report && (
        <div className="research-summary" aria-live="polite">
          <strong>{lang === "ja" ? "取り込み済み研究レポート" : "Imported research bridge report"}</strong>
          <p className="dataset-muted">CPU/CUDA: <strong>{report.analytics.backend}</strong> ·
            {report.analytics.shots.toLocaleString()} synthetic shots ·
            {report.analytics.elapsedMs.toFixed(3)} ms
          </p>
          <p className="dataset-muted">
            QICK: {report.qfabric.mode} · readout: {report.qfabric.readoutStatus} ·
            executed: {String(report.qfabric.hardwareExecuted)}
          </p>
          <p className="dataset-muted">
            {lang === "ja" ? "結晶化シミュレーション行数" : "Crystallization snapshot rows"}:
            {" "}{report.snapshot.rowCount} ·
            {lang === "ja" ? " 品質スコア" : " quality score"}:
            {" "}{report.snapshot.summary.qualityScore.toFixed(1)}
          </p>
          <p className="dataset-muted">
            Synthetic IQ mean I={report.analytics.meanI.toFixed(6)} ·
            Q={report.analytics.meanQ.toFixed(6)} ·
            power={report.analytics.meanPower.toFixed(6)}
          </p>
          <p className="dataset-checksum">
            {lang === "ja" ? "発行側申告の入力SHA-256" : "Producer-reported input SHA-256"}:
            {" "}<code>{report.source.sha256}</code>
          </p>
          <p className="dataset-muted">
            {lang === "ja"
              ? "この画面はJSON形式を検証したもので、入力SHAの原本照合、実測、NVIDIA GPUの独立検証、物理モデルの妥当性評価ではありません。"
              : "Schema validation does not verify the original input hash, physical measurements, an NVIDIA GPU, or scientific model accuracy."}
          </p>
          <p className="dataset-error">
            {lang === "ja"
              ? "実機未接続・読み出し未実行。合成IQ信号は結晶化プロセスの計測値ではありません。"
              : "No physical readout or quantum hardware. Synthetic IQ is not a crystallization measurement."}
          </p>
        </div>
      )}
    </section>
  );
}
