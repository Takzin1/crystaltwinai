# Research Schema v2 — scientific data import boundary

**Status:** Phase 1 technical foundation; NOT a validated crystallization model, not certified measurement data, no automated data retrieval.

The basis of this design is the 2026 CrystalTwinAI research dataset survey, which distinguishes four experiment modes: trajectory, equilibrium_curve, endpoint_sweep, distribution. The survey's reported dataset DOIs, file formats, downloadability and licenses are leads only; verify them against the originating publisher/repository before importing or redistribution.

## Ingestion boundary

- v1 (src/lib/datasets.ts) remains untouched. It uses virtual minute steps, g/mL and an educational model.
- v2 (src/lib/research-schema.ts) accepts **self-describing JSON only** with schemaVersion:2, metadata and measurements, at most 1 MiB and 10,000 rows.
- The JSON metadata must declare provenance (unverified, measured, simulated, synthetic, mixed), experiment mode, material, authors and **per-field units**.
- concentrationBasis is required when concentration or solubility values are present. Supported bases include mass_percent, mole_fraction, mol_per_L, g_per_mL_solution. Unsupported or unspecified conversions are rejected.
- pressureBasis must be gauge or absolute when pressure exists. Never assume gauge +1 bar without an explicitly declared atmospheric reference.
- Null observations are missing data, not zeros. Measurements are not used to control equipment, retrain models or automatically modify simulations.
- For this first implementation, distribution supports induction-time or D10/D50/D90 numerical rows. **Full binned PSD arrays, raw instrument files and verified nucleation event detectors are not yet implemented.** Do not claim otherwise.

## Example

See public/examples/research-v2-synthetic.json — clearly fictional.

The original units are preserved. A separate time-normalization helper converts s/min/h and K/°C for analysis while leaving native input intact. Alignment forbids extrapolation and interpolation through long gaps.

## Educational v1 projection

projectResearchToEducationalV1(dataset, true) is a deliberately narrow, explicitly acknowledged adapter. It requires trajectory mode, sample temperature, g/mL of *solution*, bounded values, and exact integer minutes (1–200) relative to the correct time origin. It omits all research-only fields, does not assume the underlying substances match, and is **not** a scientifically validated comparison. The web UI does not offer automatic projection.

## Not included

- Native CSV/XLSX ingestion and independent raw file hash confirmation
- Real Mendeley/Figshare downloads and independent DOI/license validation
- Unit conversion for mole fraction without composition and density
- Equilibrium, PSD or crystallization-kinetics model fits
- Experimental calibration, physical validity conclusions, plant control

## Regression checks

Run npm ci, npm run typecheck, npm test, npm run build. Verify imported data rights and exact units separately, with raw source files outside the repository unless redistribution is explicitly permitted.
