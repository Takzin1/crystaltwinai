# Datasets

CrystalTwinAI separates **external reference datasets** from the project's own reproducible SiC synthetic dataset.

## License gate

A dataset with an unknown or unverified license must not enter training or redistribution pipelines.

Minimum manifest fields:

- dataset_id
- source_url / DOI
- version
- retrieved_at
- license_spdx
- commercial_use
- training_allowed
- redistribution_allowed
- checksum_sha256
- sic_specific
- role
- status

CI validation will be added so `license_spdx: UNKNOWN` blocks training use.

## Intended roles

External datasets are primarily for:

- perception validation,
- RAG / knowledge retrieval,
- auxiliary validation,
- benchmark references.

The main SiC surrogate dataset is intended to be generated independently from reproducible physics cases under `/physics/`.
