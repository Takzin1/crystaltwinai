# Synthetic PBE Numerical Bench v1 — software consistency only

## Purpose and scientific boundary

CrystalTwinAI now has an **independent, explicit finite-volume reference**
for a **size-structured population balance equation (PBE)** in the
Verification workspace. This is a **synthetic algorithm and dimensional
accounting exercise**, *not* a validated crystallization process model.
It does not fit, infer or authenticate a crystal growth/nucleation law
from an experiment. BigSolDB v2.1/v2.2 contains reported equilibrium
solubilities; those are **not** suitable direct validation labels for the
particle-size population equation. Do not silently connect the two.

The earlier educational engine's 0–100 yield score is **not** physical
mass. Its values must never be compared to this module's solid g/mL
as though they represent the same observable.

## Discrete reference and declared units

Let the uniformly spaced size cells have midpoints L_i in **micrometres**
and width ΔL (µm). The finite-volume cells contain N_i in
**particles per mL of notional fixed-volume suspension**. On a
positive-velocity domain, the teaching reference approximates

\`\`\`text
∂n/∂t + ∂(G n)/∂L = J δ(L-L_min)
G: assumed constant size growth in µm/min (NOT calibrated)
J: assumed constant nucleation births in particles/mL/min (NOT calibrated)
N_i: integrated particle count in cell i, particles/mL
ΔN_i = (G Δt_sub/ΔL) (N_(i−1) − N_i) + births(first cell)
Courant G Δt_sub/ΔL ≤ 0.8, enforced using automatic substeps
\`\`\`

At the largest-size bin, particles cannot leave the model and are
**retained** in that bin. The UI and JSON flag terminal-size capping
when the numerical population reaches that boundary; the capped
distribution must not be interpreted as physically size-accurate.

The illustrative mass of a *spherical* particle at each bin midpoint:

\`\`\`text
m_i = density[g/cm³] * π/6 * (L_i[µm] * 10^-4[cm/µm])³
solid inventory[g/mL] = Σ_i N_i[particles/mL] * m_i[g/particle]
initial total inventory = initial dissolved g/mL + initial seeds solid g/mL
\`\`\`

Positive size transfers and first-bin births raise the discrete solid
inventory. The algorithm deducts the corresponding mass from dissolved
solute. If there is insufficient solute, it scales transfers and births
by a common factor ≤1. This is a **numerically conservative clipping
rule**, *not* a scientific supersaturation kinetic closure or an
independently fitted nucleation-rate model.

The discrete count balance is audited separately:

\`\`\`text
sum_i N_i(t) == initial seed count + cumulative accepted births
liquid(t) + sum_i N_i(t) m_i == initial dissolved + initial seed solid
\`\`\`

Number d10/d50/d90 are *number-weighted* bin-center quantiles, not
a measured volume-weighted laser-diffraction PSD. The number mean
and closure are recomputed from saved bins by an independent post-hoc
audit that detects tampered bin populations, mass, sample times,
particle-count claims, moments, Courant violations and modified geometry.

## Grid sensitivity protocol (NOT mathematical convergence certification)

The bench reruns the same *nominal parameter values* at **32, 64 and 128
size bins**, comparing numerical d50, mean size and solid mass.
Because seeds and newborn nuclei are placed in the **first bin**,
their representative initial size changes across grids.
A small successive-grid difference **does not certify** convergence
order or experimental correctness; the report's
\`gridConvergenceCertified\` and \`physicalModelValidated\` flags
stay **false**. Boundary-capped runs carry an explicit caveat.

The user may adjust hypothetical growth and nucleation rates. The
benchmark is started explicitly from the verification panel and runs
in-browser. It does **not** send requests, access a laboratory
device or incorporate the native Research v2 observations.
The downloadable JSON includes all bin arrays per timestep, exact
input values, counts, liquid and solid inventories, quantiles,
audit conclusions and the three-grid comparison.

## Regression and adversarial validation

\`\`\`bash
npm ci
npm run typecheck
npm test
npm run build
\`\`\`

Tests include:
- synthetic default numerical finite values, repeatability and
  zero/near-zero mass-closure residual;
- **analytical number-mean first moment** in a no-birth,
  no-solute-limitation and no-terminal-capping constant-growth scenario;
- pure-nucleation count increment J * time;
- solute depletion and a deliberately boundary-capped case;
- adversarial modification of exported bin populations, summaries,
  Courant bounds, particle quantiles, geometry and timestamps;
- 96 fixed-seed randomized valid synthetic configurations;
- grid-sensitivity audit and invalid parameter rejection.

## Next scientific gates

1. Independently authenticate a **primary lab experimental** trajectory
   with particle counts/PSD, size unit, growth conditions, phase form,
   density, growth kinetics and uncertainty.
2. Define solution thermodynamics, supersaturation, reaction geometry,
   dynamic temperature and growth/nucleation laws *separately* and
   predeclare their applicability.
3. Implement verified upper-size boundary treatment, multiple
   nucleation mechanisms, dissolution, agglomeration and breakage as
   distinct versioned solvers, not a silent substitution.
4. Test time-step and grid refinement against analytic solutions
   on physically equivalent initial conditions, beyond the present
   nominal first-bin placement.
5. Calibrate on training experiments only, evaluate untouched
   independent experimental runs, preserve raw-data SHA-256 and
   replicate measurement error bars, and cross-check physical mass
   balance against measured solute and solid inventories.

Until then, no source-authenticated hardware or physical-validation
claims are justified. BigSolDB source verification remains in #32;
#30, #31 and #33 are still pending review. This PBE bench depends on
their branch history but does not itself consume their measurements.
