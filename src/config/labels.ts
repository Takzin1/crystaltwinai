import type { LocalizedText } from "@/lib/types";

/**
 * UI labels (JA / EN).
 *
 * CUSTOMIZATION POINT — all visible strings live here so that display
 * labels can be re-worded for a client, a lecture or another industry
 * without touching components.
 */
export const LABELS = {
  appTitle: { ja: "CrystalTwin-AI", en: "CrystalTwin-AI" },
  appSubtitle: {
    ja: "AI支援プロセス制御を学ぶ教育用デジタルツイン",
    en: "Educational digital twin for AI-assisted process control",
  },
  badgeEducational: { ja: "教育・研究用", en: "Education & research only" },
  controls: { ja: "制御パラメータ", en: "Process controls" },
  scenario: { ja: "シナリオ", en: "Scenario" },
  reset: { ja: "初期値に戻す", en: "Reset to defaults" },
  outputs: { ja: "出力指標", en: "Output indicators" },
  growthRate: { ja: "平均成長速度", en: "Avg growth rate" },
  growthUnit: { ja: "a.u./min", en: "a.u./min" },
  stability: { ja: "安定性スコア", en: "Stability score" },
  quality: { ja: "品質スコア", en: "Quality score" },
  yield: { ja: "最終収量", en: "Final yield" },
  riskLevel: { ja: "リスクレベル", en: "Risk level" },
  riskLow: { ja: "低", en: "Low" },
  riskMedium: { ja: "中", en: "Medium" },
  riskHigh: { ja: "高", en: "High" },
  aiRecommendation: { ja: "AI推薦（ルールベース）", en: "AI recommendation (rule-based)" },
  aiWhy: { ja: "推薦理由", en: "Why" },
  aiDisclaimer: {
    ja: "推薦は説明可能なルールに基づく例示です。最終判断は人間が行います。",
    en: "Recommendations are illustrative, rule-based and explainable. Final decisions rest with humans.",
  },
  chartTitle: { ja: "時系列チャート", en: "Time series" },
  chartGrowth: { ja: "成長速度", en: "Growth rate" },
  chartQuality: { ja: "品質", en: "Quality" },
  chartTemperature: { ja: "温度", en: "Temperature" },
  chartSupersaturation: { ja: "過飽和度 S", en: "Supersaturation S" },
  log: { ja: "シミュレーションログ", en: "Simulation log" },
  digitalTwin: { ja: "結晶ツインビュー", en: "Crystal twin view" },
  supersaturationNow: { ja: "最大過飽和度", en: "Max supersaturation" },
  nucleationEvents: { ja: "核発生バースト", en: "Nucleation bursts" },
  step: { ja: "ステップ", en: "step" },
  footerDisclaimer: {
    ja: "CrystalTwin-AIは教育・研究・PoC用の概念実証デモです。実設備制御・安全判断・医療判断・生産工程の妥当性確認には使用できません。",
    en: "CrystalTwin-AI is a proof-of-concept demo for education, research and PoC. Not for real equipment control, safety-critical, medical or production-validation use.",
  },
} satisfies Record<string, LocalizedText>;

export type LabelKey = keyof typeof LABELS;
