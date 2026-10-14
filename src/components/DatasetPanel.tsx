"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import type { DataField, ExperimentalDataset } from "../lib/datasets";
import { compareDataset, MAX_DATASET_BYTES, parseDataset } from "../lib/datasets";
import type { LanguageCode, StepState } from "../lib/types";

const FIELD_LABELS: Record<DataField, { ja: string; en: string }> = {
  temperature: { ja: "温度 (°C)", en: "Temperature (°C)" },
  concentration: { ja: "濃度 (g/mL)", en: "Concentration (g/mL)" },
  growthRate: { ja: "成長速度 (a.u.)", en: "Growth rate (a.u.)" },
  crystalYield: { ja: "収量 (a.u.)", en: "Yield (a.u.)" },
  quality: { ja: "品質 (0–100)", en: "Quality (0–100)" },
};

type LoadedData = { dataset: ExperimentalDataset; sha256: string | null };
interface Props { lang: LanguageCode; simulated: StepState[] }

function TemperatureComparison({ lang, dataset, simulated }: Props & { dataset: ExperimentalDataset }) {
  const width = 620, height = 165, left = 12, right = 12, top = 10, bottom = 26;
  const maxStep = Math.max(1, simulated.length, ...dataset.rows.map((row) => row.step));
  const values = [...simulated.map((row) => row.temperature), ...dataset.rows.map((row) => row.temperature)];
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const point = (step: number, value: number) => {
    const x = left + (step / maxStep) * (width - left - right);
    const y = top + (1 - (value - lo) / span) * (height - top - bottom);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  return (
    <div className="dataset-chart">
      <p className="dataset-muted">
        {lang === "ja" ? "温度の比較：同じ単位・同じ時間軸（青＝モデル、橙＝取り込み値）" : "Temperature, common axes (blue = model, orange = imported)"}
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={lang === "ja" ? "モデルと観測温度の比較" : "Simulated vs observed temperature"}>
        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="var(--line-strong)" />
        <polyline points={simulated.map((row) => point(row.step, row.temperature)).join(" ")} fill="none" stroke="var(--cyan)" strokeWidth="2" />
        <polyline points={dataset.rows.map((row) => point(row.step, row.temperature)).join(" ")} fill="none" stroke="var(--amber)" strokeWidth="2" strokeDasharray="5 3" />
        <text x={left} y={height - 6} fontSize="11" fill="var(--text-dim)">0</text>
        <text x={width - right} y={height - 6} textAnchor="end" fontSize="11" fill="var(--text-dim)">step {maxStep}</text>
        <text x={left + 2} y={top + 11} fontSize="11" fill="var(--text-dim)">{hi.toFixed(1)} °C</text>
        <text x={left + 2} y={height - bottom - 5} fontSize="11" fill="var(--text-dim)">{lo.toFixed(1)} °C</text>
      </svg>
    </div>
  );
}

export default function DatasetPanel({ lang, simulated }: Props) {
  const [loaded, setLoaded] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const comparison = useMemo(
    () => loaded ? compareDataset(loaded.dataset, simulated) : null,
    [loaded, simulated]
  );

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setError(null);
    setLoaded(null);
    setBusy(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension !== "csv" && extension !== "json") {
        throw new Error("Only .csv or .json files are accepted.");
      }
      if (file.size > MAX_DATASET_BYTES) throw new Error("File exceeds the 512 KiB import limit.");
      const content = await file.text();
      const dataset = parseDataset(content, extension, file.name);
      let sha256: string | null = null;
      if (typeof crypto !== "undefined" && crypto.subtle) {
        try {
          const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
          sha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
        } catch {
          // Digest is provenance metadata, not required for import.
        }
      }
      setLoaded({ dataset, sha256 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel dataset-panel" aria-label="Experimental dataset">
      <h2 className="panel-title">{lang === "ja" ? "実験データ / DATASET" : "Experimental dataset / DATASET"}</h2>
      <p className="dataset-muted">
        {lang === "ja"
          ? "CSV / JSON をブラウザ内で検証し、仮想シミュレーションと比較します。送信・保存・モデル更新・設備制御は行いません。"
          : "Validate CSV / JSON in your browser and compare with the simulation. Nothing is uploaded, saved, used for model training or sent to equipment."}
      </p>
      <div className="dataset-actions">
        <label className="dataset-upload">
          {busy ? (lang === "ja" ? "検証中…" : "Validating…") : (lang === "ja" ? "CSV / JSONを選択" : "Choose CSV / JSON")}
          <input type="file" accept=".csv,.json,text/csv,application/json" onChange={onFileChange} disabled={busy} />
        </label>
        <a href="/examples/synthetic_crystallization.csv" download>{lang === "ja" ? "サンプルCSV" : "Sample CSV"}</a>
        {loaded && <button className="dataset-clear" type="button" onClick={() => { setLoaded(null); setError(null); }}>
          {lang === "ja" ? "データを削除" : "Clear data"}
        </button>}
      </div>
      <p className="dataset-muted">
        {lang === "ja"
          ? "必須: step, temperature, concentration / 任意: growthRate, crystalYield, quality / 最大200行・512 KiB"
          : "Required: step, temperature, concentration / Optional: growthRate, crystalYield, quality / Max 200 rows, 512 KiB"}
      </p>
      {error && <p className="dataset-error" role="alert">{lang === "ja" ? "検証エラー: " : "Validation error: "}{error}</p>}
      {loaded && comparison && (
        <div aria-live="polite">
          <div className="dataset-details">
            <strong>{loaded.dataset.name}</strong>
            <span>{loaded.dataset.rows.length} rows · schema v{loaded.dataset.schemaVersion}</span>
            <span>{comparison.matchedRows} matched · {comparison.unmatchedRows} unmatched</span>
          </div>
          {loaded.sha256 && <p className="dataset-checksum">SHA-256: <code>{loaded.sha256}</code></p>}
          {comparison.matchedRows > 0 ? (
            <>
              <TemperatureComparison lang={lang} dataset={loaded.dataset} simulated={simulated} />
              <div className="dataset-scroll">
                <table className="dataset-table">
                  <thead><tr>
                    <th scope="col">{lang === "ja" ? "指標" : "Field"}</th>
                    <th scope="col">N</th>
                    <th scope="col">MAE</th>
                    <th scope="col">RMSE</th>
                    <th scope="col">{lang === "ja" ? "偏り" : "Bias"}</th>
                  </tr></thead>
                  <tbody>{comparison.fields.map((m) => <tr key={m.field}>
                    <th scope="row">{FIELD_LABELS[m.field][lang]}</th>
                    <td>{m.count}</td><td>{m.mae.toFixed(4)}</td>
                    <td>{m.rmse.toFixed(4)}</td><td>{m.bias.toFixed(4)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
              <p className="dataset-muted">{lang === "ja"
                ? "誤差 = 観測値 − モデル値。未一致ステップは評価対象外。結果は物理モデルの妥当性を証明しません。"
                : "Error = observation minus model. Unmatched steps are excluded. These metrics do not validate the physical model."}</p>
            </>
          ) : <p className="dataset-error" role="status">{lang === "ja" ? "一致するステップがありません。シミュレーション時間を確認してください。" : "No matching steps. Check the simulation duration."}</p>}
        </div>
      )}
    </section>
  );
}
