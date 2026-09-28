# CrystalTwinAI benchmark contract

Benchmark metrics are fixed before model tuning. A claim is only comparative when both systems are evaluated under the same public data, hardware assumptions, and reproducible procedure.

## Surrogate

Report per field and for key surface metrics:

- RMSE
- NRMSE
- MAE
- R²

## Runtime

- p50 / p95 / p99 latency
- cold and warm latency
- batch size
- throughput (samples/s)
- GPU-seconds per prediction
- cost per 1,000 decisions when measured on Nebius

## Optimization

- normalized regret
- constraint-feasible rate
- hypervolume for multi-objective tasks
- Pareto dominance summaries

## Safety

- unsafe_proposal_rate_before_guard
- unsafe_execution_rate_after_guard
- guard_false_positive_rate
- guard_false_negative_rate
- maximum and mean constraint violation magnitude

## Uncertainty

- 90% / 95% empirical coverage
- calibration curve
- NLL and/or CRPS where applicable

## Robustness and OOD

- degradation by synthetic sensor-noise level
- ID versus OOD furnace degradation
- Furnace A train / unseen-A validation / held-out-region test / Furnace B-C OOD test

Do not randomly split adjacent snapshots from the same CFD trajectory across train and test.

## Reproducibility metadata

Every benchmark run must record:

- Git SHA
- dataset version and checksum
- solver and OpenFOAM version
- Docker image digest
- CUDA version
- GPU model
- random seed
- model checkpoint SHA
- prompt version
- property-file SHA

Target developer interface:

```bash
make benchmark
make benchmark-quick
```
