import type { LocalizedText, SimulationInput, SummaryMetrics } from "@/lib/types";

/**
 * Rule-based AI recommendation configuration.
 *
 * CUSTOMIZATION POINT — the "AI" of the initial release is a fully
 * transparent rule table. Each rule pairs an actionable message with
 * the *reason* the rule fired (explainable-by-construction, following
 * human-centred XAI guidance for process industries). Replace this
 * table — or the whole recommend.ts module — with an ML model, an MPC
 * layer or an external API without touching the UI.
 */
export interface RecommendationRule {
  id: string;
  priority: number; // lower = shown first
  condition: (s: SummaryMetrics, input: SimulationInput) => boolean;
  message: LocalizedText;
  reason: LocalizedText;
}

export const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    id: "no-growth",
    priority: 1,
    condition: (s) => s.finalYield < 1,
    message: {
      ja: "濃度を上げるか初期温度を下げ、過飽和状態（S > 1）を作ってください。",
      en: "Raise concentration or lower the initial temperature to reach supersaturation (S > 1).",
    },
    reason: {
      ja: "全期間で過飽和度が1未満のため、結晶成長が開始しませんでした。",
      en: "Supersaturation stayed below 1 for the whole run, so growth never started.",
    },
  },
  {
    id: "reduce-cooling",
    priority: 2,
    condition: (s, i) => s.nucleationEvents >= 1 && i.coolingRate > 0.6,
    message: {
      ja: "冷却速度を0.3〜0.6 °C/minに下げ、緩やかな降温プロファイルにしてください。",
      en: "Reduce the cooling rate to 0.3–0.6 °C/min for a gentler temperature profile.",
    },
    reason: {
      ja: "急冷により過飽和度が核発生閾値を超え、バーストが発生しています。",
      en: "Fast cooling pushed supersaturation past the nucleation threshold, causing bursts.",
    },
  },
  {
    id: "slow-growth-for-quality",
    priority: 3,
    condition: (s) => s.avgGrowthRate > 30 && s.qualityScore < 70,
    message: {
      ja: "濃度をわずかに下げて成長速度を抑え、品質を優先してください。",
      en: "Slightly lower the concentration to slow growth and prioritise quality.",
    },
    reason: {
      ja: "成長速度が最適域を超え、欠陥取り込みによる品質低下が推定されます。",
      en: "Growth exceeded the optimal window; defect incorporation is degrading quality.",
    },
  },
  {
    id: "increase-stirring",
    priority: 4,
    condition: (s, i) => i.stirringSpeed < 150 && s.finalYield >= 1,
    message: {
      ja: "撹拌速度を300〜500 rpm程度まで上げ、物質移動を改善してください。",
      en: "Increase stirring to around 300–500 rpm to improve mass transfer.",
    },
    reason: {
      ja: "撹拌不足により濃度ムラが生じ、成長効率と安定性が低下しています。",
      en: "Insufficient stirring causes concentration gradients, hurting growth and stability.",
    },
  },
  {
    id: "decrease-stirring",
    priority: 4,
    condition: (_s, i) => i.stirringSpeed > 780,
    message: {
      ja: "撹拌速度を700 rpm以下に下げ、結晶破砕（アトリション）を防いでください。",
      en: "Lower stirring below 700 rpm to prevent crystal attrition.",
    },
    reason: {
      ja: "過剰な撹拌はせん断による結晶破砕と微結晶発生の原因になります。",
      en: "Excessive stirring causes shear-induced breakage and fines generation.",
    },
  },
  {
    id: "purify-feed",
    priority: 5,
    condition: (s, i) => i.impurityLevel > 2.5 && s.finalYield >= 1,
    message: {
      ja: "原料の精製工程を追加し、不純物濃度を1%未満に抑えてください。",
      en: "Add a feed purification step to keep impurities below 1%.",
    },
    reason: {
      ja: "不純物が成長阻害と結晶格子への取り込みを引き起こし、品質を下げています。",
      en: "Impurities inhibit growth and are incorporated into the lattice, lowering quality.",
    },
  },
  {
    id: "extend-run",
    priority: 6,
    condition: (s, i) => s.finalYield > 1 && s.finalYield < 25 && i.timeSteps < 180 && s.stabilityScore >= 65,
    message: {
      ja: "条件は安定しています。時間ステップ数を増やし、収量を確保してください。",
      en: "Conditions are stable — extend the run time to build up yield.",
    },
    reason: {
      ja: "安定成長中ですが、運転時間が短く収量が伸びていません。",
      en: "Growth is stable but the run is too short for meaningful yield.",
    },
  },
  {
    id: "steady-state",
    priority: 9,
    condition: (s) => s.stabilityScore >= 75 && s.qualityScore >= 75 && s.finalYield >= 25 && s.nucleationEvents === 0,
    message: {
      ja: "現在の条件を維持してください。微調整するなら冷却速度を±0.1 °C/minの範囲で。",
      en: "Maintain the current conditions. If tuning, keep cooling changes within ±0.1 °C/min.",
    },
    reason: {
      ja: "安定性・品質・収量がすべて目標域に入っており、良好な運転点です。",
      en: "Stability, quality and yield are all inside the target window — a good operating point.",
    },
  },
];

/** Shown when no rule fires (should be rare). */
export const FALLBACK_RECOMMENDATION = {
  id: "observe",
  priority: 10,
  message: {
    ja: "現在の条件で経過を観察し、各指標の推移を記録してください。",
    en: "Observe the process under current conditions and record how each indicator evolves.",
  },
  reason: {
    ja: "特定の改善ルールに該当する状態ではありません。",
    en: "No specific improvement rule matched the current state.",
  },
};

/** Maximum number of recommendations to display. */
export const MAX_RECOMMENDATIONS = 3;
