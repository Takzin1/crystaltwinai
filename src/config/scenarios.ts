import type { LocalizedText, SimulationInput } from "@/lib/types";
import { DEFAULT_INPUT } from "@/config/parameters";

/**
 * Scenario presets.
 *
 * CUSTOMIZATION POINT — presets demonstrate how the same engine can be
 * re-framed for different industries or teaching goals. Each preset is
 * illustrative only; none reproduces a real industrial process.
 * Add your own presets here for workshops, lectures or PoC demos.
 */
export interface Scenario {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  input: SimulationInput;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "edu-default",
    name: { ja: "教育用ベース（無機塩）", en: "Education base (inorganic salt)" },
    description: {
      ja: "バランスの取れた出発点。各パラメータの影響を1つずつ試すのに最適。",
      en: "A balanced starting point — ideal for exploring one parameter at a time.",
    },
    input: { ...DEFAULT_INPUT },
  },
  {
    id: "pharma",
    name: { ja: "医薬品原薬（品質優先）", en: "Pharma API (quality-first)" },
    description: {
      ja: "低速成長・低不純物で品質を最優先する架空シナリオ。",
      en: "A fictional quality-first scenario: slow growth and low impurities.",
    },
    input: {
      ...DEFAULT_INPUT,
      temperature: 55,
      concentration: 0.37,
      coolingRate: 0.3,
      stirringSpeed: 350,
      impurityLevel: 0.3,
      timeSteps: 150,
    },
  },
  {
    id: "food",
    name: { ja: "食品（収量優先）", en: "Food process (yield-first)" },
    description: {
      ja: "多少の品質低下を許容し収量を追う架空シナリオ。トレードオフ教材向け。",
      en: "A fictional yield-first scenario that tolerates some quality loss — good for teaching trade-offs.",
    },
    input: {
      ...DEFAULT_INPUT,
      temperature: 75,
      concentration: 0.52,
      coolingRate: 0.9,
      stirringSpeed: 550,
      impurityLevel: 1.6,
      timeSteps: 110,
    },
  },
  {
    id: "unstable",
    name: { ja: "不安定運転（失敗例）", en: "Unstable run (failure case)" },
    description: {
      ja: "急冷×高濃度で核発生バーストを再現。リスク表示と推薦の挙動を確認できます。",
      en: "Fast cooling × high concentration reproduces nucleation bursts — shows risk and recommendation behaviour.",
    },
    input: {
      ...DEFAULT_INPUT,
      temperature: 80,
      concentration: 0.55,
      coolingRate: 1.8,
      stirringSpeed: 900,
      impurityLevel: 3.5,
      timeSteps: 80,
    },
  },
];
