# DOE → OpenFOAM materialization boundary

CrystalTwinAI intentionally separates **design generation** from **physical
materialization**.

```text
normalized DOE
    ↓
property provenance gate
    ↓
control-map provenance gate
    ↓
case package materialization
    ↓
OpenFOAM solver execution      ← not yet enabled as scientific output
    ↓
conservation checks
    ↓
normalized dataset artifacts
```

## Production gates

A production materialization requires:

1. all required material properties marked `VERIFIED_PRIMARY_SOURCE`,
2. all normalized-to-physical control mappings marked
   `VERIFIED_PRIMARY_SOURCE`,
3. exact source locators and units,
4. Furnace-specific geometry/boundary configuration.

## Current limitation

Only the Furnace A axisymmetric case-package scaffold exists. Furnace B/C are
reserved for OOD evaluation and are intentionally blocked until separate
geometry templates and source-backed boundary conditions are implemented.

## CI behavior

CI uses explicit nonphysical fixtures to test plumbing. Those fixtures cannot be
used in production mode and must never be cited as scientific data.
