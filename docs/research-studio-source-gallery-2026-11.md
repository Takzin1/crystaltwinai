# Source evidence gallery and visual research studio — November 2026

## Curated data from BigSolDB v2.1 (secondary compilation)

We inspected the public **BigSolDB v2.1 Hugging Face table viewer**
https://huggingface.co/datasets/levakrasnov/BigSolDBv2.1
and transcribed **21 visible rows** into two source-native Research
Schema v2 datasets:

| Compound | Solvent | Original reported source DOI | Rows | T range (K) | Units |
|---|---|---|---:|---|---|
| Succinic acid | ethanol | 10.1007/s10953-012-9951-z | 12 | 278.15–333.15 | mole fraction |
| Isoimperatorin | ethanol | 10.1007/s10953-012-9917-1 | 9 | 288.20–328.20 | mole fraction |

The Hugging Face dataset reports **CC BY 4.0** for the compiled
BigSolDB dataset; include attribution to its compilers (Krasnov, L.,
Malikov, D., Kiseleva, M., Tatarin, S., Sosnin, S., Bezzubov, S.)
and Krasnov et al. (2025), Scientific Data 12, 1236,
https://doi.org/10.1038/s41597-025-05559-8.

The original DOI represents the article named in BigSolDB's
**Source** column. Original articles, instrument data, sample solid
phase/polymorph, replication protocol and original-article rights
were **not** independently authenticated. These file samples omit
\`sourceFileSha256\`: they are manually cross-checked against the
published viewer, not an authorized full 19.7 MB upstream file.

Research Schema \`provenance: "measured"\` denotes **literature-reported
measurements in a secondary compilation**, not independent evidence
of raw measurements. Keep these values segregated from the toy g/mL
simulator and synthetic PBE, and do not infer kinetic validity.
A deterministic regression test pins all 21 source-native values,
temperatures, DOIs, units, and unverified status.

## Investigated but *not imported*

- University of Strathclyde, Pickles et al. (2026), **Lovastatin**
  solubility, growth and nucleation:
  https://pureportal.strath.ac.uk/en/datasets/data-for-benchmarking-model-based-design-of-experiment-approaches/
  DOI \`10.15129/39b0828f-082a-4e71-88a1-f0d67aab4375\`.
  **CC BY-NC-ND** as published. Do not redistribute or embed
  modified copies without appropriate authorization; original method
  and permitted analysis/reuse must be reviewed.
- Zenodo, **Zeolite in-situ Raman / ex-situ XRD**, DOI
  \`10.5281/zenodo.18972297\`, with accessible NeXus file list.
  Exact license conditions and measurement schema require a separate
  review. Spectra are not particle-size distribution labels.
- Strathclyde **PharmaCrystNet crystallisation kinetics** dataset,
  DOI \`10.5281/zenodo.20816635\`, remains **embargoed until
  2027-06-01** according to its Zenodo record. Do not describe it
  as currently downloadable.

## UI design and access

The research studio uses a dark laboratory visual system with a
compact brand, prominent study-scope warning, responsive section
navigation, clear distinction between educational/synthetic outputs
and source-based research observations, touch-friendly controls and
keyboard focus states. A source gallery shows real published-viewer
sample values and a chart with clear numeric unit labels.

Design references:
- University of Washington, *Making data visualizations accessible*:
  https://www.washington.edu/accesstech/dataviz/
- UK Government Analysis Function, dashboard design and accessibility:
  https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-testing-dashboards-for-design-and-accessibility/

The chart uses a visible line and point marks, plus downloadable
source JSON. No color-only interpretation of forecast validity;
\`prefers-reduced-motion\` and forced-colors controls are respected.

## Demo/video truth-in-advertising

Any self-generated promotional animation or static design mock shown
without a live product capture must be labeled **concept visualisation,
not runtime recording**. Do not imply experimentally validated crystal
growth or physical equipment performance. The browser app itself
remains educational/research/PoC use only and never controls equipment.

## Next acceptance tasks

- Obtain original BigSolDB exact bytes in a permitted environment;
  match source Git blob and calculate SHA-256 before using full-file
  derived subsets (#32).
- Verify full source DOI metadata, chemical identity, experiment
  protocols, crystal phase, and intended uses before model validation.
- Add independent measured kinetics/PSD only after raw-data rights and
  comparability checks.
