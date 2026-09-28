#!/usr/bin/env python3
"""Validate primary-source provenance before a property can become production-usable."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED_KEYS = (
    "property_id",
    "value",
    "unit",
    "status",
    "primary_source_id",
    "locator",
    "valid_temperature_range",
)


def validate_record(record: dict) -> list[str]:
    errors: list[str] = []

    for key in REQUIRED_KEYS:
        if key not in record:
            errors.append(f"missing key: {key}")

    if errors:
        return errors

    if not isinstance(record["value"], (int, float)):
        errors.append("value must be numeric")

    if not isinstance(record["unit"], str) or not record["unit"].strip():
        errors.append("unit must be non-empty")

    if record["status"] != "VERIFIED_PRIMARY_SOURCE":
        errors.append("status must be VERIFIED_PRIMARY_SOURCE")

    if not isinstance(record["primary_source_id"], str) or not record["primary_source_id"].strip():
        errors.append("primary_source_id must be non-empty")

    if not isinstance(record["locator"], str) or not record["locator"].strip():
        errors.append("locator must be non-empty")

    valid_range = record["valid_temperature_range"]
    if not isinstance(valid_range, dict):
        errors.append("valid_temperature_range must be an object")
    else:
        if "unit" not in valid_range or not isinstance(valid_range["unit"], str) or not valid_range["unit"].strip():
            errors.append("valid_temperature_range.unit must be non-empty")
        lo = valid_range.get("min")
        hi = valid_range.get("max")
        if lo is not None and not isinstance(lo, (int, float)):
            errors.append("valid_temperature_range.min must be numeric or null")
        if hi is not None and not isinstance(hi, (int, float)):
            errors.append("valid_temperature_range.max must be numeric or null")
        if isinstance(lo, (int, float)) and isinstance(hi, (int, float)) and lo > hi:
            errors.append("valid_temperature_range.min must be <= max")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.path.read_text(encoding="utf-8"))
    records = payload.get("records")
    if not isinstance(records, list):
        print("INVALID: top-level records array is required")
        return 1

    failures = 0
    for idx, record in enumerate(records):
        if not isinstance(record, dict):
            print(f"INVALID[{idx}]: record must be an object")
            failures += 1
            continue
        errors = validate_record(record)
        for error in errors:
            print(f"INVALID[{idx}]: {error}")
        failures += int(bool(errors))

    if failures:
        return 1

    print(f"valid source records: {len(records)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
