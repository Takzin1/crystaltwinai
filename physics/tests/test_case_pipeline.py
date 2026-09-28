from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "physics" / "scripts"
FIXTURE = ROOT / "physics" / "tests" / "fixtures" / "material_properties.test.json"


class CasePipelineTests(unittest.TestCase):
    def test_production_generation_rejects_test_fixture(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "generate_case.py"),
                    "--properties",
                    str(FIXTURE),
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

    def test_test_fixture_generation_is_explicit_and_structurally_valid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            case_dir = Path(tmp) / "case"
            generate = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "generate_case.py"),
                    "--properties",
                    str(FIXTURE),
                    "--output",
                    str(case_dir),
                    "--test-fixture",
                ],
                cwd=SCRIPTS,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(generate.returncode, 0, generate.stdout + generate.stderr)

            validate = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPTS / "validate_case.py"),
                    str(case_dir),
                ],
                cwd=SCRIPTS,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(validate.returncode, 0, validate.stdout + validate.stderr)

            metadata = json.loads((case_dir / "metadata.json").read_text())
            self.assertEqual(
                metadata["physical_validity"], "NONPHYSICAL_TEST_FIXTURE"
            )


if __name__ == "__main__":
    unittest.main()
