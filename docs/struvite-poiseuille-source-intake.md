# Struvite Poiseuille-flow crystallizer — source-native experimental evidence

**Imported from the exact user-uploaded archive, not a fabricated fixture.**
Data reference: https://data.mendeley.com/datasets/cwxzsth45r/1
Original title: *Data for Nucleation and crystal growth kinetic parameter optimization of a Continuous Poiseuille flow struvite crystallizer using a discretized population balance and dynamic fluid model*.

## Original archive: what was actually inside

- A **ZIP with one XLSX workbook**: \`Parameter optimization data.xlsx\`.
- Workbook sheet \`DATA\` covering \`A1:AK90\`.
- ZIP SHA-256: \`ece347014853a0a62005952bdf441ec3db7e730117f017ac5100b453ee0170df\`
- Extracted XLSX SHA-256: \`c803888c352935b6926b117fcb62eeb76e57f595623cc69d43cfbdbd6f4f2afe\`
- **87 original particle size bins** in micrometres. Values 0.01–586 µm, without interpolation or re-binning.
- Source conditions: SI = 0.8, 1.0, 1.4. Exact SI chemical interpretation requires corresponding publication/protocol.
- R mixer: measured average volume-% particle-size distributions (columns B/D/F) with source-reported 95% CI (C/E/G), separately simulated PSDs from **kinetic parameter optimization** (J/L/N, with reported CI K/M/O).
- IJ mixer: observed/average volume-% PSDs expressly labeled **"USED FOR VALIDATION"** (R/T/V, with reported 95% CI S/U/W), separately simulated PSDs **using Galbraith kinetic parameters** (Z/AA/AB, *no* supplied CI columns).
- R mixer PO4-P concentration (mol/L): **measured** at 55–135 min (9 listed times, source has missing measurements for some SI), and **simulated** optimized vs Galbraith traces on 0–140 min (15 listed times each).
- Source PO4-P header contains \`(95% CI = 8.88E-5)\` without sufficient independent documentation of its statistical construction.

## Committed lossless data

The complete 23,069-byte normalized source-native JSON payload is stored as a
gzip-compressed RFC 4648 base64 text file at
\`public/examples/struvite-poiseuille-source-v1.json.gz.base64\`.
This storage format permits committing a **byte-for-byte numeric transcription**
of all measured values, reported confidence intervals, simulated curves,
conditions, explicit null observations and provenance without a spreadsheet parser
being delivered to browsers.

Uncompressed normalized JSON SHA-256:
\`970218d7bc26b4021e341c6fd6d66cf8f768b260507db714185fcb7d48306c6b\`.

To inspect or export JSON locally:

\`\`\`bash
npm ci
npx tsx scripts/expand-struvite-evidence.ts --out artifacts/struvite/source-native.json
npm test
npm run build
\`\`\`

The research UI decompresses the source with native browser gzip handling
and re-verifies the *normalized JSON SHA-256* before rendering.
Node.js test/CLI independently decompresses, verifies the digest,
requires 87 strictly increasing size bins, validates each of 12
SI/mixer/model PSD arrays and reported CI columns, checks volume-% normalization,
validates PO4-P time axes and explicit missingness, and rejects
attempts to label simulations as physical observations.

## Scientific interpretation and strict comparison gate

**We distinguish four provenance groups:**

| Source PSD group | Origin | Interpretation |
|---|---|---|
| R measured | experimental | Fitting-side R average PSD, not independent model holdout |
| R optimized | simulated | Kinetic-parameter-optimized model PSD |
| IJ measured | experimental | Source-labeled validation set of IJ PSDs |
| IJ Galbraith | simulated | Baseline/reference Galbraith-parameter model, **NOT** a prediction by the newly optimized R parameters |

The Research Studio plots **two descriptive curve pairs**: observed R versus
published optimized model, and observed IJ versus published Galbraith model.
We report the sum of absolute differences in **volume percentage points per
source-size bin**, not particle count, PBE mass, number density or
true predictive holdout score. For an independent test of the optimized
model, an actual **optimized-parameter IJ prediction** and complete physical
experiment protocol are required.

R experimental PO4-P time samples start at 55 minutes, while simulations
start at 0 minutes. **No silent interpolation/alignment or fictitious RMSE**
is performed.

- Vol % is **volume-based** distribution, not number-based PBE n(L); a
  unit/moment conversion requires explicit, independently validated particle
  shapes, size-bin definitions and weighting conventions.
- Reported CI columns are stored **as-is**; no assumption that CI is a
  symmetric half-width, standard error or independent replicate variability.
- Source labels / workbook SHA establish transcription and byte-level
  reproducibility, **not** independent verification of laboratory devices,
  published kinetic laws, uncertainty protocols, crystal phases or license.
- Mendeley Data landing page was previously identified as **CC0 1.0**;
  the uploaded ZIP contains **no license text**. Independent rights
  confirmation is still recommended before including raw Excel/other
  publisher works in a release.
- The educational \`src/lib/pbe-upwind.ts\` solver and all actual
  crystallizer physics remain **unchanged**.

Next: independent held-out predictions, explicit source protocol and real
calibration of G(S,T), J(S,T), plus volume-distribution consistent PBE
observations. Nothing here establishes industrial control readiness.
