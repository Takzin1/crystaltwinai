# NaCl experimental archive — guarded offline intake

## Status

The user supplied archives named NaCl_Paper_Data.zip and
NaCl_Paper_Data(1).zip. This repository does **not** yet distribute NaCl
observations, a calibrated NaCl physical model or a source-native NaCl
measurement comparison. An archival filename alone is not proof of a particular
experiment, measurement unit, license, phase or original publication.

The source archives are large (each listed as 366,050,411 bytes in the
user-provided file library). Their **contents, entry-level SHA-256 hashes,
chemical identity and reuse rights remain unaudited** until the tool below
successfully runs against the original ZIP. Equal file sizes do not prove
byte-for-byte equality.

## Reproducible source-native audit (Python 3.10+, stdlib)

Run from the repository root with the source ZIP available locally:

    python3 scripts/audit_nacl_zip.py \
      "/path/to/NaCl_Paper_Data(1).zip" \
      --manifest artifacts/nacl-private/source-manifest.json

For optional extraction into a non-public local directory:

    python3 scripts/audit_nacl_zip.py \
      "/path/to/NaCl_Paper_Data(1).zip" \
      --manifest artifacts/nacl-private/source-manifest.json \
      --extract-private artifacts/nacl-private/raw

Verify that both archives are identical only if their *complete* SHA-256 digests
match. The audit streams member bytes, checks CRC on read, computes SHA-256,
classifies source file types, refuses unsafe paths/symlinks/colliding entries,
enforces expansion ceilings, and produces a metadata-only manifest.

**Do not check the original ZIP, extracted files, raw measurements or private
manifest into the public repository without a separate licensing and privacy
review.** All source values must remain in their original units; there is no
automatic unit conversion, interpolation, calibration or NaCl kinetic prediction.

## Next scientific gate

After examining the verified original contents, create a specific schema
adapter only for the actual experiment format. Identify DOI/publisher, license,
specimen and solid phase, temperature units, concentration definition, solution
chemistry, time origin, replicate identity, measured-vs-simulated columns,
uncertainty definition and any train/validation leakage. Require independent
validation before comparing to the existing educational PBE. Do not treat raw
source columns as model results.

Synthetic importer tests run under:

    python3 -m unittest discover -s tests -p 'test_nacl*.py' -v
