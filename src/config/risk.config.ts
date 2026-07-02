import type { LocalizedText, RiskLevel, SummaryMetrics } from "@/lib/types";

/**
 * Risk assessment configuration.
 *
 * CUSTOMIZATION POINT — each rule maps a condition on the simulation
 * summary to a risk level plus a human-readable reason (JA/EN).
 * Rules are evaluated top-down; the highest triggered level wins and
 * all triggered reasons of that level are shown to the user.
 */
export interface RiskRule {
  id: string;
  level: Exclude<RiskLevel, "low">;
  condition: (s: SummaryMetrics) => boolean;
  reason: LocalizedText;
}

export const RISK_RULES: RiskRule[] = [
  {
    id: "very-low-stability",
    level: "high",
    condition: (s) => s.stabilityScore < 40,
    reason: {
      ja: "安定性スコアが40未満。プロセスが制御不能領域にあります。",
      en: "Stability score below 40 — the process is in an uncontrolled regime.",
    },
  },
  {
    id: "nucleation-storm",
    level: "high",
    condition: (s) => s.nucleationEvents >= 3,
    reason: {
      ja: "核発生バーストが3回以上発生。粒径分布が制御できません。",
      en: "Three or more nucleation bursts — particle size distribution is uncontrolled.",
    },
  },
  {
    id: "extreme-supersaturation",
    level: "high",
    condition: (s) => s.maxSupersaturation > 1.6,
    reason: {
      ja: "過飽和度が1.6を超過。急激な析出のリスクが高い状態です。",
      en: "Supersaturation exceeded 1.6 — high risk of sudden precipitation.",
    },
  },
  {
    id: "moderate-stability",
    level: "medium",
    condition: (s) => s.stabilityScore < 65,
    reason: {
      ja: "安定性スコアが65未満。運転条件の見直しを推奨します。",
      en: "Stability score below 65 — operating conditions should be reviewed.",
    },
  },
  {
    id: "some-nucleation",
    level: "medium",
    condition: (s) => s.nucleationEvents >= 1,
    reason: {
      ja: "核発生バーストが発生しています。冷却速度・濃度の再検討を。",
      en: "Nucleation bursts occurred — reconsider cooling rate and concentration.",
    },
  },
  {
    id: "low-quality",
    level: "medium",
    condition: (s) => s.qualityScore < 55 && s.finalYield > 5,
    reason: {
      ja: "品質スコアが55未満。欠陥・不純物取り込みが疑われます。",
      en: "Quality score below 55 — defect formation or impurity inclusion is likely.",
    },
  },
];

export const LOW_RISK_REASON: LocalizedText = {
  ja: "主要指標はすべて安全な運転範囲内です。",
  en: "All key indicators are within the safe operating envelope.",
};
