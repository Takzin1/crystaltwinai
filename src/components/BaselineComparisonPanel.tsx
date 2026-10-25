"use client";

import type { LanguageCode, SimulationInput, SimulationResult } from "../lib/types";
import { COMPARISON_METRICS, compareEducationalRuns } from "../lib/scenario-comparison";

const LABELS = {
  finalYield: { ja: "最終収量", en: "Final yield" },
  qualityScore: { ja: "品質スコア", en: "Quality score" },
  stabilityScore: { ja: "安定性スコア", en: "Stability score" },
  avgGrowthRate: { ja: "平均成長速度", en: "Average growth" },
};

interface Props {
  lang: LanguageCode;
  baseline: SimulationResult | null;
  current: SimulationResult;
  onCapture: () => void;
  onClear: () => void;
  onRestore: (input: SimulationInput) => void;
}

/** In-memory educational comparison; no experimental model validation. */
export default function BaselineComparisonPanel({
  lang, baseline, current, onCapture, onClear, onRestore,
}: Props) {
  const t = (ja: string, en: string) => lang === "ja" ? ja : en;
  const data = baseline ? compareEducationalRuns(baseline, current) : null;
  return (
    <section className="panel baseline-panel" aria-labelledby="baseline-title">
      <h2 className="panel-title" id="baseline-title">
        {t("Before / After · 教育用シナリオ比較", "Before / After · Educational comparison")}
      </h2>
      <p className="dataset-muted">{t(
        "現状を基準として保存すると、スライダー調整前後の変化を比較できます。保存先はこのタブのメモリのみです。",
        "Capture the current run as baseline, then adjust sliders to compare. Baseline stays in browser memory only.",
      )}</p>
      <div className="dataset-actions">
        <button type="button" className="dataset-clear" onClick={onCapture}>
          {baseline ? t("基準を更新", "Update baseline") : t("現在の結果を基準として保存", "Capture current baseline")}
        </button>
        {baseline && <>
          <button type="button" className="dataset-clear" onClick={() => onRestore({ ...baseline.input })}>
            {t("基準の入力値に戻す", "Restore baseline inputs")}
          </button>
          <button type="button" className="dataset-clear" onClick={onClear}>
            {t("比較を終了", "Clear baseline")}
          </button>
        </>}
      </div>
      {data && <>
        <p className="dataset-muted" role="status">
          {data.changedParameters.length === 0
            ? t("基準と入力値が同じです。パラメータを変更してください。", "Inputs match the baseline. Adjust a parameter to compare.")
            : t("変更した入力項目: ", "Changed inputs: ") + data.changedParameters.join(", ")}
        </p>
        <div className="baseline-metrics">
          {data.metrics.map(item => (
            <div className="baseline-metric" key={item.key}>
              <span>{LABELS[item.key][lang]}</span>
              <strong>{item.after.toFixed(item.key === "avgGrowthRate" ? 2 : 1)}</strong>
              <small>{t("基準", "Baseline")} {item.before.toFixed(item.key === "avgGrowthRate" ? 2 : 1)}
                {" · Δ "}{item.delta >= 0 ? "+" : ""}{item.delta.toFixed(2)}</small>
            </div>
          ))}
        </div>
        <p className="dataset-muted">
          {t("差分は単純なシミュレーション結果の変化であり、最適化、統計的有意性、現実の安全性を示しません。",
            "These are deterministic simulated deltas, not optimization, statistical significance or process-safety evidence.")}
        </p>
      </>}
    </section>
  );
}
