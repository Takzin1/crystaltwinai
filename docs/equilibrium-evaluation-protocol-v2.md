# Equilibrium Evaluation Protocol v2 — predeclared models and local research input

## Purpose

CrystalTwinAI previously bundled a five-row BigSolDB 2.1 secondary
compilation and displayed a linear/constant high-temperature extrapolation.
The v2 panel now evaluates **any locally selected valid Research Schema v2
equilibrium JSON** against three *predeclared* and strictly
unit-compatible descriptive baselines. Original laboratory and source data
authentication remain **outside** the scope of this feature.

The workflow does **not** fetch external data, ingest an entire database,
auto-convert chemical units or use the educational cooling-crystallization
model as a physical predictor. The original source and complete experimental
conditions should be authenticated separately under issue #32.

## Inputs and privacy

- A local user-selected Research v2 JSON (max 1 MiB) or the bundled
  paracetamol/ethanol example, with SHA-256 of the **exact original
  imported JSON bytes** calculated in the browser using SubtleCrypto.
- Required: \`experimentMode: "equilibrium_curve"\`, native
  \`concentrationBasis: "mole_fraction"\`, solubility unit
  \`"mole_fraction"\`, Kelvin or Celsius temperatures, a declared solvent,
  five or more observations, and unique numeric temperatures.
- There is no conversion between mole fraction and the existing educational
  engine's \`g/mL\`; Celsius may be converted to Kelvin (add 273.15).
- Multiple run/cycle/channel identities in the same JSON are **refused**.
  One dataset has one metadata DOI, solvent, material, method and solid form:
  the JSON schema itself does not certify that those declarations hold
  for every observed sample. Investigate potentially mixed sources separately.
- Files stay in the browser and are not transmitted by this feature.
  HTTPS or localhost is required to calculate SHA-256. The exported report
  contains the byte digest, model parameters, prediction rows, declared
  metadata, warnings and explicit false scientific validation flags.

## Frozen, deterministic evaluation plan

1. Sort by increasing temperature. Hold out the last
   \`max(2, ceil(0.3*n))\` higher-temperature points. Every remaining
   low-temperature observation is training data (min three points).
2. Fit three baselines **using training only**; do not use the holdout
   to select functional forms, modify hyperparameters or refit the models.
3. Calculate signed bias, MAE and RMSE over the *same* holdout samples:
   - **Constant**: training average mole fraction.
   - **Linear**: OLS mole fraction against temperature in Kelvin.
   - **Apparent van't Hoff-type**:
     \`log(x) = a + b * 1000 * (1/T - 1/T_ref)\`,
     OLS fit on *training* transformed measurements only.
4. If any model forecasts a nonfinite value or outside
   \`0 < mole_fraction < 1\`, its evaluation status becomes
   \`invalid_forecast\`, and **all its displayed metrics are null**.
   Do not silently clamp unrealistic outputs.
5. Export a versioned report with full split temperatures, fitted parameters,
   declared provenance/solid form/measurement method, predicted and observed
   holdout values and the imported source JSON byte hash.

### Interpretation limits

The apparent van't Hoff-type equation is only a temperature-dependent
**descriptive log-fit**. It cannot be interpreted as a calorimetric
enthalpy without additional thermodynamic and phase-equilibrium assumptions
and a controlled material/solvent/polymorph system. An apparent fit does
**not** account for nonideal activities, phase transitions,
concentration-unit differences, solution density or temperature-induced
changes in solid form.

A high-temperature holdout is **extrapolation**, not a random IID test,
external lab replication, proof of generalization across materials or
independent model selection. Choosing the "winner" on these same
two held-out points would contaminate future performance claims.
A separate predeclared confirmatory study or independent experiment
is required before drawing physical conclusions.

Neither a valid CSV file Git blob hash nor a SHA-256 of a research JSON
certifies original experiment authenticity or permissions.
Literature-compiled data may report laboratory observations yet still
need source-paper method, equipment, data rights and solid-form verification.

No PBE, growth kinetics, nucleation rates or device control are represented.
All \`physicalClaims\` fields remain explicitly **false**.

## Regression checks

\`\`\`bash
npm ci && npm run typecheck && npm test && npm run build
\`\`\`

Tests cover:
- same holdout across three predeclared models;
- exact training coefficient invariance after changing **holdout labels**;
- synthetic log/mole-fraction inverse-K model with ~zero numerical error;
- equivalence of Celsius/Kelvin representations;
- fail-closed reports for out-of-bounds predictions, mixed run identifiers,
  duplicate temperatures, incompatible concentration units, missing values,
  invalid temperatures and nonfinite measurements.

## Dependencies

This PR is stacked after **#30** (v2.1 dataset benchmark) and **#31**
(v2.2 source intake), both kept Draft pending end-to-end real-file
validation and source-rights checks in **#32**. The author of this
feature did not independently load the upstream full CSV files.
