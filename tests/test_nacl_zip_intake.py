"""Synthetic, source-independent security tests for NaCl ZIP intake."""
import importlib.util
import io
from pathlib import Path
import stat
import tempfile
import unittest
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit_nacl_zip.py"
spec = importlib.util.spec_from_file_location("nacl_zip_audit", SCRIPT)
importer = importlib.util.module_from_spec(spec)
assert spec is not None and spec.loader is not None
spec.loader.exec_module(importer)

class NaClSourceIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.zip_path = self.root / "NaCl_Paper_Data.zip"

    def make_zip(self, members):
        with ZipFile(self.zip_path, "w", compression=ZIP_DEFLATED) as z:
            for name, payload in members:
                z.writestr(name, payload)

    def test_source_native_bytes_sha_and_classification(self):
        data = b"temperature,C,observation\n20,1.1,2.2\n"
        self.make_zip([
            ("data/NaCl.csv", data),
            ("README.txt", b"research-protocol-unverified")
        ])
        report = importer.inspect_archive(self.zip_path)
        self.assertEqual(report["entryCount"], 2)
        self.assertEqual(report["countsByFormat"], {"csv": 1, "text": 1})
        rec = next(e for e in report["entries"] if e["kind"] == "csv")
        import hashlib
        self.assertEqual(rec["sourceSha256"], hashlib.sha256(data).hexdigest())
        self.assertEqual(report["sourceMeasuredStatus"], "unverified")
        self.assertFalse(report["physicalModelCalibrated"])
        self.assertNotIn("20,1.1", str(report))

    def test_safe_private_extraction_round_trip(self):
        original = b"NaCl-raw-source\x00\x01\x02"
        self.make_zip([("data/measurements.bin", original)])
        dest = self.root / "private"
        report = importer.inspect_archive(self.zip_path, dest)
        self.assertEqual(report["entryCount"], 1)
        self.assertEqual((dest / "data" / "measurements.bin").read_bytes(), original)

    def test_path_traversal_rejected(self):
        self.make_zip([("../escape.txt", b"not allowed")])
        with self.assertRaisesRegex(importer.IntakeError, "Unsafe"):
            importer.inspect_archive(self.zip_path, self.root / "private")
        self.assertFalse((self.root / "escape.txt").exists())

    def test_windows_path_rejected(self):
        self.make_zip([("C:\\evil.txt", b"x")])
        with self.assertRaisesRegex(importer.IntakeError, "Unsafe"):
            importer.inspect_archive(self.zip_path)

    def test_duplicate_entries_rejected(self):
        self.make_zip([("data/a.csv", b"x"), ("data/A.csv", b"y")])
        with self.assertRaisesRegex(importer.IntakeError, "Duplicate"):
            importer.inspect_archive(self.zip_path)

    def test_symlinks_rejected(self):
        link = ZipInfo("data/link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with ZipFile(self.zip_path, "w") as z:
            z.writestr(link, "../outside")
        with self.assertRaisesRegex(importer.IntakeError, "symbolic"):
            importer.inspect_archive(self.zip_path, self.root / "private")

    def test_archive_expansion_limit(self):
        self.make_zip([("data.csv", b"a" * 1024)])
        old = importer.MAX_TOTAL
        try:
            importer.MAX_TOTAL = 100
            with self.assertRaisesRegex(importer.IntakeError, "expansion limit"):
                importer.inspect_archive(self.zip_path)
        finally:
            importer.MAX_TOTAL = old

if __name__ == "__main__":
    unittest.main()
