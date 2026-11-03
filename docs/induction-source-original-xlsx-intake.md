# Source-native crystallization induction-time evidence — Excel intake

Original user-uploaded Excel: `cg_2022_001925_data_for_article.xlsx` from the [University of Strathclyde research dataset](https://pureportal.strath.ac.uk/en/datasets/data-for-machine-learning-derived-correlations-for-scale-up-and-t/).

- Original XLSX SHA-256: `0405f592a8cbb9f6d85b41db663c11d99699d795cd58aff3c194c01e2639b075`
- Normalized compressed evidence JSON SHA-256: `ddd39bb04189bd85e1e15c9752aeb4cc366712f90838742f3338e689102af708`
- Workbook: **nine worksheets** inspected; **three sheets** are imported into the read-only evidence panel: `induction times and parameters`, `hydrodynamic features`, `prediction - induction times`.
- **17 experiment conditions:** 14 original `training=y`, 3 original `training=n`. **131 induction-time replicates** total; 21 belong to the three source-labeled nontraining conditions.
- Vessels: EasyMax, OptiMax, Miniplant; original vessel, volume values, impeller RC/PBT, rpm, induction-time replicate samples and representative hydrodynamic features are retained exactly as source numbers.
- Five **author-reported** model parameter pairings for each nontraining condition: `J7+T8`, `J7+T9`, `J9+T8`, `J9+T9`, `J2+T2`. The source provides predicted **CDF probability values** beside empirical CDF; we do **not** independently reproduce the author's fit or derive kinetic constants.
- The OptiMax 630/RC/220 original induction replicate cells are *not sorted* (14990 precedes 14972), while the source's ECDF table is sorted. The importer preserves both as originally stated, never overwriting raw order.

## Assumptions not permitted

The uploaded workbook's relevant source column headers are `volume` and `induction times`, **without declared volume/time units**. The visualizations use "original source units" and do not assert mL or seconds. Original model parameters `J`, `tg`, reported `RMSE`, turbulence/flow descriptors and percentiles are likewise not given independently authenticated units or measurement protocols.

We do not represent source author's precomputed fits as predictions by CrystalTwinAI or treat original source training/test labels as independently replicated cross-laboratory validation. Validating nucleation physics requires experimental condition detail, instrumentation, polymorph/seed state, solubility, uncertainty, units, primary article and new pre-registered holdout predictions.

## Reproduce

```bash
npm ci
npm run typecheck
npm test
npx tsx scripts/expand-induction-source.ts --out artifacts/induction/source.json
npm run build
```

The static `public/examples/induction-times-source-v1.json.gz.base64` is lossless gzip/Base64 source-native JSON; the browser and CLI independently check its SHA-256, 17 experiment identities, 14/3 partition, raw observation counts, exact empirical CDF ranks, and five published CDF arrays. Invalid or tampered evidence fails closed. The original XLSX binary is not committed.

Original dataset listing has previously been identified as **CC BY 4.0**, but this offline session did not independently recheck the university's current license text; verify authoritative reuse terms and attribution before redistributing beyond the research context. The project embeds a small, fully attributed source-number transcription rather than the full original workbook. Source validity is **not** scientific reproducibility of lab experiments.
