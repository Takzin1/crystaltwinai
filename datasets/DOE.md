# CrystalTwin-SiC-Synth normalized DOE

This layer exists so dataset design can progress before source-verified SiC-TSSG
material constants and boundary conditions are available.

## Important

Generated rows are **design points only**:

```text
physical_validity = DESIGN_ONLY_NO_SOLVER_OUTPUT
```

They are not CFD results, not experimental observations, and not scientific
training data yet.

## Why normalized DOE first?

The hackathon pipeline can safely freeze:

- deterministic sampling,
- case identifiers,
- split policy,
- Furnace A/B/C OOD structure,
- manifest format,
- anti-leakage rules,

without inventing missing physical constants.

Once source verification is complete, each design point can be materialized into
a source-backed OpenFOAM case.

## Generate

```bash
python3 datasets/scripts/sample_design.py \
  --count 100 \
  --seed 42 \
  --output /tmp/crystaltwin-sic-design.jsonl

python3 datasets/scripts/validate_design.py \
  /tmp/crystaltwin-sic-design.jsonl
```

## Split contract

For the standard 100-case smoke design:

- 60% Train — Furnace A
- 15% Validation — unseen Furnace A design points
- 15% Test-ID — held-out Furnace A region/design points
- 10% Test-OOD — Furnace B/C

Future trajectory snapshots generated from one physical case must remain grouped;
they must never be randomly distributed across train/test splits.
