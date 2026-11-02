# Research Evidence Intake v1 — November 2026

## Scope and scientific honesty
CrystalTwinAI's Research Schema v2 previously accepted metadata and measurement
JSON but could only *display* a user-declared SHA-256 of an original source file.
The new **Research Evidence Intake v1** permits the user to select those original
bytes locally and compare a computed SHA-256 with the *declared* digest. It
produces a machine-readable, byte-bound manifest (without raw data).

This is an **intake record, not a scientific or publisher-authentication
certificate**. It cannot verify a paper DOI against file bytes, licensing,
experimental conditions, spectra, concentration, crystallinity, model fit,
authorship or third-party origin. A checksum may be deliberately fabricated.
Neither a matched digest nor a declared provenance field releases a scientific
validation claim.

### Workflow
1. Import a Research Schema v2 JSON file (1 MiB maximum); preserve the
   exact original byte stream for the import's SHA-256.
2. Optionally select the exact ORIGINAL scientific source file that the v2
   metadata field `sourceFileSha256` purports to identify (32 MiB maximum).
   It may be a CSV, NeXus, or other format; the bytes are hashed, never parsed.
3. Display: no original source, declared digest missing, matching digest,
   or **digest mismatch**. Mismatch is a hard stop for positive byte evidence.
4. Export `crystaltwin-research-evidence-v1.json` with the imported research
   hash, source checksum status, bounded declared metadata, explicit blockers
   and *false* scientific-validation/rights/authentication flags.
5. Independently check the original publication, license, assay method, actual
   experimental conditions, conversion provenance and target observable before
   attempting any model validation. Do not compare raw Raman/XRD with the
   present temperature/concentration education model.

Inputs remain in the current browser session. No raw files are transmitted,
committed or persisted by this feature. The manifest is a user-selected local
download, not an online publication record. HTTPS or localhost is required
for browser SubtleCrypto; fail closed if unavailable.

## Public research dataset leads (reviewed 2026-11-02)

| Lead | Original reference | Available? | Proposed next action |
| --- | --- | --- | --- |
| Process Monitoring of Zeolite Crystallization: Bridging In situ Raman Spectroscopy, Ex situ XRD, and Predictive Machine Learning Models | https://doi.org/10.5281/zenodo.18972297 | Open, five NeXus .nxs Raman/XRD files shown. License and internal signal mapping not independently audited here. | Audit bytes, NeXus fields, source rights, spectra/time units. No direct comparison with CrystalTwinAI's temperature/concentration output. |
| Crystallisation Kinetics Dataset (PharmaCrystNet) | https://doi.org/10.5281/zenodo.20816635 | **Embargoed until 2027-06-01**, inaccessible as of this review. | Monitor release; do not claim access or reproduce any numbers from it. |
| Kinetic and Thermodynamic Crystallization Events from Supersaturated Solutions of Vanillin | https://doi.org/10.7488/ds/8142 | Repository lists microscopy, PXRD, SCXRD and Raman material; no compatible solution concentration trajectory yet established. | Inspect source conditions and actual arrays before selecting a measurable comparator. |
| Benchmarking model-based design of experiment approaches with a pharmaceutical crystallisation emulator | https://doi.org/10.1038/s41524-026-02336-y | Published 2026-09-26; study uses experiment-calibrated PBM and synthetic emulator. This is a **methodological** reference. | Adapt benchmarking methodology and predeclared failure criteria; never treat emulator-generated values as original measurements. |

The above leads are not bundled datasets. Rights and format checks must
precede any download/redistribution or model comparison.

## Evidence gates for the next release

- Validate transformation chain end-to-end using actual source/derived bytes,
  matching units and an observable-specific method (not mere DOI matching).
- Declare experiment material, solvent, temperature source, measured variables,
  replicate structure, time origin and instrument calibration.
- Add a mutually agreed held-out experimental comparison only when an
  appropriate data license and scientifically compatible measurements are
  available.
- For physical model changes, pre-register accepted metrics and out-of-domain
  refusal criteria; reserve the educational numerical model as a teaching demo.
- Improve local hashing to streaming for sources above 32 MiB only after
  robust browser performance profiling.

## Local checks
```bash
npm ci
npm run typecheck
npm test
npm run build
```
Tests include original/mismatched byte digests, forged provenance labels,
malformed filenames, invalid timestamps, missing metadata and no accidental
promotion to physical verification.
