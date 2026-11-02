# Third-party data, attribution and source integrity / 外部データ利用方針

**Code:** CrystalTwinAI source is distributed under [MIT](LICENSE).
**External observations:** The software license **does not** automatically relicense third-party research data, source papers, assets or measurement records.

## Included BigSolDB v2.1 literature-compiled observations

The dataset publisher states **Creative Commons Attribution 4.0 (CC BY 4.0)** for BigSolDB v2.1:
https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1

Attribution:
- Dataset: **BigSolDB v2.1**, compilers Krasnov and collaborators.
- Publication: Krasnov et al., *Scientific Data* 12, 1236 (2025), https://doi.org/10.1038/s41597-025-05559-8.
- License: https://creativecommons.org/licenses/by/4.0/
- Changes: Selected and reformatted individual literature-compiled records into CrystalTwinAI **Research Schema v2 JSON**, retaining native K and mole-fraction quantities and original article DOI. The files are subsets, **not** exact copies of the complete CSV.

The following records are supplied as a documented small **derived subset**:

| Compound | Solvent | Records | Original-paper DOI | Local data |
|---|---|---:|---|---|
| Paracetamol | ethanol | 5 | 10.1007/s10953-005-9007-8 | `public/examples/bigsoldb21-paracetamol-ethanol.measured.json` |
| Succinic acid | ethanol | 12 | 10.1007/s10953-012-9951-z | `public/examples/bigsoldb21-succinic-acid-ethanol.measured.json` |
| Isoimperatorin | ethanol | 9 | 10.1007/s10953-012-9917-1 | `public/examples/bigsoldb21-isoimperatorin-ethanol.measured.json` |

**Scope:** The 26 records above were cross-checked against the published compilation/viewer as disclosed in the respective source documentation. Original raw laboratory files, experimental solid forms, independent reproduction, source article usage rights, published uncertainty and validation of PBE kinetics have **not** been independently authenticated. File-local `provenance: measured` describes a *secondary literature report*, not verified instrument output.

## Source CSV identity (full file NOT distributed)

- **v2.1** author GitHub `levakrasnovs/mcp-bigsoldb`, commit `a29e91061dc2d3d543343c5cd2cdd5e539165915`, file `BigSolDBv2_1.csv`, **19,675,205 bytes**, Git blob SHA-1 `4a6f2af6819507bae9cfd690e927fe349927d8c5`.
- **v2.2** author GitHub `levakrasnovs/BigSolDBv2.0`, commit `6a6072d6825112c7d55e79c03ceb724739d956ab`, file `BigSolDBv2.2.csv`, **24,678,209 bytes**, Git blob SHA-1 `0108873f585dae3700923367b59030e002ac71f5`.

The Git SHA-1 and lengths above were **rechecked against official upstream Git trees**. The complete CSVs were **not fetched and transformed end-to-end** in this environment. Their full-file SHA-256s, actual full-file headers, and original lab protocol mappings remain **unverified**. The supplied local import scripts enforce Git blob checksum and byte length *before* parsing and calculate an independent input-file SHA-256 on successful conversion. Git blob identity binds to a source revision, not scientifically verified measurements.

BigSolDB **v2.2 full-file redistribution license** is not separately authenticated here. No v2.2 original records are bundled. Do not imply a file imported from v2.2 is CC BY 4.0 solely on the basis of v2.1's license.

## External links only — NOT redistributed

- Lovastatin Strathclyde primary experiments: original portal labels **CC BY-NC-ND**; this repository links only. Request authorization before distributing derivatives; review experimental metadata.
- Zenodo zeolite Raman/XRD: terms and applicability pending review.
- Do not silently use Raman/XRD values as particle-size distribution reference observations.

## Required when adding more source measurements

Document **publisher/source URI, source commit/checksum, author attribution, license, DOI, chemical identity, polymorph/solid phase if known, native units, method, measurement precision, transformations, training/holdout split and unresolved validation gaps**.

Use `unverified` where measurements are not sourced; never label a new numerical simulation as a measured experiment. Never repackage an original full dataset without a rights review.
