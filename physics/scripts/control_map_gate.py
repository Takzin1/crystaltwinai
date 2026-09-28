#!/usr/bin/env python3
"""Gate normalized-to-physical control mappings on primary-source provenance."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

REQUIRED_CONTROLS = (
    "control_temperature_offset_norm",
    "seed_rotation_norm",
    "crucible_rotation_norm",
    "rf_power_norm",
    "coil_position_norm",
    "seed_melt_gap_norm",
    "magnetic_field_norm",
    "carbon_supersaturation_norm",
)


@dataclass(frozen=True)
class ControlMapGateResult:
    allowed: bool
    errors: tuple[str, ...]


def validate_control_map(
    manifest: dict[str, Any], *, allow_test_fixture: bool = False
) -> ControlMapGateResult:
    errors: list[str] = []

    if allow_test_fixture:
        if manifest.get("nonphysical_test_fixture") is not True:
            errors.append("test fixture mode requires nonphysical_test_fixture=true")
    elif manifest.get("nonphysical_test_fixture") is True:
        errors.append("nonphysical control map cannot be used in production")

    controls = manifest.get("controls")
    if not isinstance(controls, dict):
        return ControlMapGateResult(False, ("controls object is required",))

    for key in REQUIRED_CONTROLS:
        item = controls.get(key)
        if not isinstance(item, dict):
            errors.append(f"missing control map: {key}")
            continue

        lo = item.get("min")
        hi = item.get("max")
        unit = item.get("unit")
        status = item.get("status")

        if not isinstance(lo, (int, float)):
            errors.append(f"{key}: min must be numeric")
        if not isinstance(hi, (int, float)):
            errors.append(f"{key}: max must be numeric")
        if isinstance(lo, (int, float)) and isinstance(hi, (int, float)) and lo >= hi:
            errors.append(f"{key}: min must be < max")

        if not isinstance(unit, str) or not unit.strip():
            errors.append(f"{key}: unit is required")

        if allow_test_fixture:
            if status != "TEST_ONLY_NONPHYSICAL":
                errors.append(f"{key}: test fixture status must be TEST_ONLY_NONPHYSICAL")
        else:
            if status != "VERIFIED_PRIMARY_SOURCE":
                errors.append(f"{key}: status must be VERIFIED_PRIMARY_SOURCE")
            if not isinstance(item.get("primary_source_id"), str) or not item["primary_source_id"].strip():
                errors.append(f"{key}: primary_source_id is required")
            if not isinstance(item.get("locator"), str) or not item["locator"].strip():
                errors.append(f"{key}: locator is required")

    return ControlMapGateResult(not errors, tuple(errors))


def map_controls(normalized: dict[str, float], manifest: dict[str, Any]) -> dict[str, dict]:
    controls = manifest["controls"]
    mapped: dict[str, dict] = {}

    for key in REQUIRED_CONTROLS:
        if key not in normalized:
            raise ValueError(f"missing normalized control: {key}")
        value = float(normalized[key])
        spec = controls[key]
        lo = float(spec["min"])
        hi = float(spec["max"])

        # Normalize each DOE variable using the range encoded by the DOE itself.
        # Values outside [0,1] style variables are first normalized by their
        # declared source interval in the test/verified control map.
        source_lo = float(spec.get("normalized_min", 0.0))
        source_hi = float(spec.get("normalized_max", 1.0))
        if source_hi <= source_lo:
            raise ValueError(f"invalid normalized range for {key}")

        alpha = (value - source_lo) / (source_hi - source_lo)
        if alpha < -1e-12 or alpha > 1 + 1e-12:
            raise ValueError(f"{key}: normalized value outside declared range")

        mapped[spec["physical_name"]] = {
            "value": lo + alpha * (hi - lo),
            "unit": spec["unit"],
            "source_control": key,
        }

    return mapped
