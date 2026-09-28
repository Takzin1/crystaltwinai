from __future__ import annotations

import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "physics" / "scripts"
FIXTURES = ROOT / "physics" / "tests" / "fixtures"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class SourceContractTests(unittest.TestCase):
    def test_source_record_fixture_validates(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS / "validate_source_records.py"),
                str(FIXTURES / "source_records.valid.test.json"),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_conservation_fixture_passes(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(SCRIPTS / "conservation_checks.py"),
                str(FIXTURES / "conservation.pass.test.json"),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_balance_error_detects_residual(self) -> None:
        module = load_module(SCRIPTS / "conservation_checks.py", "conservation_checks")
        self.assertGreater(module.relative_balance_error(10.0, 8.0, 1.0), 0.05)


if __name__ == "__main__":
    unittest.main()
