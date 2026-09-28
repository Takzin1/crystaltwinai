#!/usr/bin/env python3
"""Structural validation for generated OpenFOAM case scaffolds."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

REQUIRED_FILES = (
    "metadata.json",
    "system/controlDict",
    "system/fvSchemes",
    "system/fvSolution",
    "constant/transportProperties",
)


def validate(case_dir: Path) -> list[str]:
    errors: list[str] = []

    for relative in REQUIRED_FILES:
        path = case_dir / relative
        if not path.is_file():
            errors.append(f"missing file: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        if "{{" in text or "}}" in text:
            errors.append(f"unresolved template token: {relative}")

    metadata_path = case_dir / "metadata.json"
    if metadata_path.is_file():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        validity = metadata.get("physical_validity")
        if validity not in {"NONPHYSICAL_TEST_FIXTURE", "SOURCE_VERIFIED_INPUTS"}:
            errors.append("invalid physical_validity marker")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("case_dir", type=Path)
    args = parser.parse_args()

    errors = validate(args.case_dir)
    if errors:
        for error in errors:
            print(f"INVALID: {error}")
        return 1

    print("valid structural case scaffold")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
