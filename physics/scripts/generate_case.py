#!/usr/bin/env python3
"""Generate a deterministic OpenFOAM case scaffold from verified inputs.

This generator deliberately refuses to create production cases from unverified
physical properties. A separate --test-fixture mode exists only for CI and
unit tests and emits metadata marking the case as nonphysical.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from property_gate import load_json, validate_property_manifest


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def render(template: str, values: dict[str, str]) -> str:
    out = template
    for key, value in values.items():
        out = out.replace("{{" + key + "}}", value)
    if "{{" in out or "}}" in out:
        raise ValueError("unresolved template token remains")
    return out


def numeric(properties: dict[str, Any], key: str) -> str:
    return repr(float(properties[key]["value"]))


def write_case(
    template_dir: Path,
    output_dir: Path,
    manifest_path: Path,
    manifest: dict[str, Any],
    *,
    test_fixture: bool,
) -> None:
    props = manifest["properties"]
    values = {
        "RHO": numeric(props, "melt_density"),
        "MU": numeric(props, "dynamic_viscosity"),
        "CP": numeric(props, "heat_capacity"),
        "K": numeric(props, "thermal_conductivity"),
        "BETA_T": numeric(props, "thermal_expansion"),
        "DC": numeric(props, "carbon_diffusivity"),
        "GAMMA": numeric(props, "surface_tension"),
        "DGAMMA_DT": numeric(props, "surface_tension_temperature_coefficient"),
        "SIGMA_E": numeric(props, "electrical_conductivity"),
        "RHO_SIC": numeric(props, "solid_sic_density"),
    }

    for relative in (
        "system/controlDict",
        "system/fvSchemes",
        "system/fvSolution",
        "constant/transportProperties",
    ):
        source = template_dir / (relative + ".template")
        destination = output_dir / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(
            render(source.read_text(encoding="utf-8"), values),
            encoding="utf-8",
        )

    metadata = {
        "schema_version": 1,
        "case_type": "axisymmetric_2d_scaffold",
        "physical_validity": (
            "NONPHYSICAL_TEST_FIXTURE" if test_fixture else "SOURCE_VERIFIED_INPUTS"
        ),
        "property_manifest_sha256": sha256_file(manifest_path),
        "generator": "physics/scripts/generate_case.py",
        "notes": [
            "This is a deterministic OpenFOAM scaffold.",
            "Mesh and boundary conditions require separate source validation before scientific use.",
        ],
    }
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--properties", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--template-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "openfoam"
        / "templates"
        / "axisymmetric",
    )
    parser.add_argument(
        "--test-fixture",
        action="store_true",
        help="CI only: allow explicitly marked nonphysical fixture values.",
    )
    args = parser.parse_args()

    manifest = load_json(args.properties)
    gate = validate_property_manifest(
        manifest, allow_test_fixture=args.test_fixture
    )
    if not gate.allowed:
        for error in gate.errors:
            print(f"BLOCKED: {error}")
        return 2

    args.output.mkdir(parents=True, exist_ok=True)
    write_case(
        args.template_dir,
        args.output,
        args.properties,
        manifest,
        test_fixture=args.test_fixture,
    )
    print(f"generated: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
