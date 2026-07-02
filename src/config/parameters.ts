import type { ParameterDefinition, SimulationInput } from "@/lib/types";

/**
 * Input parameter definitions.
 *
 * CUSTOMIZATION POINT — to adapt CrystalTwin-AI to another domain
 * (food processing, pharma, materials, agriculture...), edit labels,
 * units and ranges here. The engine reads ranges from this file, so
 * no engine change is needed for simple re-labelling / re-ranging.
 */
export const PARAMETERS: ParameterDefinition[] = [
  {
    id: "temperature",
    label: { ja: "初期温度", en: "Initial temperature" },
    unit: "°C",
    min: 20,
    max: 90,
    step: 1,
    defaultValue: 62,
    description: {
      ja: "溶液の初期温度。溶解度を通じて過飽和度に影響します。",
      en: "Starting solution temperature. Affects supersaturation via solubility.",
    },
  },
  {
    id: "concentration",
    label: { ja: "溶質濃度", en: "Solute concentration" },
    unit: "g/mL",
    min: 0.1,
    max: 0.6,
    step: 0.01,
    defaultValue: 0.42,
    description: {
      ja: "溶質の初期濃度。飽和濃度を超えると結晶成長が始まります。",
      en: "Initial solute concentration. Growth starts above saturation.",
    },
  },
  {
    id: "stirringSpeed",
    label: { ja: "撹拌速度", en: "Stirring speed" },
    unit: "rpm",
    min: 0,
    max: 1000,
    step: 10,
    defaultValue: 420,
    description: {
      ja: "撹拌による物質移動促進。速すぎると結晶破砕のリスク。",
      en: "Mass transfer improves with stirring; excess causes attrition.",
    },
  },
  {
    id: "coolingRate",
    label: { ja: "冷却速度", en: "Cooling rate" },
    unit: "°C/min",
    min: 0.05,
    max: 2.0,
    step: 0.05,
    defaultValue: 0.5,
    description: {
      ja: "1分あたりの降温量。急冷は核発生バーストを誘発します。",
      en: "Temperature drop per minute. Fast cooling triggers nucleation bursts.",
    },
  },
  {
    id: "impurityLevel",
    label: { ja: "不純物濃度", en: "Impurity level" },
    unit: "%",
    min: 0,
    max: 5,
    step: 0.1,
    defaultValue: 0.8,
    description: {
      ja: "原料中の不純物割合。成長阻害と品質低下の要因です。",
      en: "Impurity fraction in feed. Inhibits growth and lowers quality.",
    },
  },
  {
    id: "timeSteps",
    label: { ja: "時間ステップ数", en: "Time steps" },
    unit: "steps",
    min: 10,
    max: 200,
    step: 5,
    defaultValue: 90,
    description: {
      ja: "シミュレーションの長さ（1ステップ = 仮想1分）。",
      en: "Simulation length (1 step = 1 virtual minute).",
    },
  },
];

export const DEFAULT_INPUT: SimulationInput = PARAMETERS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p.defaultValue }),
  {} as SimulationInput
);

export function getParameter(id: string): ParameterDefinition {
  const def = PARAMETERS.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown parameter: ${id}`);
  return def;
}
