#!/usr/bin/env python3
"""Deterministic normalized DOE generator for CrystalTwin-SiC-Synth v0.

This module creates *design points only*. It does not claim physical validity and
must not be interpreted as OpenFOAM output or experimental data.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

PARAMETERS = (
    ("control_temperature_offset_norm", -1.0, 1.0),
    ("seed_rotation_norm", 0.0, 1.0),
    ("crucible_rotation_norm", -1.0, 1.0),
    ("rf_power_norm", 0.8, 1.2),
    ("coil_position_norm", -1.0, 1.0),
    ("seed_melt_gap_norm", 0.8, 1.2),
    ("magnetic_field_norm", 0.0, 1.0),
    ("carbon_supersaturation_norm", 0.0, 1.0),
)

PRIMES = (2, 3, 5, 7, 11, 13, 17, 19)


def halton(index: int, base: int) -> float:
    if index <= 0:
        raise ValueError("Halton index must be positive")
    result = 0.0
    factor = 1.0
    i = index
    while i:
        factor /= base
        result += factor * (i % base)
        i //= base
    return result


def scale01(value: float, lo: float, hi: float) -> float:
    return lo + value * (hi - lo)


def split_for(index: int, count: int) -> tuple[str, str]:
    if count < 10:
        # Small smoke sets preserve at least one OOD point when possible.
        if index == count - 1 and count >= 4:
            return "test_ood", "B"
        return ("train" if index < max(1, count - 1) else "validation"), "A"

    train_end = int(count * 0.60)
    val_end = int(count * 0.75)
    id_end = int(count * 0.90)

    if index < train_end:
        return "train", "A"
    if index < val_end:
        return "validation", "A"
    if index < id_end:
        return "test_id", "A"
    return "test_ood", ("B" if (index - id_end) % 2 == 0 else "C")


def generate_design(count: int, seed: int = 42) -> list[dict]:
    if count <= 0:
        raise ValueError("count must be positive")
    if seed < 0:
        raise ValueError("seed must be non-negative")

    # Seed acts as a deterministic skip offset; no PRNG state is involved.
    skip = seed * 17
    cases: list[dict] = []

    for idx in range(count):
        split, furnace_id = split_for(idx, count)
        controls: dict[str, float] = {}
        for dim, (name, lo, hi) in enumerate(PARAMETERS):
            h = halton(skip + idx + 1, PRIMES[dim])
            controls[name] = round(scale01(h, lo, hi), 12)

        cases.append(
            {
                "case_id": f"ct-sic-v0-{idx:05d}",
                "design_index": idx,
                "spec_id": "sic_tssg_v0",
                "dataset_id": "crystaltwin_sic_synth_v0",
                "split": split,
                "furnace_id": furnace_id,
                "physical_validity": "DESIGN_ONLY_NO_SOLVER_OUTPUT",
                "controls_normalized": controls,
            }
        )

    return cases


def write_jsonl(cases: Iterable[dict], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as fh:
        for case in cases:
            fh.write(json.dumps(case, sort_keys=True) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    cases = generate_design(args.count, args.seed)
    write_jsonl(cases, args.output)
    print(f"generated {len(cases)} normalized design points: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
