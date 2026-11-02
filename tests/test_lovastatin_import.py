"""stdlib-only adversarial tests for private Lovastatin XLSX intake.
Generated fixtures have no copyright-restricted published measurements.
"""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

SOURCE=Path(__file__).resolve().parents[1]/"scripts"/"import_lovastatin.py"
spec=importlib.util.spec_from_file_location("lovastatin_importer",SOURCE)
module=importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)
N="http://schemas.openxmlformats.org/spreadsheetml/2006/main"

def fixture(path, observations=None, header=None, extra="", formula=False):
    observations=observations or [
      ("PICKL73",.1,.17355,.17,.009),
      ("PICKL73",300,.16,.15,.008),
      ("PICKL75",300,.15,.14,.007)]
    header=header or list(module.HEADERS)
    shared=header+sorted({r[0] for r in observations})
    ix={x:i for i,x in enumerate(shared)}
    sheet=["<worksheet xmlns='"+N+"'><sheetData>"]
    sheet.append("<row r='1'>"+''.join(
      f"<c r='{chr(65+i)}1' t='s'><v>{ix[x]}</v></c>" for i,x in enumerate(header)
    )+"</row>")
    for n,record in enumerate(observations,2):
        vals=[f"<c r='A{n}' t='s'><v>{ix[record[0]]}</v></c>"]
        vals.extend(f"<c r='{chr(65+j)}{n}'><v>{v}</v></c>" for j,v in enumerate(record[1:],1))
        if formula and n==2:vals[2]=f"<c r='C{n}'><f>1+1</f><v>.17355</v></c>"
        sheet.append(f"<row r='{n}'>"+''.join(vals)+"</row>")
    sheet.append("</sheetData></worksheet>")
    book=f"<workbook xmlns='{N}'><sheets><sheet name='Sheet1' sheetId='1'/></sheets></workbook>"
    strings="<sst xmlns='"+N+"'>"+''.join("<si><t>"+s+"</t></si>" for s in shared)+"</sst>"
    with ZipFile(path,"w") as z:
        z.writestr("xl/workbook.xml",book)
        z.writestr("xl/sharedStrings.xml",strings)
        z.writestr("xl/worksheets/sheet1.xml","".join(sheet))
        if extra:z.writestr(extra,"unsafe")

class SourceIntakeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name)
        self.path=self.root/"fixture.xlsx"
        fixture(self.path)

    def test_clean_typed_source_cells_preserved(self):
        rows=module.read_table(self.path)
        self.assertEqual(len(rows),3)
        self.assertEqual(rows[0]["experimentId"],"PICKL73")
        self.assertEqual(rows[0]["xlsxRow"],2)
        self.assertEqual(rows[0]["timeSource"],.1)
        self.assertAlmostEqual(rows[0]["reportedStdDevSource"],.009)

    def test_header_is_not_fuzzily_guessed(self):
        fixture(self.path,header=["Experiment","Seconds","Measured values",
                                 "Predicted values","Standard deviation"])
        with self.assertRaisesRegex(module.IntakeError,"Unexpected headers"):
            module.read_table(self.path)

    def test_formula_cells_rejected(self):
        fixture(self.path,formula=True)
        with self.assertRaisesRegex(module.IntakeError,"Formula"):
            module.read_table(self.path)

    def test_duplicate_or_nonmonotonic_experiment_time_rejected(self):
        fixture(self.path,observations=[
            ("PICKL73",300,.1,.1,.01),("PICKL73",300,.15,.12,.01)])
        with self.assertRaisesRegex(module.IntakeError,"duplicates or decreases"):
            module.read_table(self.path)

    def test_nonpositive_sd_rejected(self):
        fixture(self.path,observations=[("PICKL73",300,.1,.1,0)])
        with self.assertRaisesRegex(module.IntakeError,"invalid SD"):
            module.read_table(self.path)

    def test_external_workbook_parts_rejected(self):
        fixture(self.path,extra="xl/externalLinks/externalLink1.xml")
        with self.assertRaisesRegex(module.IntakeError,"External links"):
            module.read_table(self.path)

    def test_pinned_digest_rejects_synthetic_source(self):
        paths={name:self.path for name in module.SHEETS}
        with self.assertRaisesRegex(module.IntakeError,"SHA-256 mismatch"):
            module.make_bundle(paths)

    def test_safe_metadata_report_never_includes_measurement_rows(self):
        paths={name:self.path for name in module.SHEETS}
        bundle=module.make_bundle(paths,pin=False)
        manifest=module.make_manifest(bundle)
        self.assertEqual(set(manifest["workbooks"]),set(module.SHEETS))
        self.assertFalse(manifest["containsRawMeasurements"])
        self.assertFalse(manifest["leakageGate"]["secondaryIsGloballyIndependentHoldout"])
        for info in manifest["workbooks"].values():
            self.assertNotIn("rows",info)
        self.assertNotIn("measuredSource",str(manifest))
        self.assertFalse(manifest["physicalClaims"]["physicalPbeValidated"])

if __name__=="__main__":unittest.main()
