import { SCORING_CONFIG as C } from "@/config/scoring.config";
import { assessRisk } from "@/lib/risk";
import { recommend } from "@/lib/recommend";
import {
  growthRate,
  qualityAt,
  stabilityAt,
  supersaturation,
  weightedAverage,
} from "@/lib/scoring";
import type {
  LogEvent,
  SimulationInput,
  SimulationResult,
  StepState,
  SummaryMetrics,
} from "@/lib/types";

/**
 * Simulation engine.
 *
 * A deterministic, pedagogical time-stepping loop over the virtual
 * crystallization process. It intentionally uses a simplified model
 * (linear solubility, power-law growth, threshold nucleation) so that
 * cause and effect stay legible for learners. Not a validated model —
 * see docs/safety_and_scope.md.
 */
export function runSimulation(input: SimulationInput): SimulationResult {
  const series: StepState[] = [];
  const log: LogEvent[] = [];

  let temperature = input.temperature;
  let concentration = input.concentration;
  let crystalYield = 0;
  let nucleationEvents = 0;
  let maxSupersaturation = 0;
  let growthStarted = false;
  let growthStopped = false;

  log.push({
    step: 0,
    level: "info",
    message: {
      ja: `シミュレーション開始：T=${temperature.toFixed(0)}°C, C=${concentration.toFixed(2)} g/mL`,
      en: `Simulation started: T=${temperature.toFixed(0)}°C, C=${concentration.toFixed(2)} g/mL`,
    },
  });

  const steps = Math.max(1, Math.round(input.timeSteps));

  for (let step = 1; step <= steps; step++) {
    // Cooling profile.
    temperature = Math.max(C.minTemperature, temperature - input.coolingRate * C.dtMinutes);

    let s = supersaturation(concentration, temperature);

    // Nucleation burst: crossing the metastable limit collapses the
    // excess supersaturation into fines in one discrete event.
    if (s > C.nucleationThreshold) {
      nucleationEvents += 1;
      const sAfter = C.nucleationThreshold * (1 - C.nucleationConsumption * 0.2);
      concentration = sAfter * (concentration / s);
      const sBefore = s;
      s = supersaturation(concentration, temperature);
      if (nucleationEvents <= 5) {
        log.push({
          step,
          level: "warn",
          message: {
            ja: `核発生バースト #${nucleationEvents}（S=${sBefore.toFixed(2)} → ${s.toFixed(2)}）。微結晶が大量発生しました。`,
            en: `Nucleation burst #${nucleationEvents} (S=${sBefore.toFixed(2)} → ${s.toFixed(2)}). Fines generated.`,
          },
        });
      } else if (nucleationEvents === 6) {
        log.push({
          step,
          level: "warn",
          message: {
            ja: "核発生バーストが継続しています（以降のバーストは省略）。",
            en: "Nucleation bursts continuing (further bursts omitted from log).",
          },
        });
      }
    }

    maxSupersaturation = Math.max(maxSupersaturation, s);

    const g = growthRate(s, input.stirringSpeed, input.impurityLevel);

    if (g > 0 && !growthStarted) {
      growthStarted = true;
      log.push({
        step,
        level: "info",
        message: {
          ja: `過飽和域に到達（S=${s.toFixed(2)}）。結晶成長を開始しました。`,
          en: `Supersaturation reached (S=${s.toFixed(2)}). Crystal growth started.`,
        },
      });
    }
    if (g === 0 && growthStarted && !growthStopped) {
      growthStopped = true;
      log.push({
        step,
        level: "info",
        message: {
          ja: "溶質枯渇により成長が停止しました（S ≤ 1）。",
          en: "Growth stopped — solute depleted (S ≤ 1).",
        },
      });
    }

    // Mass balance: growth consumes solute and accumulates yield.
    concentration = Math.max(0, concentration - g * C.depletionFactor * C.dtMinutes);
    crystalYield = Math.min(100, crystalYield + g * C.yieldFactor * C.dtMinutes);

    const stability = stabilityAt(s, input);
    const quality = qualityAt(g, stability, input, nucleationEvents);

    series.push({
      step,
      temperature,
      concentration,
      supersaturation: s,
      growthRate: g,
      crystalYield,
      stability,
      quality,
    });
  }

  const growthValues = series.map((p) => p.growthRate);
  const metrics: SummaryMetrics = {
    avgGrowthRate: growthValues.reduce((a, b) => a + b, 0) / series.length,
    maxSupersaturation,
    nucleationEvents,
    finalYield: crystalYield,
    stabilityScore: weightedAverage(series.map((p) => p.stability)),
    qualityScore: weightedAverage(series.map((p) => p.quality)),
  };

  const risk = assessRisk(metrics);
  const recommendations = recommend(metrics, input);

  if (risk.level === "high") {
    log.push({
      step: steps,
      level: "alert",
      message: {
        ja: "リスクレベル「高」で終了。推薦パネルの改善案を確認してください。",
        en: "Run ended at HIGH risk. Review the recommendation panel.",
      },
    });
  } else {
    log.push({
      step: steps,
      level: "info",
      message: {
        ja: `シミュレーション終了：収量 ${crystalYield.toFixed(1)}、品質 ${metrics.qualityScore.toFixed(0)}。`,
        en: `Run complete: yield ${crystalYield.toFixed(1)}, quality ${metrics.qualityScore.toFixed(0)}.`,
      },
    });
  }

  return {
    input,
    series,
    log,
    summary: { ...metrics, risk, recommendations },
  };
}
