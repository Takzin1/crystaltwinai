/**
 * Scoring model configuration.
 *
 * CUSTOMIZATION POINT — every coefficient of the simplified
 * crystallization model and of the stability / quality scoring lives
 * here. Replace values (or the whole scoring module) to adapt the
 * simulator to another process. The model is intentionally a
 * *pedagogical* rule-based approximation, not a validated physical
 * model. See docs/safety_and_scope.md.
 */
export const SCORING_CONFIG = {
  /** Virtual minutes represented by one time step. */
  dtMinutes: 1,

  /** Linear solubility model: C_sat(T) = solubilityBase + solubilitySlope * T. */
  solubilityBase: 0.18,
  solubilitySlope: 0.0035,

  /** Growth kinetics: g = kGrowth * (S - 1)^growthOrder * stirFactor * impurityFactor. */
  kGrowth: 46,
  growthOrder: 1.5,

  /** Stirring response: bell curve centred on the optimum. */
  stirringOptimum: 420,
  stirringSpread: 320,
  stirringFloor: 0.35,

  /** Growth inhibition per % impurity. */
  impurityInhibition: 0.12,

  /** Supersaturation above this triggers a nucleation burst. */
  nucleationThreshold: 1.35,
  /** Fraction of excess concentration consumed by one burst. */
  nucleationConsumption: 0.35,

  /** Concentration depletion per unit growth per step. */
  depletionFactor: 0.00045,

  /** Yield accumulation per unit growth per step (scaled to 0–100). */
  yieldFactor: 0.055,

  /** Minimum temperature the virtual cooling jacket can reach. */
  minTemperature: 15,

  /** Stability penalties (all subtract from 100). */
  stability: {
    supersaturationSoftLimit: 1.2,
    supersaturationPenalty: 160, // per unit of S above soft limit
    coolingSoftLimit: 0.8, // °C/min
    coolingPenalty: 28, // per °C/min above soft limit
    stirringLowLimit: 120,
    stirringLowPenalty: 18,
    stirringHighLimit: 780,
    stirringHighPenalty: 22,
    impurityPenalty: 4.5, // per %
  },

  /** Quality penalties. */
  quality: {
    /** Growth rate above this incorporates defects. */
    optimalGrowth: 22,
    fastGrowthPenalty: 1.1, // per unit above optimum
    /** Impurity inclusion scales with impurity × growth. */
    inclusionPenalty: 0.32,
    /** Low stability propagates into quality. */
    instabilityCoupling: 0.35,
    /** Penalty per nucleation burst (polydispersity). */
    nucleationPenalty: 7,
  },

  /** Weight of late steps when averaging instantaneous scores. */
  lateStepWeight: 1.6,
} as const;

export type ScoringConfig = typeof SCORING_CONFIG;
