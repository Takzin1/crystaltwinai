# Source-verification plan

This milestone does **not** populate SiC-TSSG material constants yet.

The research report used to guide CrystalTwinAI explicitly notes that the full numeric property table was not completely extracted from primary sources. Therefore, a property may enter the production manifest only after the following are frozen:

- value and unit,
- primary source identifier,
- exact locator (table / equation / page / supplementary section),
- validity temperature range,
- validity composition range where applicable,
- uncertainty or reported error where available.

## Required properties

- melt density
- dynamic viscosity
- heat capacity
- thermal conductivity
- thermal expansion coefficient
- carbon diffusivity
- surface tension
- surface-tension temperature coefficient
- carbon solubility / equilibrium relation
- electrical conductivity
- solid SiC density

## Promotion rule

A property is promoted from blocked to production-usable only when:

```text
status = VERIFIED_PRIMARY_SOURCE
AND value != null
AND unit != null
AND primary_source_id != null
AND locator != null
AND validity metadata is present
```

Until then, OpenFOAM production case generation remains blocked.

## Next scientific step

Extract and verify the minimum property set and boundary conditions from primary literature and supplementary information, then create the first physically meaningful 2D axisymmetric smoke case.
