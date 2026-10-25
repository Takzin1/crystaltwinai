# Quantitative verification and robustness (v1)

**Scope:** software consistency and synthetic educational model sensitivity.
This is not measured crystallization validation, physical sensor calibration,
or a quantum simulation result.

## Different numerical models

The main engine uses power-law supersaturation growth, discrete nucleation,
and solute depletion. The independently implemented alternative model uses
analytic constant-rate cooling and first-order exponential relaxation toward
the **same pedagogical linear solubility law** at 0.06/min, without nucleation.

Only temperature (°C) and concentration (g/mL) are compared, on the same
integer time-step grid. For each matched point, residual = alternative minus
primary. Bias, MAE, RMSE and maximum absolute deviation are reported.
Shared cooling should agree to numerical precision, while differing kinetic
assumptions can produce concentration disagreement. The alternative is
**not an independent experimentally calibrated reference standard** and is not
used to rank physical accuracy. Yield and quality are not compared across
incommensurable models.

## Sensitivity to assumed input bounds

The UI performs 128 deterministic, seeded, synthetic perturbation runs:
uniform, independently varying inputs within ±1%, ±3%, ±5%, or ±10% of each
configured parameter span. Values are clipped to supported bounds. The time
step count stays fixed. It reports observed min/max and P5/P50/P95 values for
yield, quality and stability.

These are percentiles of a hypothetical input distribution, **not** measurement
uncertainty, a prediction interval, a frequentist confidence interval, or
proof of validated process dynamics.

## Uploaded dataset comparison and statistical limits

The existing in-browser v1 CSV/JSON comparator still reports MAE, RMSE and
bias for exactly matched steps, never extrapolating missing observations.
New diagnostics include maximum absolute error and the proportion of
available field observations with matched model steps.

When at least 8 matched residuals exist, a descriptive 95% percentile range
for mean bias is computed via 400 deterministic circular moving-block bootstrap
samples (block length max(2, floor(sqrt(N)))). For fewer than 8 points, no
interval is shown.

This does **not** estimate instrument error or establish statistical coverage.
Autocorrelation, systematic uncertainty, nonstationarity, unlabeled
provenance and lack of independent repeated experiments remain limitations.
The uploaded file provenance is only declared, not authenticated.

## CI and adversarial regression

- Numerically exact residual and quantile oracles, constant-bias bootstrap.
- Malformed, nonfinite, overflow, count-bound and unsupported-seed inputs.
- Independent model cooling and concentration invariants across scenarios.
- 256 fixed-seed varied synthetic input configurations.
- Mismatched steps, duplicate rows, missing rows, corrupted model states,
  forged fields and reverse-sorted observations.
- Dependency security, TypeScript checks, tests and production builds on
  Node.js 20 and 22.

## Scientific gaps

Before making physically predictive claims: obtain licensed independent
measured crystallization datasets, controlled sensor and replicate uncertainty
models, predeclared train/test splits, withheld-condition evaluation,
and benchmark physically calibrated alternative population-balance solvers.
No new work here runs NVIDIA GPUs, QICK hardware or physical equipment.
