import {
  FALLBACK_RECOMMENDATION,
  MAX_RECOMMENDATIONS,
  RECOMMENDATION_RULES,
} from "@/config/recommendations.config";
import type { Recommendation, SimulationInput, SummaryMetrics } from "@/lib/types";

/**
 * Rule-based recommendation module ("the AI").
 *
 * Deliberately transparent: every recommendation carries the reason
 * the rule fired. This module is the primary swap point for future
 * upgrades (ML model, MPC layer, external API) — keep the same
 * Recommendation[] return shape and the UI will not need changes.
 */
export function recommend(summary: SummaryMetrics, input: SimulationInput): Recommendation[] {
  const fired = RECOMMENDATION_RULES.filter((r) => r.condition(summary, input))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ id, message, reason, priority }) => ({ id, message, reason, priority }));

  if (fired.length === 0) {
    const { id, message, reason, priority } = FALLBACK_RECOMMENDATION;
    return [{ id, message, reason, priority }];
  }
  return fired;
}
