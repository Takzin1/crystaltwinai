# Physics layer

The physics layer will generate the reproducible synthetic data used by the SiC surrogate.

## Fidelity strategy

### Stage A — inexpensive DOE
- 2D axisymmetric / coarse cases
- large parameter sweep
- surrogate pretraining
- fast regression checks

### Stage B — high-fidelity correction
- selected 3D sector or full-3D cases
- high-value operating points
- benchmark gold set
- OOD furnace configurations

## Planned canonical outputs

Each case should be normalized into:

```text
metadata.json
fields.zarr
sensors.parquet
metrics.json
```

Field schema is expected to include, when physically available:

- temperature `T(x,y,z,t)`
- velocity `Ux/Uy/Uz(x,y,z,t)`
- carbon concentration `C(x,y,z,t)`
- interface carbon flux `Jc(surface,t)`
- heat flux `q(surface,t)`

## Scientific integrity rule

No material property may be populated from memory. Unknown values stay null and blocked until a primary source is recorded in the property manifest.
