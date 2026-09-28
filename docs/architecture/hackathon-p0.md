# Hackathon architecture — P0

## Immutable pre-hackathon baseline

- Commit: `c4734be2d887b29b07fb20a70f84a2a3c6005c79`
- Baseline branch: `baseline/pre-hackathon-c4734be`
- Hackathon integration branch: `hackathon/physical-ai`

The baseline predates the Hackathon submission period and remains the reference point for documenting significant updates.

## Target architecture

```text
OpenFOAM / Physics
        ↓
CrystalTwin-SiC-Synth
        ↓
Surrogate + Uncertainty
        ↓
Synthetic Sensors
        ↓
State Estimator
        ↓
NVIDIA / Nemotron planning layer
        ↓
Deterministic Safety Gate
        ↓
Virtual Actuator
        ↓
Unity HIL / Virtual Furnace
        └──────────── feedback
```

Nebius-specific runtime code must remain behind an adapter boundary so the core simulator, tests, and safety logic can run locally without cloud credentials.

## P0 gates

1. CI and deterministic regression tests
2. research and dataset provenance
3. license-gated dataset registry
4. physical-property provenance with no guessed values
5. benchmark contract fixed before model tuning
6. minimal synthetic-data generator
7. surrogate baseline
8. synthetic sensor/state-estimation boundary
9. Nemotron runtime adapter
10. deterministic safety gate
11. Unity HIL adapter

## Safety invariant

The language-model layer may propose an action, but it must never directly actuate the environment.

```text
agent proposal → deterministic validation/clamping → actuator
```

A rejected proposal must fall back to a deterministic controller or no-op policy.
