#!/usr/bin/env python3
"""Primary-source property gate for SiC-TSSG case generation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REQUIRED_PROPERTIES = (
    "melt_density",
    "dynamic_viscosity",
    "heat_capacity",
    "thermal_conductivity",
    "thermal_expansion",
    "carbon_diffusivity",
    "surface_tension",
    "surface_tension_temperature_coefficient",
    "carbon_solubility",
    "electrical_conductivity",
    "solid_sic_density",
)


@dataclass(frozen=True)
class GateResult:
    allowed: bool
    errors: tuple[str, ...]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a JSON object")
    return data


def validate_property_manifest(
    manifest: dict[str, Any], *, allow_test_fixture: bool = False
) -> GateResult:
    errors: list[str] = []

    if allow_test_fixture:
        if manifest.get("nonphysical_test_fixture") is not True:
            errors.append("test fixture mode requires nonphysical_test_fixture=true")
    elif manifest.get("nonphysical_test_fixture") is True:
        errors.append("nonphysical test fixture cannot be used in production generation")

    properties = manifest.get("properties")
    if not isinstance(properties, dict):
        return GateResult(False, ("properties object is required",))

    for key in REQUIRED_PROPERTIES:
        item = properties.get(key)
        if not isinstance(item, dict):
            errors.append(f"missing property: {key}")
            continue

        value = item.get("value")
        unit = item.get("unit")
        status = item.get("status")
        source_id = item.get("primary_source_id")
        locator = item.get("locator")

        if value is None:
            errors.append(f"{key}: value is null")
        elif not isinstance(value, (int, float)):
            errors.append(f"{key}: value must be numeric")

        if not isinstance(unit, str) or not unit.strip():
            errors.append(f"{key}: unit is required")

        if allow_test_fixture:
            if status != "TEST_ONLY_NONPHYSICAL":
                errors.append(f"{key}: test fixture status must be TEST_ONLY_NONPHYSICAL")
        else:
            if status != "VERIFIED_PRIMARY_SOURCE":
                errors.append(f"{key}: status must be VERIFIED_PRIMARY_SOURCE")
            if not isinstance(source_id, str) or not source_id.strip():
                errors.append(f"{key}: primary_source_id is required")
            if not isinstance(locator, str) or not locator.strip():
                errors.append(f"{key}: primary-source locator is required")

    return GateResult(not errors, tuple(errors))
