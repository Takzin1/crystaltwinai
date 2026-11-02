# Lovastatin evidence — strict local XLSX import and leakage-aware evaluation

Original public source: [University of Strathclyde, Data for benchmarking model-based design of experiment approaches](https://pureportal.strath.ac.uk/en/datasets/data-for-benchmarking-model-based-design-of-experiment-approaches/).

## Uploaded original files actually inspected

The user provided three XLSX workbooks, each with precisely one worksheet \`Sheet1\`, and columns:

\`\`\`text
Experiment | Time | Measured values | Predicted values | Standard deviation
\`\`\`

| Workbook | SHA-256 of uploaded XLSX bytes | Rows | Experiment IDs |
|---|---|---:|---:|
| growth | \`507dbcfd45d4db149a19f5c33cbc6d2a27879007a16193877ae39f30ed0f3594\` | 37 | PICKL73/75/78/86/89 |
| primary | \`91130c164d5c47af854cb3385422353863f79989bb3743de69eba4b1496b4618\` | 38 | PICKL80/83/84/85 |
| secondary | \`2b478e12fdaf13a54c6c3d53921915a7e80d027df7d03830c0d3bcffcf5f06a5\` | 75 | PICKL72/73/74/75/76/77/78/86/87/89/90 |

**150 row observations, 15 unique experiment IDs across all books**.
Original worksheet cells provide NO measurement units, time unit, chemical
concentration definition, replicate protocol, training/holdout label or
justification for interpreting the Standard deviation field. Never infer
these from time magnitude or file names. The workbook titles suggest growth,
primary and secondary **categories**, not independently verified mechanisms.

### Critical train/evaluation leakage

\`growth\` and \`secondary\` overlap on **PICKL73, PICKL75, PICKL78,
PICKL86, PICKL89**. \`primary\` and \`secondary\` have no ID overlap.
The remaining six \`secondary\` IDs are *candidates* for a physically independent
experiment-level holdout: PICKL72, PICKL74, PICKL76, PICKL77, PICKL87,
PICKL90. However, even these are **not certified** as holdout predictions
because we have not checked which runs/parameters were used to generate
the workbooks' existing \`Predicted values\` column. **Do not treat the
aggregate secondary file as an independent validation dataset.**

## Rights boundary

The university public record was previously identified as
**CC BY-NC-ND**; the three workbook files do not include a separate,
independently verified permission to republish modified/normalised copies.
Therefore:

- No source Excel bytes, measurement rows, or source predicted rows are
  added to this public repository or its GitHub Actions artifacts.
- The only published evidence is the **metadata-only** SHA-256, experiment
  identity overlap, row counts and descriptive published-prediction
  error metrics in \`public/provenance/lovastatin-source-audit-2026-11.json\`.
- The workbooks and full imported JSON stay with the user. If it becomes
  necessary to release adapted measured data, obtain explicit permission
  and check license compatibility first.

## Local reproducible conversion (offline)

The CLI is written using Python's standard library only and has **zero
new npm/Python dependencies**.

\`\`\`bash
python3 scripts/import_lovastatin.py \
  --growth /private/lovastatin_gFP_MV_growth.xlsx \
  --primary /private/lovastatin_gFP_MV_primary.xlsx \
  --secondary /private/lovastatin_gFP_MV_secondary.xlsx \
  --out-local private-research-data/lovastatin-local-evidence.json \
  --manifest artifacts/lovastatin-private/lovastatin-metadata.json
\`\`\`

The importer requires the **exact three SHA-256 digests** above.
It fails closed on modified XLSX bytes, unexpected headers/sheets,
macros/external links, formula cells, missing values, negative values,
nonpositive standard deviation, duplicate or non-increasing times
*within the same experiment*, inconsistent source row counts and
unrecognized \`Experiment\` identifiers.

\`--out-local\` is deliberately optional; if specified, the local-only
JSON is written with restricted permissions and is **gitignored**.
The optional manifest omits all measurement and prediction series;
private output paths are gitignored.

**Research UI:** Under "Data comparison" -> "Lovastatin", select
the local JSON file using the browser file picker. It is parsed in browser
with strict row-by-row validation and reconstructed experiment-overlap
audit; no network upload, no integration into the educational simulator.
You can switch workbook and experiment to see the original measurement
trace vs the already-published prediction and compute MAE, RMSE, signed
bias and standardized residuals (descriptive only).

## Calibration / predictive evidence *not* provided

- No new optimized growth or nucleation parameters, no fresh simulation.
- No PBE source terms or thermodynamic dynamics fitted.
- No independently authenticated units, standard deviation semantics,
  paper-method metadata, solid form, solubility or apparatus conditions.
- No certified prospective/independent model holdout metrics.
- The original \`Predicted values\` remain **source-reported model outputs**
  and are never labeled as a prediction by CrystalTwinAI.

Next: obtain and inspect the experiment-condition map and the source
authors' training/validation protocol; fit only disjoint experiment IDs
and run the *new* model on genuinely held-out complete experiments.
