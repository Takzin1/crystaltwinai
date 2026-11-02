# Published BigSolDB v2.1 reference — source-native solubility and holdout

## What is included in this pull request

- **Five published experimental-origin records** for paracetamol (CAS
  103-90-2) dissolved in **ethanol**, transcribed from the BigSolDB v2.1
  Hugging Face tabular viewer, preserved as equilibrium solubility in
  **mole fraction** at 293.15, 298.15, 303.15, 308.15 and 313.15 K.
- Bundled subset:
  `public/examples/bigsoldb21-paracetamol-ethanol.measured.json`.
  This is an openly reviewable, derived subset, **not** original instrument
  data, the entire BigSolDB dataset or an authenticated copy of the paper.
- A source-native *reference curve* evaluation, with lower three temperatures
  used to fit a simple linear least-squares baseline and two higher
  temperatures held out for **extrapolation**. A constant-training-mean
  predictor is included to prevent interpreting small errors without context.
- An optional **offline full-file converter** for BigSolDB v2.1, with a
  pinned SHA-256 from the dataset publisher's Hugging Face repository,
  strict same-compound/same-solvent/same-source filtering, and no implicit
  concentration-basis conversions.
- Transparent source, DOI, license, measurements, and limitations in the UI.

## Exact published rows (no unit conversion)

| Temperature K | Solubility (solute mole fraction) |
| --- | --- |
| 293.15 | 0.05045 |
| 298.15 | 0.05460 |
| 303.15 | 0.06200 |
| 308.15 | 0.06700 |
| 313.15 | 0.07050 |

**Original article DOI in the BigSolDB `Source` column:**
https://doi.org/10.1007/s10953-005-9007-8

**Dataset of compilations:** Krasnov L., Malikov D., Kiseleva M.,
Tatarin S., Sosnin S., Bezzubov S. *BigSolDB 2.0, dataset of solubility
values for organic compounds in different solvents at various
temperatures*, *Scientific Data* 12, 1236 (2025).
https://doi.org/10.1038/s41597-025-05559-8

**Open original compilation:** https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1
and archived version https://doi.org/10.5281/zenodo.18552681 .

**License of the Hugging Face BigSolDB v2.1 dataset:** CC BY 4.0
(https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1).
This license statement applies to the listed dataset compilation.
The underlying source article may have separate reuse rules. Preserve
attribution and do not claim we verified the article's raw lab results.

### Evidence status

The curated subset was verified *against the visible table* on the data
publisher's page on 2026-11-02. The full BigSolDB CSV was **not** downloaded
or independently authenticated in this environment, so the bundled sample
deliberately omits `sourceFileSha256` and is explicitly a secondary
compilation. The converter pins the publisher-listed full file SHA-256:
`212cb511e05051917f7ab8811282c06c99512e4f720cf270be555fdf07b4a854`.
A successful local conversion produces a *new* derived subset with that
specific original CSV digest in `sourceFileSha256`.

## Offline expansion to more reference curves

1. Download `BigSolDBv2.1.csv` (19.7 MB) **yourself** from the publisher:
   https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1/resolve/main/BigSolDBv2.1.csv
2. Run the byte-verified conversion:

```bash
npx tsx scripts/import-bigsoldb21.ts \
  --source ./BigSolDBv2.1.csv \
  --compound Paracetamol --solvent ethanol \
  --doi 10.1007/s10953-005-9007-8 \
  --out ./paracetamol-ethanol-from-pinned-full-csv.json
```

It never downloads in code. Missing exact group, invalid row, changes
in CSV header/column count, duplicate temperature, mixed molecule SMILES,
nonfinite solubility, digest mismatch or output too large cause rejection.
Existing output files are not overwritten.

To expand, select another compound/solvent/DOI **without combining
articles or chemical species**. Generated research-v2 JSON is bounded to
1000 rows and can be imported via the existing Research Dataset panel.
No claim of independent laboratory replicate counts or solid-form identity.

## Evaluation semantics

For selected equilibrium curve data with **K or °C temperature** and
**mole-fraction solubility**, sort ascending by T. Fit *only* low-temperature
observations, reserving at least two (30%, rounded up) higher-temperature
observations as unseen high-temperature holdout. Report signed bias,
MAE and RMSE in **mole fraction** for the fitted straight line and an
unfitted constant *training mean* baseline.

Because training and holdout have *different* temperature ranges, this
is **out-of-range extrapolation**, not randomly assigned IID test
performance or proof of generalization to different solvents/materials.
It cannot validate the existing crystallization simulator, where its
illustrative solubility is in g/mL and other parameters are arbitrary.

Any downstream PBE or growth/nucleation comparison needs compatible
measured growth kinetics, known crystallographic solid phase, material
balance, units, temperature schedule, suitable laboratory replicates,
calibration, and independently held-out experimental trials. None of
those are established by this subset.

## BigSolDB v2.2 follows later, not automatically mixed

The newer v2.2 release https://doi.org/10.5281/zenodo.22648301
covers 125,752 records and includes separate methods and solid-phase
annotations. Its documentation warns its derived `mol/L` column is
computed per **litre of solvent**, not litre of final solution, so it
must never be auto-translated to g/mL of solution. This code imports
v2.1 mole-fraction observations only and intentionally rejects v2.2's
14-column format. Revisit v2.2 with a separately versioned data adapter,
protocol joins, provenance checks and license review.

## Testing

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Regression checks pin the five published numeric values, verify
training/holdout isolation (changing holdout must not alter training
coefficients), detect mixed chemical identities, reject hidden unit
conversion, corrupt CSV and duplicate-temperature groups.
