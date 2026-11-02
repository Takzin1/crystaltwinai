# BigSolDB v2.2 — Git-blob-pinned, provenance-gated intake (2026-11)

## Source provenance verified from the official GitHub repository

The dataset author's public repository is
https://github.com/levakrasnovs/BigSolDBv2.0
at commit **6a6072d6825112c7d55e79c03ceb724739d956ab**.

The Git tree lists:
- BigSolDBv2.2.csv
- **24,678,209 bytes**
- Git *blob* SHA-1: **0108873f585dae3700923367b59030e002ac71f5**

The authors' README reports **125,752 experimentally sourced records**,
**1,627 compounds, 221 solvents, and 1,842 peer-reviewed articles**.
These are the authors' repository statements, not independently replicated
source-paper verification. Cite
Krasnov et al., *Scientific Data* 12, 1236 (2025),
https://doi.org/10.1038/s41597-025-05559-8,
and the source GitHub repository as relevant.

The file is **NOT embedded** in this repo. The session verified its Git
object identifier and byte size from the official public GitHub API, but
did **not** retrieve all 24.7 MB or inspect its full header and methods.
The adapter therefore requires observed column names and explicitly
selected protocol/form mapping, and refuses missing mandatory columns.
The source repository's README did not provide a readily verified
redistribution license; no license is asserted in derived metadata.
Do not redistribute the full original without an appropriate rights review.

### Local conversion

Obtain the file directly from the pinned original commit:

https://raw.githubusercontent.com/levakrasnovs/BigSolDBv2.0/6a6072d6825112c7d55e79c03ceb724739d956ab/BigSolDBv2.2.csv

Then run:

\`\`\`bash
npx tsx scripts/import-bigsoldb22.ts \
  --source ./BigSolDBv2.2.csv \
  --compound "EXACT_COMPOUND_NAME" \
  --solvent "EXACT_SOLVENT_NAME" \
  --doi "10.xxxx/original-paper" \
  --out ./selected-bigsoldb22-research-v2.json
\`\`\`

If the source CSV has explicit technique and crystal-polymorph columns,
inspect the **actual source header** then specify their literal names:

\`\`\`bash
npx tsx scripts/import-bigsoldb22.ts \
  --source ./BigSolDBv2.2.csv \
  --compound "EXACT_COMPOUND_NAME" \
  --solvent "EXACT_SOLVENT_NAME" \
  --doi "10.xxxx/original-paper" \
  --method-column "ACTUAL_METHOD_HEADER" \
  --solid-form-column "ACTUAL_SOLID_FORM_HEADER" \
  --out ./one-protocol-one-solid-form.json
\`\`\`

If multiple method / solid-form values occur in selected rows, the
converter **refuses to combine them**. Select a single exact
\`--method-value\` / \`--solid-form-value\` and rerun. If the extra
columns are absent or unconfirmed, no method or solid form is invented.
A method mapping is not an external verification of experimental protocol.
The converter must have at least 5 distinct temperatures within a
single chemical identity, solvent, source DOI and selected protocol/form;
otherwise it refuses to fit/evaluate.

### Actual integrity gate

The command computes Git's object hash over the **exact bytes**:
\`\`\`text
SHA-1("blob " + size + NUL + bytes)
\`\`\`
and checks both size and Git blob SHA-1 against the public source-revision
fingerprint before any scientific parsing. A separate full-byte SHA-256
is computed and saved in \`sourceFileSha256\` for future re-verification.
The Git blob hash is not an independent publisher signature and SHA-1
is not collision-resistant by current cryptographic standards; it is
an accidental-modification detection and revision-binding gate, not
proof of laboratory measurement provenance.

The research schema preserves native
**Kelvin / solute mole fraction** without conversion to \`g/mL\` or
\`mol/L\`; mixed identities, missing source DOIs, duplicate temperatures,
unknown/fabricated columns, invalid numbers and ambiguous protocols fail
closed. The output's \`provenance\` remains **unverified** even after the
file fingerprint matches. \`measurementMethod\` and \`solidForm\` fields
record precisely the *source column declarations* with no physical
verification implied.

The existing educational crystallization dynamics are **never**
recalibrated automatically. You can inspect/export the resulting JSON
through the Research Dataset UI. Compatible equilibrium curves can be
evaluated separately by the simple interpolation/holdout component;
nothing here is a kinetic or PBE benchmark.

### Verification performed

The included automated tests use a small **synthetic CSV fixture**
with 14 declared columns to exercise missing/ambiguous method and
polymorph, invalid/duplicate values, transformed output and
provenance guardrails. This CI test is **not** an actual 125,752-record
integration run: the official original file must be obtained and
checked separately. Do not label all-record import as completed
before a real-file test passes on that exact upstream Git object.

Future science requirements:
- cross-check original paper's experimental conditions and license,
- distinguish temperature and method provenance, sample vs bath,
- determine chemical solid phase, polymorph transitions and replicates,
- compare independently measured holdout on compatible observables,
- attach article/reagent/instrument evidence and error estimates.

No equipment control, calibration or validation claims.
