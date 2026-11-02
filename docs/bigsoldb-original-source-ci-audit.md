# BigSolDB original-source byte and metadata audit (CI)

This opt-in/repository-change-triggered science workflow downloads **four source files into a temporary GitHub Actions runner**, checks their **exact bytes** and **public independently published checksums**, validates row counts and column order, and executes the existing v2.1/v2.2 conversion routines on genuine records. It **never adds raw CSVs or original measured rows to Git, GitHub Actions artifacts or public releases**.

## Authoritative public references

- BigSolDB v2.1, original upstream `levakrasnovs/mcp-bigsoldb` commit `a29e91061dc2d3d543343c5cd2cdd5e539165915`; `BigSolDBv2_1.csv`, 19,675,205 bytes, Git blob SHA-1 `4a6f2af6819507bae9cfd690e927fe349927d8c5`. **Independently published SHA-256** from the author's [Hugging Face file pointer](https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1/blob/main/BigSolDBv2.1.csv): `212cb511e05051917f7ab8811282c06c99512e4f720cf270be555fdf07b4a854`. Dataset compilation declares **CC BY 4.0**; original papers' reuse status is not independently verified.
- BigSolDB v2.2 GitHub main CSV `levakrasnovs/BigSolDBv2.0` commit `6a6072d6825112c7d55e79c03ceb724739d956ab`; `BigSolDBv2.2.csv` 24,678,209 bytes, Git blob SHA-1 `0108873f585dae3700923367b59030e002ac71f5`. Independent checksum from official [Zenodo record 22648301](https://zenodo.org/records/22648301): MD5 `a1e12ae9575319ac4f89fea6a63a6422`.
- The author GitHub tree contains the v2.2 **main CSV** but not the **methods** and **solid_forms** tables. These companions are downloaded separately from the author Zenodo record and verified against the publication's MD5 values:
  - `BigSolDBv2.2_methods.csv`: `4e7a688055d0e8ebf4c8c3a202b29b7c`
  - `BigSolDBv2.2_solid_forms.csv`: `3a077abad5373f52341f7915a9a38757`

MD5 is used only to compare Zenodo published identifiers; SHA-256 is calculated for *all* received bytes and preserved in the audit manifest. It is **not a cryptographic signature of experiment authenticity**.

## Strict acceptance gates

1. Match the two full Git byte sizes and Git blob SHA-1 hashes; v2.1 must also match independently published HF SHA-256, v2.2 the Zenodo MD5.
2. Match the two companion file MD5 checksums with Zenodo's published values.
3. Parse each full CSV and require the precise published column names and order, **112,465 / 125,752 / 1,842 / 2,295 rows** (v2.1 / v2.2 / methods / solid forms).
4. Execute `convertBigSolDB21` over the genuine v2.1 Paracetamol/ethanol DOI slice; compare its five source-native K/mole-fraction observations to the previously public-checked sample.
5. Select a nonblank, chemically consistent, single-DOI/solvent/solid-form v2.2 group with 5–1000 rows; invoke the **original-byte-attested v2.2 converter**, then compare every output K/mole-fraction observation against the matching original CSV row (strict no-conversion equality).
6. Attempt the source protocol join against **actual separately downloaded and hash-verified** methods / solid-forms CSV files. No invented form/method metadata; the end-to-end check fails if no exact companion match is found within a bounded group search.
7. Write a **metadata-only** JSON attestation for reproducibility; include unverified licensing and experimental boundaries.

## How to run

GitHub Actions: **Scientific original-source byte audit** (PRs touching the audit, changes to main or manual workflow dispatch). The report artifact is `bigsoldb-original-source-audit`.

Local with downloaded, permitted, exactly pinned files:

```bash
npm ci
npx tsx scripts/audit-bigsoldb-raw.ts \
  --v21 /tmp/BigSolDBv2_1.csv \
  --v22 /tmp/BigSolDBv2.2.csv \
  --methods /tmp/BigSolDBv2.2_methods.csv \
  --forms /tmp/BigSolDBv2.2_solid_forms.csv \
  --out artifacts/research-provenance/bigsoldb-original-bytes-audit.json
```

No automatic direct original-source download occurs in the library or public research UI.

## Explicitly NOT verified

- Provenance of the *original laboratory* samples, original article measurements, replicates, polymorph interpretation, source article license and scientific uncertainty.
- Scientific reproducibility/accuracy of PBE growth rates, nucleation, crystals, solubility mechanism or thermodynamic physical model.
- BigSolDB v2.2 dataset **redistribution rights**: the record page did not expose an independently verifiable license value in the current reading. Do not substitute v2.1's CC BY 4.0 for v2.2's terms.
- The real PSD/crystal-kinetic experiments needed to evaluate a crystallization model.

**Only successful live GitHub Actions jobs and their attached reports establish that the complete original CSV bytes were processed.** A pinned URI or committed workflow alone is not successful execution.
