from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHYSICS = ROOT / "physics"
DATASETS = ROOT / "datasets"
SCRIPTS = PHYSICS / "scripts"
PROPERTY_FIXTURE = PHYSICS / "tests" / "fixtures" / "material_properties.test.json"
CONTROL_FIXTURE = PHYSICS / "tests" / "fixtures" / "control_map.test.json"


class MaterializationTests(unittest.TestCase):
    def make_design(self, output: Path) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(DATASETS / "scripts" / "sample_design.py"),
                "--count",
                "10",
                "--seed",
                "42",
                "--output",
                str(output),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_production_rejects_nonphysical_fixtures(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            design = Path(tmp) / "design.jsonl"
            self.make_design(design)
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "materialize_design.py"),
                    "--design",
                    str(design),
                    "--properties",
                    str(PROPERTY_FIXTURE),
                    "--control-map",
                    str(CONTROL_FIXTURE),
                    "--output",
                    str(Path(tmp) / "case"),
                ],
                cwd=SCRIPTS,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("BLOCKED", result.stdout)

    def test_test_fixture_materializes_case_package(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            design = Path(tmp) / "design.jsonl"
            case = Path(tmp) / "case"
            self.make_design(design)
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "materialize_design.py"),
                    "--design",
                    str(design),
                    "--properties",
                    str(PROPERTY_FIXTURE),
                    "--control-map",
                    str(CONTROL_FIXTURE),
                    "--output",
                    str(case),
                    "--test-fixture",
                ],
                cwd=SCRIPTS,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue((case / "design.json").is_file())
            self.assertTrue((case / "mapped-controls.json").is_file())

            metadata = json.loads((case / "metadata.json").read_text())
            self.assertEqual(metadata["furnace_id"], "A")
            self.assertEqual(
                metadata["materialization_stage"],
                "CASE_PACKAGE_ONLY_NO_SOLVER_RUN",
            )


if __name__ == "__main__":
    unittest.main()
