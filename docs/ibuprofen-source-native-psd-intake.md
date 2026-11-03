# Ibuprofen micronanoparticles — full XLSX source-native PSD intake (2026-11)

## Source and exact original-file provenance

User-provided ZIP: \`Particle size distribution data of ibuprofen micro.zip\`.
Contains one workbook:
\`Particle size distribution data of ibuprofen micronanoparticles.xlsx\`.

Published landing page:
https://data.mendeley.com/datasets/kzn8b86gvg/1

- ZIP SHA-256: \`f4415166435662c3d5da98c60c3cb72f2fe263b6961d29add24abaf7750e8975\`
- XLSX SHA-256: \`5e427f49ecbce2121fe9f58877d7d25a60d580f213847493f6014c67f66e25da\`
- Committed losslessly compressed **sparse** normalized JSON SHA-256:
  \`716612c990d7b4a9f1e31616d9c356ba448bdf99548fed44f565a8a807f9cbda\`
- All **142** original size-bin centers retained, from **0.20947417959189 nm**
  to **19095.4322284161 nm**, WITHOUT micron conversion or interpolation.
- Original sheet headings say \`Diameters(nm)\` and report per-bin percentages
  whose sum is 100 per observation. They **do not declare whether the
  percentages represent volume, count, DLS intensity, or another weighting**.
  CrystalTwinAI deliberately labels this **reported percentage per bin,
  weighting unverified**.

### Four worksheets imported

| Original worksheet | Combinations | Source-specific controls |
|---|---:|---|
| \`solvent composition\` | 9 | 0.05/0.1/0.3 g/mL ibuprofen × ethanol volume fraction 0/0.1/0.2 |
| \`cooling endpoint temperature\` | 6 | 0.1/0.3 g/mL × 25, 5, −5 °C |
| \`liquid film thickness\` | 4 | Original numeric headings 55.4, 176.8, 353.6, 707.2 (**unit absent from worksheet**) |
| \`liquid film diameter\` | 4 | 2/4/6/12 cm |
| **All conditions** | **23** | **17 unique numeric curves** |

The main sheet categories are **conditions / source-supplied end-state
size distributions**; no time-aligned PSD trajectories or kinetic rate
constants are present.

Identical numerical distributions occur in **four cross-sheet sets**, so
the 23 condition entries are **not** 23 independent experimental replicates:

- \`solvent-c10-e10\` = \`cooling-c10-t5\`
- \`solvent-c30-e10\` = \`cooling-c30-t5\` = \`thickness-176_8\` = \`film-diameter-6cm\`
- \`thickness-55_4\` = \`film-diameter-4cm\`
- \`thickness-353_6\` = \`film-diameter-2cm\`

At \`liquid film thickness\` / 707.2, the original last bin
(19095.4322284161 nm) is **blank**. It is explicitly stored as
\`null\`, **not** zero or an estimated value. Percentage sums remain 100.

### Storage format

\`public/examples/ibuprofen-psd-sparse-v1.json.gz.base64\` stores a
deterministic gzip/Base64 original-value transcription:

- 142 floating-point diameter centers, in original nm.
- 17 unique numeric distributions with all original nonzero values and
  precise cell indices.
- Explicit list of missing source-cell indices; all other omitted cells
  **really contain source value 0**.
- 23 mapped experiment conditions with worksheet and 1-based original
  Excel column numbers.

No original ZIP or XLSX binaries are committed; no numbers are
rounded or resampled. A SHA-256 fingerprint pins the normalized source
data. Frontend fetches, decompresses in the browser, verifies SHA-256,
checks each source distribution sums to 100, and refuses modified or
incompatible schemas.

## Reproduce the exact observations

\`\`\`bash
npm ci
npm run typecheck
npm test
npx tsx scripts/expand-ibuprofen-evidence.ts \
  --out artifacts/ibuprofen/ibuprofen-observations-expanded.json
npm run build
\`\`\`

The CLI expands each source-condition curve to exactly 142
\`number | null\` entries, never replacing the explicit missing cell.
The Research Studio panel presents a logarithmic **nm** axis,
condition-family/condition selectors and same-family source-curve
comparison. The descriptive 50%-cumulative crossing is only
**a reported-percent-bin crossing**, not a validated particle-number
median D50, mass/volume median or physical-materials model parameter.

### Scientific and legal boundaries

- **This is a recorded distribution observation import**, not evidence
  that CrystalTwinAI estimated kinetic rates or produced genuine
  experimental holdout predictions. No time-series PBE fitting occurs.
- No claim that the current PBE size-density (particle number per µm)
  is directly compatible with these unknown-weight percentages. Do not
  compare absolute numeric PSD heights against number-based PBE until
  weighting and bin conventions are authenticated.
- Exact reused distributions are acknowledged and are not counted as
  independent test experiments.
- The previous source listing identified **CC BY 4.0** for this Mendeley
  dataset; its attached ZIP/workbook has no embedded license declaration,
  and that listing was not rechecked in this offline audit.
  The project includes only source-attributed numerical transcription,
  not source archive binaries. Reconfirm publisher attribution/rights
  before commercial derivative redistribution or dataset packaging.
- Particle polymorph, size measurement instrument, weights, experiment
  replication/uncertainty and exact kinetics must be verified with the
  primary study before physical prediction claims.
