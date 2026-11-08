# Zhang et al. (2024) — nonuniform-grid PBE benchmark, first integration

**Source supplied by the project owner:** Wendi Zhang, Todd Przybycien, Johannes
Schmölder, Samuel Leweke and Eric von Lieres. *Solving
crystallization/precipitation population balance models in CADET, part I:
Nucleation growth and growth rate dispersion in batch and continuous modes on
nonuniform grids*. **Computers & Chemical Engineering** 183 (2024), 108612.
DOI: https://doi.org/10.1016/j.compchemeng.2024.108612.

**Research boundary:** This is a **new CrystalTwinAI numerical method test
inspired by the original paper**, not a reproduction of its complete CADET
software, its seven cases, paper figures, or supplementary numerical parameters.

## Exact mapping of source → implementation

| Primary PDF | Mathematical construct | Implementation |
| --- | --- | --- |
| §2.1, pp. 2–4 | PBM size coordinate and growth advection | Constant nonnegative size velocity, no births or growth dispersion |
| §3.1, pp. 4–5 | Conservative finite-volume flux balance on nonuniform cells | Evolve cell-integrated counts with local cell widths |
| §4.1, pp. 6–7 | First-order upwind flux; nonuniform-grid generality | Upwind interface flux `F=G*N_i/ΔL_i` |
| §6.1, p. 9 | Advected rectangular initial condition; `n(L,t)=n_0(L-Gt)` | Exact overlaps of translated support with every finite-volume cell |
| Eqs. (49), (50), p. 9 | Normalized L1 and observed refinement order | Bin-integrated L1 and `log(E_coarse/E_fine)/log(N_fine/N_coarse)` |
| Eq. (51), p. 9 | Particle-size moments | 0–6 numerical bin-center moments; analytic reference integrals |

The paper implements **upwind, Koren and WENO23/WENO35** and compares
numerical accuracy/runtime across seven cases. This PR implements **only
the upstream reference upwind** transport equation with both a uniform
and a geometric nonuniform mesh. Koren/WENO and the paper's adaptive
BDF/IDAS analytical Jacobian methods remain future work.

## Newly declared *CrystalTwinAI* test conditions

| Property | Synthetic setting |
| --- | --- |
| Size domain | [0,120] μm |
| Initial top-hat support | [10,20] μm |
| Population | 100,000 particles/mL |
| Constant positive growth | 0.65 μm/min |
| Duration | 20 min |
| Analytic translated support | [23,33] μm |
| Spatial bins | 64 / 128 / 256 |
| Grid types | Uniform and geometrically graded left-refined |
| Total final/initial cell-width ratio, graded mesh | Approximately 3 |
| Maximum **local** Courant number | 0.4 |
| Case output | Exact bin counts, numerical counts, L1, 0–6 moments, outflow and number closure |

We use a **different population scale and independently declared velocity
and duration**, not the complete paper's input deck. Analytic support,
total initial particle number and boundaries are the same across grids.
The shifted support stays clear of the right domain boundary; any reported
upper-boundary outflow must still be checked.

Cell populations `N_i=n_i ΔL_i` obey

```text
N_i(t+Δt) = N_i(t) - G Δt * N_i(t)/ΔL_i
                       + G Δt * N_(i-1)(t)/ΔL_(i-1)

CFL_i = G Δt / ΔL_i,  CFL_max ≤ 0.4.
L1 = Σ_i |N_i(predicted)-N_i(exact)| / N_total
```

The `i=0` left face has zero incoming population. The final cell's
outflow is tracked explicitly; the closure audit checks
`ΣN_i + cumulative_outflow ≈ N_initial`.

Particle-size moments use `Σ N_i L_center,i^p`, p=0,…,6.
Exact reference moments integrate `L^p` over the translated uniform
number-density rectangle. Higher moment errors include bin-center
quadrature error; do not call them errors in experimental PSD moments.

## Reproduce offline on existing CrystalTwinAI environment

```bash
npm ci
npm run typecheck
npm test
npm run build
npx tsx scripts/report-zhang-nonuniform.ts /tmp/zhang-pbe-nonuniform.json
```

The script refuses overwriting its output. The checked source file and
tests are `src/lib/pbe-zhang-nonuniform.ts` and
`tests/pbe-zhang-nonuniform.test.ts`. The ordinary quality workflow runs
the tests in the project's Node matrix; no GPU or network API is required
by the new numerical tests.

## Falsifiable conclusions and next source gates

- An upwind result **must** preserve the count inventory modulo declared
  boundary outflow, and must remain nonnegative at the prescribed CFL.
- Error and 0–6 moments are evaluated against analytic integrals, **not**
  another implementation of the same numerical stencil.
- Do not assert that geometric nonuniform meshing always improves L1:
  comparison depends on where resolution is allocated relative to support.
- Advective top-hat discontinuities prevent blanket claims of high-order
  asymptotic convergence. Empirical orders are diagnostics only.
- Next: independently implement paper-correct Koren on nonuniform grids
  and WENO23, compare error vs CPU time on **identical physical
  initial conditions**, then design source-specific nucleation and
  mass-balance tests.
- No downloaded raw reactor data, fitted kinetics, verified quantum
  control, or process safety claim is introduced.

A complete *paper-level* reproduction would require the author's
supplementary input decks, solver versions, chosen reference-grid
interpolations, tolerances and measured timing environment. They are
**not claimed to have been checked** in this integration.
