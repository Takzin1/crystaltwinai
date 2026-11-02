# Synthetic Model Falsification Bench v1

**Scope:** client-side software verification only; **not** physical-model
validation, experimental reproduction, a calibrated population balance model
(PBE), a yield predictor, or an approved industrial control method.

## Models and comparability

| Model | Implementation | What is comparable? | Shared assumptions |
| --- | --- | --- | --- |
| A: `crystaltwin_educational_supersaturation` | `src/lib/engine.ts` | temperature and dissolved concentration | linear solubility, fictional cooling |
| B: `first_order_relaxation_v1` | `src/lib/verification-models.ts` | temperature and dissolved concentration | same solubility and cooling, different deposition kinetics |
| C: `two_compartment_mass_transfer_v1` | `src/lib/conservative-reference.ts` | temperature and dissolved concentration | same solubility and cooling, distinct bounded flux dynamics |

Model C uses an illustrative **fixed volume = 1 mL** with a dissolved and
transferred solute compartment:

```text
C_sat(T) = 0.18 + 0.0035 * T               (pedagogical g/mL)
k = (0.035 + 0.065 * stirring/1000) / (1 + impurity/5)
delta = max(0, C_liquid - C_sat(T)) * (1 - exp(-k * dt))
C_liquid(t+dt) = C_liquid(t) - delta
C_solidEquivalent(t+dt) = C_solidEquivalent(t) + delta
C_liquid + C_solidEquivalent = C_initial   (toy model closure)
```

`C_solidEquivalent` is mass transferred divided by the original notional
volume, not a physical measured crystal mass or Model A's 0–100
arbitrary yield score. This is **not a PBE**. The closure test establishes
only internal arithmetic consistency for this reference.

## Falsification protocol, frozen in v1

On demand (button in Verification Lab):
- Run the four pre-existing fictional scenarios and the current user input,
  with the actual input copied into the JSON report.
- For Model A, check finite/contiguous steps, analytic cooling schedule,
  concentration monotonicity, nonnegative growth, bounded scores/yield,
  nondecreasing yield and exact mean/final summary values.
- Independently evaluate Model C closure and bounds at every step.
- Repeat Model A's run and compare exact JSON representations to detect
  nondeterministic software changes.
- For A–B and A–C, report temperature max absolute difference and
  concentration RMSE. Different kinetic assumptions are expected to
  disagree; **smaller RMSE does not imply improved physical accuracy**.
- Discrepancy alert threshold = 0.01 g/mL (purely pedagogical,
  never a scientific criterion). Software tolerances = 1e-9 except
  summary comparisons use 1e-7 to allow floating point accumulation.

Export the versioned `crystaltwin-falsification-bench/1` report locally.
It explicitly records `experimentalDataUsed=false`,
`physicalModelValidated=false`, `trainedOrCalibrated=false`,
`holdoutValidated=false`, and `hardwareExecuted=false`.
No source research file or external service is accessed.

## Limits and next research gates

1. Present code checks do not establish **scientific mass balance for Model A**:
   its yield is a normalized teaching score, not mass. A future physical
   model must represent liquid volume, solute mass, solid density and
   experimental solubility with consistent units.
2. Predeclare an independent material/solvent and temperature-dependent
   experimental solubility curve, from a reusable primary reference.
3. Introduce PBE/particle-size dynamics in a separate `modelVersion`,
   with integrator tolerance, numerical grid refinement and conservation
   tests. Never silently replace the existing education engine.
4. Benchmark against genuinely compatible measured trajectories only when
   source data rights, raw bytes, time units, substance, replicates,
   instrument method and calibration are verified.
5. Separate parameter fitting from a **held-out measured test set**,
   report RMSE/MAE, temporal dependence, coverage and failure regions.
6. Record `gitCommit` + dataset digest in a future reproducibility
   manifest; do not fabricate a commit hash in a static JSON export.

## Test plan

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Regression tests cover seeded bounded inputs (256 independent configurations),
synthetic deterministic reports, toy mass closure, and adversarial modifications
of the trajectory, cooling, yield, model statistics and input limits.

All physical and source authentication claims remain explicitly **false**.
