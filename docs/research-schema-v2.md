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

## v2.1 integrity extension (2026-10)

v2.1 **extends the same schemaVersion 2**; optional metadata.researchRevision = "2.1" signals the extended format. Existing v2 JSON is still parsed.

- Trajectories may contain multiple independent measurement series. Every row must identify runId, cycleId, channelId once multi-series identities are in use. Time must increase **within each series**, not globally across experimental runs; identical times across runs are valid.
- A literal JSON null is preserved as explicit missingness in missingReasons. Supported reasons: unspecified, sensor_failure, below_detection_limit, not_measured, redacted. An omitted field is *not* the same as an explicit null. Missing reasons can only describe explicit nulls.
- Normalized time series must be selected by run/cycle/channel for multi-series input. Missing readings are carried forward as **null barriers**, never silently bridged by interpolation. alignByTimeDetailed distinguishes observed, interpolated and unavailable results; interpolation is never measurement.
- Declared metadata.timeOrigin must be relative_to_run_start for educational v1 projection. Unknown origins and multi-series projection are refused. Existing v1 users and v2 parsing remain intact; the optional projection helper is intentionally stricter.
- All d10/d50/d90 pairs are checked for numerical ordering even if d50 is absent; all quantile units must agree. These do not imply an accurate particle-size measurement or validate the distribution.
- metadata.transformations is an optional ordered list of user-declared records (operation, software, version, hashes and notes). Each record is syntactically validated but **not authenticated**. Missing records must not be invented as if actual transformations were performed.
- summarizeResearchDataset returns per-series row counts and missingness. assessResearchComparability applies a conservative pre-comparison gate to declared material, solvent, measurement type/units, time origin, temperature sensor and series count. Passing this structural gate **does not establish scientific equivalence**.
- SHA-256 of imported JSON is independently calculated in the browser. metadata.sourceFileSha256 refers to a **separate original raw file** and is *not independently verified* unless the original bytes are supplied and separately hashed. Do not conflate these hashes.
- Native XLSX/raw CSV ingestion, Semenov sample/cycle identification based on actual file inspection, event detection, instrument-specific data semantics, model calibration, lab reproduction and DOI/license authentication are **NOT included**.

### v2.1 data example

See public/examples/research-v2-1-synthetic-multirun.json for a completely fictional multi-run example, including a missing sensor reading and source-mapping lineage declaration. Do not interpret the declared provenance or mapping as verified experimental evidence.

### Testing

In addition to existing tests, tests/research-integrity.test.ts checks interleaved runs, duplicate timestamps within a channel, missing barriers, observation-vs-interpolation provenance, v1 projection guardrails and unit/PSD consistency.
