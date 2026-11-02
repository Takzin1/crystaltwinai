# Scientific accuracy stage: exact numerical verification + v2.2 protocol gates

## What is truly made more accurate

CrystalTwinAI now **measures numerical discretization error** against an
analytically known solution, instead of equating "software test passed"
with "scientifically correct crystallization model."

Published algorithmic research and freely available references:

- W. Zhang et al., *Solving crystallization/precipitation population
  balance models in CADET, part I* (2024), DOI
  https://doi.org/10.1016/j.compchemeng.2024.108612 — finite-volume
  reference solver, reconstruction alternatives and benchmark cases.
- Li et al., *Efficient numerical method for solving multidimensional
  population balance equations in batch cooling crystallization*
  (2026), DOI https://doi.org/10.1016/j.partic.2026.01.024 —
  high-order, multi-dimensional methods are possible but **not
  reimplemented or reproduced** here.
- Krasnov et al., *BigSolDB v2.2*, DOI
  https://doi.org/10.5281/zenodo.22648301 — full 14-column primary
  table and separate method/solid-form companion tables.

These citations motivate an independent software verification
protocol. They are not evidence of numerical or physical accuracy
for our implementation.

## Analytic constant-growth size advection

A standard number density n(L,t) on particle-size axis L obeys

\`\`\`text
∂n/∂t + G ∂n/∂L = 0; G constant, positive
initial n(L,0) = N0/(L_b−L_a) on [L_a,L_b], zero otherwise
exact n(L,t) = n(L−Gt,0)
\`\`\`

Analytic reference settings: particle size domain [0,120] µm,
support [10,20] µm, N0=100,000 particles/mL, G=0.65 µm/min,
t=20 min. True final support [23,33] µm and number-weighted
mean 28 µm. This is an **exact translation**, not fitted
crystallization kinetics.

Reference each finite-volume cell against the *exact integral*
of this piecewise-constant solution over its physical interval,
not just the concentration at the center. Both numerical methods
use the **same actual initial support across 64,128,256 cells**;
this fixes the previous benchmark's inability to compare
physical initial conditions across grids because first-bin seed
placement changed.

Methods:

1. First-order upwind finite volume: flux F_(i+1/2)=G*n_i.
2. MUSCL minmod reconstruction and two-stage
   **SSP RK2** time integration. Flux reconstructed from cell-average
   counts; zero left inflow.
3. Automatic substeps maintain CFL = G*dt/dL ≤ 0.4.
4. Validate no negative bin count, number conservation,
   the number-weighted first moment, and absolute bin errors
   against the exact cell integrals.
5. Report normalized L1 = Σ_i |N_i(model)−N_i(exact)| / N0.
   The result is measured, not a presupposed high-order rate.

A top-hat contains discontinuities; its measured L1 refinement
behavior is **not** proof of globally 2nd-order accuracy.
No experimental PSD, nucleation, solute balance, mass growth,
equipment or chemical kinetics are evaluated by this test.

The existing educational synthetic PBE algorithm is untouched.
The *new* accurate advection solver is exposed through a separate
verification screen and is **not** silently substituted into the
educational equipment-facing simulation.

## BigSolDB v2.2: critical experimental-protocol safeguards

Publisher's public description:
https://zenodo.org/records/22648301

Data table: 125,752 compiled solubility points, 14 columns.
Companion method table: 1842 article records, 10 columns.
Companion solid-form table: 2295 source/form records, 15 columns.

**Critical dimensional distinction:**
\`Solubility(mol/L)\` was computed using
\`x/(1−x) * 1000 * ρ_solvent / M_solvent\` and means
**moles per L of pure solvent**, not per L of solution.
Source-native \`Solubility(mole_fraction)\` is the
only value imported by our v2.2 converter. We DO NOT
silently re-interpret or convert other concentration columns.
Our explicit conversion tool now refuses the listed
derived-numeric columns as possible method metadata.

**Solid forms:** v2.2's \`solid_form_label\` is filled for only
a minority of records; a blank value means the source form
was **not specified**, not that only one polymorph exists.
Our v2.2 importer therefore requires
\`--solid-form-column solid_form_label\` whenever the official
source column is present and refuses missing, mixed or
ambiguous forms. A user cannot bypass the gate by
simply omitting the grouping flag.

**Methods are NOT in the main v2.2 CSV.** They are in
\`BigSolDBv2.2_methods.csv\`, keyed by source DOI; solid
metadata in \`BigSolDBv2.2_solid_forms.csv\` has DOI, CAS,
solute SMILES and solid form label. Do not pretend the method
is a column of the main table.

A standalone offline protocol-inspection function
\`auditBigSolDB22SourceProtocol(methodsCsv,formsCsv,selection)\`
requires the exact companion headers and precise
DOI / CAS / solute SMILES / form label. It records
equilibration, instrumentation, replicates, declared
phase changes, and characterization, with an explicit
\`eligibleForFurtherReview\` gate. This gate is
a **selection heuristic**, not primary-laboratory
authentication, a full-source byte check, a scientific
accuracy certificate, or evidence that other experimental
conditions (such as concentration, temperature, solubility
units and perturbation protocol) are comparable.

**Never infer any experimental validity from the software
regression suite alone.** Source full-file data validation
still needs independent testing under issue #32.

## Commands

\`\`\`bash
npm ci
npm run typecheck
npm test
npm run build
\`\`\`

Open the Research Studio → Quantitative verification →
**PBE analytic reference** and click Run. Export the full JSON
including exactly integrated analytic solution and each
finite-volume predicted bin count. Test inputs are entirely
synthetic; no external dataset is automatically downloaded.

The v2.2 importer requires original bytes supplied by the user
from an approved source and hash verification. Example
command **only after** externally obtaining the pinned file:

\`\`\`bash
npx tsx scripts/import-bigsoldb22.ts \
  --source ./BigSolDBv2.2.csv \
  --compound "EXACT_COMPOUND_FROM_SOURCE" \
  --solvent "EXACT_SOLVENT_FROM_SOURCE" \
  --doi "10.xxxx/ORIGINAL_EXACT_DOI" \
  --solid-form-column solid_form_label \
  --solid-form-value "EXACT_REPORTED_FORM" \
  --out ./derived-research.json
\`\`\`

No license or original source SHA-256 is assumed until independently
checked. Do not commit the full dataset or an unauthenticated
derived file to this public repository.
