# Research basis

This directory is the evidence layer for the Hackathon-era CrystalTwinAI rewrite.

## Governing principle

CrystalTwinAI must not infer or reproduce proprietary manufacturing know-how. The project only uses:

1. public primary literature and official public documentation,
2. datasets with explicit provenance and license status,
3. independently generated synthetic data, and
4. clearly marked engineering proposals.

Every implementation claim should be classifiable as one of:

- **FACT** — directly supported by a cited public source;
- **DERIVED** — reproducible calculation from public inputs;
- **PROPOSAL** — CrystalTwinAI engineering choice;
- **UNKNOWN** — intentionally unresolved until a primary source is verified.

## Baseline research report

Design decisions in this branch are initially guided by the 2026-09-28 research report:

> CrystalTwinAIを「Open Agentic Digital Twin for SiC Growth」へ引き上げるための公開技術・データセット調査報告

The report's core implementation direction is:

```text
OpenFOAM / Physics
        ↓
Synthetic SiC CFD Dataset
        ↓
Surrogate + Uncertainty
        ↓
State Estimator
        ↓
Agent Planner
        ↓
Deterministic Constraint / Safety Verifier
        ↓
Virtual Actuator / HIL
        ↓
Synthetic Sensors
        └──────────── feedback
```

The report is an engineering research input, not a substitute for the underlying primary sources. Numerical physical properties remain blocked until individually verified.

## Required research artifacts

Planned artifacts:

- `source-manifest.yaml` — primary-source provenance
- `patent-landscape.csv` — public patent mapping
- `decision-log.md` — architecture decisions and evidence
- dataset manifests under `/datasets/manifests/`
- property provenance under `/physics/properties/`

## Non-goals

- reconstructing a specific company's undisclosed process conditions;
- claiming superiority without a shared reproducible benchmark;
- filling missing physical properties from memory or uncited secondary sources.
