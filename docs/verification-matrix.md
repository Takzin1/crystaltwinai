# Verification matrix (educational simulator) — 2026-10-26

This document lists CI-enforced **software correctness conditions** and their
scope. It is not a physical validation study, safety case or quantum advantage
claim.

## CI gates

The \`Quality checks\` GitHub Actions workflow verifies each pull request
and main push on **Node.js 20 and 22**, with independent non-fail-fast jobs:

1. \`npm ci\` from the checked-in lockfile.
2. \`npm audit --audit-level=high\` (fails on high/critical advisories).
3. \`npm run typecheck\` (TypeScript strict checking).
4. \`npm test\` (all contract, scientific-boundary and numerical property tests).
5. \`npm run build\` (Next.js production compilation).

All sample runs are offline/synthetic. No GPU, Nebius API, QICK hardware or
device execution is needed or asserted.

## Expanded verification coverage

| Layer | Mechanism | Software assertions | Not proved |
|---|---|---|---|
| Simulation engine | 256 fixed-seed inputs plus presets and extrema | finite values; deterministic rerun; exactly N steps; controlled cooling; nonincreasing solute; monotone/bounded yield; bounded quality/stability; consistent summary; preserved input | model fidelity or real plant kinetics |
| Simulation stability | Metamorphic short/long trajectories | extending timeSteps keeps the same earlier states | future environmental perturbations |
| Input defenses | Every parameter omitted, NaN, ±Infinity, out of range; fractional timeSteps | reject invalid inputs before simulation | controls for actual equipment |
| QFabric export | Perturbed in-memory result objects | step continuity; finite/valid trajectory and summary | origin authentication |
| QFabric report | Deliberate mutations to valid synthetic fixture | row count/time step agreement; valid ranges; QICK reference commit agreement; plan-only and synthetic claims | cryptographic signature, GPU benchmark, physical sensor validity |
| Data ingestion v1 | CSV/JSON parity and malicious/malformed tokens | reject formula-like/nonfinite CSV; strict ordering and shapes; preserve equivalence | observed-series scientific comparability |
| Research import v2 | Known synthetic research fixtures with hostile URL | reject unsupported provenance link schemes and incompatible units through existing gates | original data license/authenticity |
| Quantum bibliography | Versioned JSON evidence schema plus negative claim tests | DOI structure and disclaimer constraints; fixed citation snapshots | citation-count recency, physics calibration, quantum speedup |

The PR merge is conditioned on *all required jobs passing*, not only lint or
UI compilation. Test failures must not be bypassed to ship.

## Reproduction

\`\`\`bash
npm ci
npm run typecheck
npm test
npm run build
\`\`\`

CI log displays the individual test cases and status. Seeds are fixed, so
regressions are deterministic rather than flaky; independent random sampling
is not a statistical guarantee that unseen failures cannot occur.

## Remaining scientific and operational gaps

- **Measured crystallization experiments:** source-licensed time series with
  instrument uncertainty, measurement calibration, independently replicated
  trajectories, concentration basis and sample/bath temperature provenance.
- **Independent baseline:** quantitatively benchmark this educational engine
  against an independently implemented solver or reference dataset with stated
  tolerances; do not treat self-consistency as external verification.
- **Sustained property testing:** mutation testing / differential fuzzing could
  increase the chance of finding logic flaws beyond the fixed-seed matrix.
- **Cross-repository contracts:** verify real QFabric versioned outputs against
  an agreed immutable schema/producer digest. Browser-side producer SHA fields
  are assertions, not cryptographic source authentication.
- **Security and accessibility:** browser E2E, accessibility scans, dependency
  maintenance, content-security policy and authenticated artifact provenance
  remain separate future work.

Neither the current simulator nor the literature metadata substantiates
industrial control, medical/safety decisions or quantum-enhanced prediction.
