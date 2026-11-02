# PBE smooth-profile numerical verification and reproducibility (v2)

**Scope:** numerical correctness of a one-dimensional constant-positive-growth population balance **advection equation**, not experimental crystallization accuracy or chemical kinetics.

## Why this test?

The existing analytic benchmark translated a discontinuous top-hat particle-number distribution. That is a useful anti-diffusion benchmark, but discontinuities inhibit the expected high-order asymptotics of spatially high-order schemes.

A second profile is now supported:

```text
n(L,0) = [N₀ / (3(b−a)/8)] sin⁴[π (L−a)/(b−a)]       a≤L≤b
n(L,0) = 0                                              otherwise
G = constant > 0; ∂n/∂t + G ∂n/∂L = 0
n(L,t) = n(L−Gt,0)
```

The **cell-integrated exact reference**, not an approximate point sample, uses the analytic primitive:

```text
∫sin⁴(z) dz = 3z/8 − sin(2z)/4 + sin(4z)/32
```

The initial condition is compactly supported and smooth through its first three derivatives at the support boundaries. It has the same total particle number and physical support across all mesh resolutions.

## Predeclared deterministic benchmark

| Parameter | Value |
|---|---|
| Particle-size domain | [0,120] µm |
| Initial support | [15,45] µm |
| Exact final support | [27,57] µm |
| Number concentration | 100,000 particles/mL |
| Growth velocity | 0.6 µm/min |
| Integration duration | 20 min |
| Spatial grids | 64 / 128 / 256 bins |
| Spatial comparison CFL | 0.4 |
| Temporal comparison | CFL 0.4 / 0.2 / 0.1 at fixed 128 bins |
| Numerical methods | First-order upwind vs. MUSCL-minmod/SSP RK2 |

**Spatial observed error:** normalized L1 of the per-bin number deviations relative to analytic integrals. Empirical refinement order between doubled meshes is `log₂(E_N / E_2N)`. Tests require positivity, particle-number conservation, finite first moments, decreasing mesh error, and a materially smaller fine-grid error for MUSCL.

**Temporal observed error:** at a fixed 128-bin grid, compare the predicted bin arrays at decreasing timestep with *exactly fixed* spatial cells; the self-convergence order is `log₂(||u_Δt−u_Δt/2||₁ / ||u_Δt/2−u_Δt/4||₁)`. It measures timestep sensitivity of the same numerical method and is **not** identical to total physical prediction error.

All thresholds are tested on a named numerical problem. **This does not mathematically prove universal 1st- or 2nd-order accuracy**, solve coupled thermodynamics, validate experimental measurements, or confirm any parameter values for real crystallization.

## Run locally and reproduce the results

```bash
npm ci
npm run typecheck
npm test
npx tsx scripts/report-pbe-convergence.ts
npm run build
```

The deterministic JSON report is written to `artifacts/pbe-verification/smooth-convergence.json`. GitHub Actions attaches the exact report **separately for Node 20 and Node 22** as downloadable artifacts. They contain all exact bin integrals and numerical bin predictions to permit independent recomputation, not merely preformatted chart scores.

The browser's **PBE analytic reference** panel can run the top-hat or smooth sin⁴ comparison on demand and download per-bin results.

## Ongoing limitations / what comes next

- Full original BigSolDB and experimental raw PSD source authentication remains [Issue #32](https://github.com/Takzin1/crystaltwinai/issues/32).
- This is constant-velocity **size advection only**: no nucleation, solute depletion, crystal mass balance, agglomeration, temperature variation, dissolution, or reactor boundary physics.
- The standalone educational `src/lib/pbe-upwind.ts` solver is **unchanged**; this does **not** replace its transport algorithm or certify its growth/birth/depletion coupling. A separate verification of coupled PBE invariants is still necessary.
- Spatial and temporal refinement results must not be marketed as chemical prediction accuracy or equipment control readiness.
