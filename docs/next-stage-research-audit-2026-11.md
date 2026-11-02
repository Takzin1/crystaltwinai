# CrystalTwinAI next-stage technical audit — 2026-11-02

## Verified code-level baseline

- Next.js/React educational simulator with deterministic, simplified process rules.
- CSV/JSON ingestion and explicit SHA-256 and synthetic-vs-observed labelling.
- Separate first-order relaxation *alternative*, trajectory residuals, bounded
  resampling and fixed-seed input sensitivity. These are comparisons, not
  physical validity proofs or calibrated predictive intervals.
- Research v2 schemas, provenance declarations, comparability gates and
  QFabric versioned, synthetic, plan-only exchange.
- Quality CI: Node 20/22, dependency audit at high+, TypeScript check,
  tests and production build. Style lint is only a TypeScript alias.

## P0 — addressed in this audit branch

- Validate export input against UI parameter ranges, rather than finite-only.
- Demand contiguous trajectory and nonincreasing cooling/concentration,
  nondecreasing bounded yield, nonnegative growth.
- Recompute trajectory mean growth and final yield before emitting the
  QFabric bridge snapshot.
- Add adversarial export regression tests. Retain strict synthetic labels.

## P1 — next working prototype

1. Add an offline **reviewed proposal preview** in the workbench: import
   QFabric's assessment/review and the corresponding original snapshot and
   proposal bytes; recompute SHA-256 in the browser; *only* a self-attested
   review explicitly opted into by a human may offer manual simulation preview.
2. Split the UI into **educational model** and **measured experimental
   comparison** tabs, and block unsupported material/solvent/unit comparisons.
3. Introduce a versioned `ExperimentManifest` with code commit, model
   revision, parameter range revision, dataset DOI, SHA-256, original conditions,
   observable selection, exclusions and acceptance thresholds.
4. Add benchmark scenarios with quantified model-vs-model discrepancies and
   adversarial sensitivity tests; include cases where the model *fails*.
5. Add accessible UI tests and visual regression snapshots before changing
   layout; do not accidentally call rule-based recommendations a trained model.

## P2 — scientific credibility gates

- Obtain actual experimental crystallization datasets with confirmed license,
  source DOI and conditions; retain pristine bytes and holdout split.
- Fit kinetic parameters on training data only; report held-out MAE/RMSE,
  residual autocorrelation, uncertainty calibration, and failure regions.
- Where available, progress to population-balance models (PBE), CSD-based
  dynamics and mass-balance closures rather than treating the current
  simplified pedagogical growth score as physics.
- Add model registry, explicit out-of-distribution refusal and human review.
- QFabric's quantum literature bibliography is **context only**. Do not claim
  that QICK hardware simulated a crystallizer or that physical results were
  reproduced by the synthetic bridge.

## Reproducibility gates

Run `npm ci && npm run typecheck && npm test && npm run build`.
Do not merge unless both Node CI jobs pass. Update reference record/version and
compare source-byte hashes before claiming any cross-repository compatibility.
