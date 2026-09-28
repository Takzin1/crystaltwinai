#!/usr/bin/env python3
"""Generic conservation checks for normalized physics run metrics."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def relative_balance_error(inflow: float, outflow: float, accumulation: float) -> float:
    residual = inflow - outflow - accumulation
    scale = max(abs(inflow), abs(outflow), abs(accumulation), 1e-12)
    return abs(residual) / scale


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("metrics", type=Path)
    parser.add_argument("--species-tol", type=float, default=1e-3)
    parser.add_argument("--energy-tol", type=float, default=1e-3)
    args = parser.parse_args()

    data = json.loads(args.metrics.read_text(encoding="utf-8"))
    species = data["species_balance"]
    energy = data["energy_balance"]

    species_err = relative_balance_error(
        float(species["in"]),
        float(species["out"]),
        float(species["accumulation"]),
    )
    energy_err = relative_balance_error(
        float(energy["in"]),
        float(energy["out"]),
        float(energy["accumulation"]),
    )

    print(json.dumps({
        "species_relative_balance_error": species_err,
        "energy_relative_balance_error": energy_err,
    }, sort_keys=True))

    if species_err > args.species_tol:
        print("FAIL: species balance exceeds tolerance")
        return 2
    if energy_err > args.energy_tol:
        print("FAIL: energy balance exceeds tolerance")
        return 3

    print("conservation checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
