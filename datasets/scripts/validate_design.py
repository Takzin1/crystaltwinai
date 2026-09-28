#!/usr/bin/env python3
"""Validate normalized DOE manifests before they are passed to physics jobs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ALLOWED_SPLITS = {"train", "validation", "test_id", "test_ood"}
ALLOWED_FURNACES = {"A", "B", "C"}


def validate_case(case: dict) -> list[str]:
    errors: list[str] = []

    if case.get("physical_validity") != "DESIGN_ONLY_NO_SOLVER_OUTPUT":
        errors.append("design point must be marked DESIGN_ONLY_NO_SOLVER_OUTPUT")

    split = case.get("split")
    furnace = case.get("furnace_id")
    if split not in ALLOWED_SPLITS:
        errors.append(f"invalid split: {split}")
    if furnace not in ALLOWED_FURNACES:
        errors.append(f"invalid furnace: {furnace}")

    if split != "test_ood" and furnace != "A":
        errors.append("Furnace B/C may only appear in test_ood")
    if split == "test_ood" and furnace not in {"B", "C"}:
        errors.append("test_ood must use Furnace B or C")

    controls = case.get("controls_normalized")
    if not isinstance(controls, dict) or not controls:
        errors.append("controls_normalized object is required")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()

    failures = 0
    seen_ids: set[str] = set()
    with args.path.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            case = json.loads(line)
            case_id = case.get("case_id")
            if not isinstance(case_id, str) or not case_id:
                print(f"INVALID[{line_no}]: case_id is required")
                failures += 1
                continue
            if case_id in seen_ids:
                print(f"INVALID[{line_no}]: duplicate case_id {case_id}")
                failures += 1
            seen_ids.add(case_id)

            errors = validate_case(case)
            for error in errors:
                print(f"INVALID[{line_no}]: {error}")
            failures += int(bool(errors))

    if failures:
        return 1
    print(f"valid design manifest: {len(seen_ids)} cases")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
