/**
 * Quantitative residual diagnostics for bounded, matched educational trajectories.
 * Sign convention is reference - candidate throughout.
 * A circular moving-block bootstrap is a descriptive resampling interval ONLY;
 * it is not measurement uncertainty, prediction coverage, or physical validation.
 */
export interface ResidualDiagnostics {
  n: number;
  bias: number;
  mae: number;
  rmse: number;
  maxAbs: number;
}
export interface DescriptiveInterval {
  lower: number;
  upper: number;
  confidenceLabel: "descriptive_95pct_block_resampling_not_measurement_uncertainty";
  draws: number;
  blockLength: number;
  seed: number;
}
export function quantile(values: readonly number[], probability: number): number {
  if (!values.length || values.some(v => !Number.isFinite(v)) ||
      !Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError("Quantile requires finite data and probability within 0..1.");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lo = Math.floor(position);
  const fraction = position - lo;
  return sorted[lo] + fraction * (sorted[Math.min(sorted.length - 1, lo + 1)] - sorted[lo]);
}

export function residualDiagnostics(residuals: readonly number[]): ResidualDiagnostics {
  if (!residuals.length || residuals.length > 10000 ||
      residuals.some(v => typeof v !== "number" || !Number.isFinite(v))) {
    throw new RangeError("Residuals require 1..10000 finite numbers.");
  }
  const n = residuals.length;
  const abs = residuals.map(Math.abs);
  const bias = residuals.reduce((sum, value) => sum + value, 0) / n;
  const mae = abs.reduce((sum, value) => sum + value, 0) / n;
  const rmse = Math.hypot(...residuals) / Math.sqrt(n);
  const maxAbs = Math.max(...abs);
  if (![bias, mae, rmse, maxAbs].every(Number.isFinite)) {
    throw new RangeError("Residual statistics overflowed.");
  }
  return { n, bias, mae, rmse, maxAbs };
}

function seeded(seed: number): () => number {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("Seed must be a uint32.");
  }
  let state = seed || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/** Consecutive blocks preserve some serial dependence, not independence. */
export function blockBootstrapBias(
  errors: readonly number[],
  draws = 400,
  seed = 0x51a5eed,
): DescriptiveInterval | null {
  if (!Array.isArray(errors) || errors.length > 200 ||
      errors.some(v => typeof v !== "number" || !Number.isFinite(v))) {
    throw new RangeError("Bootstrap requires at most 200 finite residuals.");
  }
  if (!Number.isInteger(draws) || draws < 100 || draws > 2000) {
    throw new RangeError("Bootstrap draws must be 100..2000.");
  }
  if (errors.length < 8) return null;
  const n = errors.length;
  const blockLength = Math.max(2, Math.floor(Math.sqrt(n)));
  const random = seeded(seed);
  const boot: number[] = [];
  for (let run = 0; run < draws; run++) {
    let total = 0;
    for (let done = 0; done < n;) {
      const start = Math.floor(random() * n);
      for (let offset = 0; offset < blockLength && done < n; offset++, done++) {
        total += errors[(start + offset) % n];
      }
    }
    boot.push(total / n);
  }
  return {
    lower: quantile(boot, 0.025),
    upper: quantile(boot, 0.975),
    confidenceLabel: "descriptive_95pct_block_resampling_not_measurement_uncertainty",
    draws, blockLength, seed,
  };
}
