# CrystalTwinAI × QFabric — paper-linked experiment environment

**Date:** 2026-11-08. **Status:** synthetic-offline reproducibility
contract implemented; external scientific replication **not yet performed**.

## Local developer environment

CrystalTwinAI is a separate Next.js/TypeScript project:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

QFabric is a separate Python 3.11+ repository. Clone it alongside
CrystalTwinAI and follow
[the QFabric bundle procedure](https://github.com/Takzin1/QFabric/blob/research/reproducible-bundle-v1-20261108/docs/integrations/research-bundle-v1.md)
to export a CPU synthetic report and a SHA-256-bound manifest.

The new function
`verifyOfflineResearchBundle(snapshotJson,reportJson,manifestJson)`
in `src/lib/research-run-bundle.ts` accepts **original decoded UTF-8
file contents**. It independently recomputes the exact source/report hashes,
checks source and reported summaries, invokes the existing QFabric report
validator, and checks the full `ctqf-research-bundle/1` manifest. It has
automated adversarial tests. This is a **library API**, not yet an on-screen
upload feature. Full report QICK plan reconstruction is still checked by
QFabric's Python `--verify` CLI, not by the browser function.

## Paper → equation → reproducible evidence

### CrystalTwinAI: crystallization physics

1. **Numerical verification, not laboratory validation.** Use the existing
   constant-growth PBE analytical solution and 64/128/256 grid comparisons.
   Report normalized L1, conservation, size-distribution discrepancy,
   method and boundary condition. Source lead: Zhang et al. (2024),
   DOI [10.1016/j.compchemeng.2024.108612](https://doi.org/10.1016/j.compchemeng.2024.108612).
   A moving top-hat has discontinuities; do not claim general second-order
   convergence solely from this benchmark.
2. **Experimental comparison.** Preserve the source-native BigSolDB
   v2.2 data and original source protocol; DOI
   [10.5281/zenodo.22648301](https://doi.org/10.5281/zenodo.22648301).
   Keep mole fractions separate from solvent-volume-normalized mol/L.
   Compare matched material/solvent/solid form/temperature only, with held-out
   MAE/RMSE and diagnostic residual plots.
3. **Dynamic and mechanistic validation.** Continue the existing original
   induction-time and particle-size-distribution intake. Require time
   origin, instrument method, units, measurement uncertainty and a
   predeclared fit/holdout partition. No training on held-out conditions.

### QFabric: quantum device control and tests

The bridge's synthetic IQ unit-circle signals are independent of the
crystallization model and **not** a physical quantum measurement.
Use QFabric's plan-only QICK adapter, pinned-signature fixture and drift
harness for software-level compatibility. For physics evaluation,
investigate the existing source leads: Proctor et al. (2022),
[10.1103/PhysRevLett.129.150502](https://doi.org/10.1103/PhysRevLett.129.150502);
Govia et al. (2023),
[10.1088/1367-2630/ad0e19](https://doi.org/10.1088/1367-2630/ad0e19).
Do **not** pool mirror RB, QEC logical error, quantum volume and IQ signal
power into one metric or call it quantum advantage.

## Shared falsification protocol

| Case | Preregistered expectation | Interpretation |
| --- | --- | --- |
| Identical synthetic source/report/manifest bytes | Accept | Offline software compatibility only |
| Substitute a snapshot with a one-byte difference | Reject | Demonstrates local byte-link detection |
| Alter execution, provenance or measured status | Reject | Demonstrates fail-closed claim validation |
| Run source-calibrated model on an independent holdout | Pending original dataset | Needed before scientific prediction claims |
| Connect to actual QICK devices with authorization | Not implemented | Requires separate safety review and hardware tests |

**Research claim target:** "Versioned provenance and deterministic
fail-closed checks improve auditability of a mixed-domain research
workflow." Avoid stating that the current bridge achieves experimental
accuracy, a quantum-computing advantage, or reliable industrial control.

Original-paper metadata and raw source files must be rechecked against
publisher records before external scholarly citation. Existing fixtures
are synthetic and licenses/units for unimported source candidates remain
unverified.
