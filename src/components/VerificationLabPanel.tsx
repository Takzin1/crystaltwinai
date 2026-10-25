"use client";

import { useMemo, useState } from "react";
import type { LanguageCode, SimulationResult } from "../lib/types";
import { compareAlternativeModel, runInputSensitivity } from "../lib/verification-models";

/** Client-local educational discrepancy and sensitivity dashboard. */
export default function VerificationLabPanel({
  lang, result,
}: { lang: LanguageCode; result: SimulationResult }) {
  const [variation, setVariation] = useState(0.05);
  const alternative = useMemo(() => compareAlternativeModel(result), [result]);
  const sensitivity = useMemo(
    () => runInputSensitivity(result, variation), [result, variation],
  );
  const t = (ja: string, en: string) => lang === "ja" ? ja : en;
  const labels: Record<string, { ja: string; en: string }> = {
    temperature: { ja: "温度 (°C)", en: "Temperature (°C)" },
    concentration: { ja: "溶質濃度 (g/mL)", en: "Concentration (g/mL)" },
    finalYield: { ja: "最終収量", en: "Final yield" },
    qualityScore: { ja: "品質スコア", en: "Quality score" },
    stabilityScore: { ja: "安定性スコア", en: "Stability score" },
  };
  return (
    <section className="panel verification-panel" aria-labelledby="verification-lab-title">
      <h2 className="panel-title" id="verification-lab-title">
        {t("検証ラボ / QUANTITATIVE CHECKS", "Verification lab / QUANTITATIVE CHECKS")}
      </h2>
      <p className="dataset-muted">
        {t("既存モデルと異なる計算方法の差を数値化し、入力誤差を仮定した感度の範囲を表示します。両方とも仮想モデルによる内部検証です。",
          "Quantify differences with a separate model and examine bounded input sensitivity. Both are synthetic software checks, not experimental validation.")}
      </p>
      <div className="verification-subsection">
        <h3>{t("A / 異種モデル差分", "A / Alternative model discrepancy")}</h3>
        <p className="dataset-muted">{t(
          "モデルA＝核発生・過飽和度ベースの主エンジン。モデルB＝別実装の一次緩和モデル（核発生なし）。共通の温度と濃度だけ比較。",
          "Model A uses supersaturation growth and nucleation. Model B uses independently implemented first-order solute relaxation without nucleation. Only comparable temperature and concentration are compared.",
        )}</p>
        <div className="dataset-scroll">
          <table className="dataset-table">
            <thead><tr><th scope="col">{t("変数", "Field")}</th><th scope="col">N</th><th scope="col">MAE</th><th scope="col">RMSE</th><th scope="col">{t("バイアス", "Bias")}</th><th scope="col">Max |Δ|</th></tr></thead>
            <tbody>{alternative.fields.map(row => <tr key={row.field}>
              <th scope="row">{labels[row.field][lang]}</th>
              <td>{row.n}</td>
              <td>{row.mae.toFixed(4)}</td>
              <td>{row.rmse.toFixed(4)}</td>
              <td>{row.bias.toFixed(4)}</td>
              <td>{row.maxAbs.toFixed(4)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="dataset-muted">{t(
          "符号：別モデル − 主モデル。温度差は実装一致の確認、濃度差は動力学の仮定の違いを可視化。別モデルの優劣や現実の精度を示しません。",
          "Sign: alternative minus primary. Temperature checks implementation consistency; concentration shows differing kinetic assumptions, not physical accuracy or superiority.",
        )}</p>
      </div>
      <div className="verification-subsection">
        <div className="verification-subhead">
          <h3>{t("B / 入力変動に対する感度", "B / Input-variation sensitivity")}</h3>
          <label>{t("変動の大きさ", "Input variation")}
            <select value={variation} onChange={event => setVariation(Number(event.target.value))}>
              <option value="0.01">±1% {t("（各入力の許容幅）", "(input range)")}</option>
              <option value="0.03">±3% {t("（各入力の許容幅）", "(input range)")}</option>
              <option value="0.05">±5% {t("（各入力の許容幅）", "(input range)")}</option>
              <option value="0.10">±10% {t("（各入力の許容幅）", "(input range)")}</option>
            </select>
          </label>
        </div>
        <p className="dataset-muted">{t(
          "乱数固定・128回の合成計算。入力パラメータを指定幅の一様分布で変化させ、5〜95パーセンタイルを表示。時間ステップは固定。",
          "128 fixed-seed synthetic runs. Inputs vary uniformly within the stated fraction of their allowed parameter ranges; P5–P95 is shown. Step count stays fixed.",
        )}</p>
        <div className="verification-bands">
          {sensitivity.bands.map(item => <div className="verification-band" key={item.metric}>
            <p>{labels[item.metric][lang]}</p>
            <strong>{item.p05.toFixed(2)} – {item.p95.toFixed(2)}</strong>
            <span>{t("P5〜P95", "P5–P95")} · {t("基準値", "Baseline")} {item.baseline.toFixed(2)}</span>
            <small>{t("計算上の最小〜最大", "Sample min–max")}: {item.minimum.toFixed(2)}–{item.maximum.toFixed(2)}</small>
          </div>)}
        </div>
        <p className="verification-caution">
          {t("これは入力仮定に依存する感度分析で、測定不確実性・予測区間・95%信頼区間・物理的妥当性の保証ではありません。係数の校正や実験再現は未実施です。",
            "These are sensitivity percentiles under assumed input bounds—not measurement uncertainty, 95% confidence, prediction coverage or physical validation. No calibration or experimental replication was performed.")}
        </p>
      </div>
    </section>
  );
}
