import { LOW_RISK_REASON, RISK_RULES } from "@/config/risk.config";
import type { RiskAssessment, SummaryMetrics } from "@/lib/types";

/**
 * Risk assessment module.
 *
 * Evaluates the configured rule table against the simulation summary.
 * Swap RISK_RULES (or this module) to implement industry-specific
 * risk logic. The output always carries explainable reasons.
 */
export function assessRisk(summary: SummaryMetrics): RiskAssessment {
  const high = RISK_RULES.filter((r) => r.level === "high" && r.condition(summary));
  if (high.length > 0) {
    return { level: "high", reasons: high.map((r) => r.reason) };
  }
  const medium = RISK_RULES.filter((r) => r.level === "medium" && r.condition(summary));
  if (medium.length > 0) {
    return { level: "medium", reasons: medium.map((r) => r.reason) };
  }
  return { level: "low", reasons: [LOW_RISK_REASON] };
}
