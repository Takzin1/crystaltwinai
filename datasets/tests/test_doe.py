from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "datasets" / "scripts" / "sample_design.py"
VALIDATOR = ROOT / "datasets" / "scripts" / "validate_design.py"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class DesignOfExperimentsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.module = load_module(SCRIPT, "sample_design")

    def test_generation_is_deterministic(self) -> None:
        a = self.module.generate_design(100, seed=42)
        b = self.module.generate_design(100, seed=42)
        self.assertEqual(a, b)

    def test_different_seed_changes_design(self) -> None:
        self.assertNotEqual(
            self.module.generate_design(16, seed=42),
            self.module.generate_design(16, seed=43),
        )

    def test_split_and_furnace_contract(self) -> None:
        cases = self.module.generate_design(100, seed=42)
        for case in cases:
            if case["split"] == "test_ood":
                self.assertIn(case["furnace_id"], {"B", "C"})
            else:
                self.assertEqual(case["furnace_id"], "A")

    def test_case_ids_are_unique(self) -> None:
        cases = self.module.generate_design(100, seed=42)
        ids = [case["case_id"] for case in cases]
        self.assertEqual(len(ids), len(set(ids)))

    def test_design_is_explicitly_nonphysical(self) -> None:
        cases = self.module.generate_design(8, seed=42)
        self.assertTrue(
            all(c["physical_validity"] == "DESIGN_ONLY_NO_SOLVER_OUTPUT" for c in cases)
        )

    def test_ranges_are_respected(self) -> None:
        cases = self.module.generate_design(100, seed=42)
        ranges = {name: (lo, hi) for name, lo, hi in self.module.PARAMETERS}
        for case in cases:
            for name, value in case["controls_normalized"].items():
                lo, hi = ranges[name]
                self.assertGreaterEqual(value, lo)
                self.assertLessEqual(value, hi)


if __name__ == "__main__":
    unittest.main()
