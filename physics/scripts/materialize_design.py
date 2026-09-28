#!/usr/bin/env python3
"""Materialize one normalized design point into an OpenFOAM case package.

Production mode requires both a verified property manifest and a verified
normalized-to-physical control map. CI may use explicit nonphysical fixtures.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from control_map_gate import map_controls, validate_control_map
from generate_case import load_json, write_case
from property_gate import validate_property_manifest


def load_design_point(path: Path, index: int) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        rows = [json.loads(line) for line in fh if line.strip()]
    if index < 0 or index >= len(rows):
        raise IndexError("design index out of range")
    design = rows[index]
    if design.get("physical_validity") != "DESIGN_ONLY_NO_SOLVER_OUTPUT":
        raise ValueError("input row is not a normalized design point")
    return design


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--design", required=True, type=Path)
    parser.add_argument("--index", type=int, default=0)
    parser.add_argument("--properties", required=True, type=Path)
    parser.add_argument("--control-map", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--test-fixture", action="store_true")
    args = parser.parse_args()

    design = load_design_point(args.design, args.index)
    if design.get("furnace_id") != "A":
        print("BLOCKED: Furnace B/C geometry templates are not implemented yet")
        return 4

    properties = load_json(args.properties)
    property_gate = validate_property_manifest(
        properties, allow_test_fixture=args.test_fixture
    )
    if not property_gate.allowed:
        for error in property_gate.errors:
            print(f"BLOCKED: property: {error}")
        return 2

    control_map = load_json(args.control_map)
    control_gate = validate_control_map(
        control_map, allow_test_fixture=args.test_fixture
    )
    if not control_gate.allowed:
        for error in control_gate.errors:
            print(f"BLOCKED: control-map: {error}")
        return 3

    mapped_controls = map_controls(design["controls_normalized"], control_map)

    template_dir = (
        Path(__file__).resolve().parents[1]
        / "openfoam"
        / "templates"
        / "axisymmetric"
    )
    args.output.mkdir(parents=True, exist_ok=True)
    write_case(
        template_dir,
        args.output,
        args.properties,
        properties,
        test_fixture=args.test_fixture,
    )

    (args.output / "design.json").write_text(
        json.dumps(design, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (args.output / "mapped-controls.json").write_text(
        json.dumps(mapped_controls, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    metadata_path = args.output / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata.update(
        {
            "design_case_id": design["case_id"],
            "dataset_split": design["split"],
            "furnace_id": design["furnace_id"],
            "materialization_stage": "CASE_PACKAGE_ONLY_NO_SOLVER_RUN",
            "control_map_id": control_map.get("control_map_id", "fixture"),
        }
    )
    metadata_path.write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    print(f"materialized case package: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
