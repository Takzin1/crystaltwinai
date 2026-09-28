# OpenFOAM layer

This directory is the first executable scaffold for the SiC-TSSG physics pipeline.

## Current status

**Structural generator only. It is not yet a scientifically validated SiC solver.**

The project deliberately separates two questions:

1. can the repository deterministically generate and validate a case structure?
2. are the physical equations, material properties, geometry, and boundary conditions validated against primary sources?

This PR addresses (1). Production generation for (2) is blocked by the property gate until every required material property carries source provenance.

## Property gate

Production generation requires every material property to have:

- numeric value,
- unit,
- `status: VERIFIED_PRIMARY_SOURCE`,
- `primary_source_id`,
- source locator.

CI uses an explicitly marked `NONPHYSICAL_TEST_FIXTURE`. The fixture is rejected unless `--test-fixture` is passed and must never be used for scientific claims.

## Commands

Structural CI smoke test:

```bash
python3 -m unittest discover -s physics/tests -p 'test_*.py'
```

Once source-verified properties exist:

```bash
python3 physics/scripts/generate_case.py \
  --properties physics/properties/sic_tssg_verified.json \
  --output physics/openfoam/cases/example

python3 physics/scripts/validate_case.py physics/openfoam/cases/example
```

## Next physics milestone

The next milestone must source and freeze:

- actual material-property values and validity ranges,
- geometry dimensions,
- mesh strategy,
- thermal and species boundary conditions,
- solver/equation choice,
- conservation checks.

Only after that should the first dataset cases be labelled physically meaningful.
