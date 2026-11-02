#!/usr/bin/env python3
"""Offline user-owned Lovastatin XLSX importer (stdlib only).

The underlying public source advertises CC BY-NC-ND. DO NOT COMMIT generated
measurement JSON or the source workbooks. No units or independent-validation
claims are inferred from worksheet filenames.
"""
from __future__ import annotations
import argparse, hashlib, json, math, re, sys
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile, BadZipFile

SCHEMA="crystaltwin-lovastatin-local-evidence/1"
SOURCE="https://pureportal.strath.ac.uk/en/datasets/data-for-benchmarking-model-based-design-of-experiment-approaches/"
SHEETS=("growth","primary","secondary")
HEADERS=("Experiment","Time","Measured values","Predicted values","Standard deviation")
PINNED={
 "growth":("507dbcfd45d4db149a19f5c33cbc6d2a27879007a16193877ae39f30ed0f3594",37),
 "primary":("91130c164d5c47af854cb3385422353863f79989bb3743de69eba4b1496b4618",38),
 "secondary":("2b478e12fdaf13a54c6c3d53921915a7e80d027df7d03830c0d3bcffcf5f06a5",75),
}
NS="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
CELL=re.compile(r"^([A-Z]{1,2})([1-9][0-9]{0,3})$")
class IntakeError(ValueError): pass

def _xml(archive:ZipFile,name:str):
    member=archive.getinfo(name)
    if member.file_size>2_000_000 or member.compress_size>200_000:
        raise IntakeError("Oversize embedded XML")
    return ET.fromstring(archive.read(name))

def _column(chars:str)->int:
    col=0
    for ch in chars: col=26*col+ord(ch)-64
    return col-1

def read_table(path:Path)->list[dict]:
    if not path.is_file() or path.stat().st_size>200_000:
        raise IntakeError("Source XLSX missing or too large")
    try:
        with ZipFile(path) as archive:
            names=archive.namelist()
            if len(names)>80 or len(set(names))!=len(names) or any(
                "externalLinks" in name or "vbaProject" in name or name.endswith(".bin")
                for name in names
            ): raise IntakeError("External links, macros or duplicate XLSX entries")
            for part in ("xl/workbook.xml","xl/sharedStrings.xml","xl/worksheets/sheet1.xml"):
                if part not in names: raise IntakeError("Missing expected XLSX part "+part)
            book=_xml(archive,"xl/workbook.xml")
            sheets=book.findall(".//"+NS+"sheet")
            if len(sheets)!=1 or sheets[0].get("name")!="Sheet1":
                raise IntakeError("Expected one Sheet1")
            sr=_xml(archive,"xl/sharedStrings.xml")
            shared=["".join(n.itertext()) for n in sr.findall(NS+"si")]
            worksheet=_xml(archive,"xl/worksheets/sheet1.xml")
            if worksheet.find(".//"+NS+"f") is not None:
                raise IntakeError("Formula-derived values cannot be source measurements")
            cells={}
            for cell in worksheet.findall(".//"+NS+"sheetData/"+NS+"row/"+NS+"c"):
                match=CELL.fullmatch(cell.attrib.get("r",""))
                if not match: raise IntakeError("Invalid cell coordinate")
                col,row=_column(match.group(1)),int(match.group(2))
                v=cell.find(NS+"v")
                if col>=5 or row>1000:
                    if v is not None: raise IntakeError("Unexpected data outside A:E")
                    continue
                if v is None: continue
                typ=cell.get("t","n")
                if typ=="s":
                    index=int(v.text or "-1")
                    if index<0 or index>=len(shared): raise IntakeError("Invalid string index")
                    value=shared[index]
                elif typ=="n":
                    value=float(v.text or "nan")
                    if not math.isfinite(value): raise IntakeError("Nonfinite source observation")
                else: raise IntakeError("Unsupported cell type")
                record=cells.setdefault(row,{})
                if col in record: raise IntakeError("Duplicate Excel cell")
                record[col]=value
    except (BadZipFile,KeyError,ET.ParseError,OverflowError,IndexError) as exc:
        raise IntakeError("Malformed XLSX workbook") from exc
    if set(cells.get(1,{}))!=set(range(5)) or tuple(cells[1][i] for i in range(5))!=HEADERS:
        raise IntakeError("Unexpected headers; refusing to invent units")
    if set(cells)!=set(range(1,max(cells)+1)): raise IntakeError("Noncontiguous Excel rows")
    rows=[]; previous={}
    for n in range(2,max(cells)+1):
        values=cells[n]
        if set(values)!=set(range(5)): raise IntakeError("Incomplete Excel row "+str(n))
        exp=values[0]
        if not isinstance(exp,str) or re.fullmatch(r"PICKL[0-9]{2,4}",exp) is None:
            raise IntakeError("Unrecognized experiment ID")
        t,obs,pred,sd=(values[i] for i in range(1,5))
        if any(not isinstance(x,float) or not math.isfinite(x) for x in (t,obs,pred,sd)):
            raise IntakeError("Missing or nonnumeric physical observation")
        if t<0 or obs<0 or pred<0 or sd<=0: raise IntakeError("Negative quantity or invalid SD")
        if t<=previous.get(exp,-math.inf): raise IntakeError("Experiment time duplicates or decreases")
        previous[exp]=t
        rows.append({"experimentId":exp,"timeSource":t,"measuredSource":obs,
            "reportedPredictionSource":pred,"reportedStdDevSource":sd,"xlsxRow":n})
    return rows

def metrics(rows:list[dict])->dict:
    if not rows: raise IntakeError("No rows")
    diffs=[r["reportedPredictionSource"]-r["measuredSource"] for r in rows]
    size=len(rows)
    return {"count":size,
        "maeSourceUnits":sum(abs(x) for x in diffs)/size,
        "rmseSourceUnits":math.sqrt(sum(x*x for x in diffs)/size),
        "biasPredictionMinusMeasurement":sum(diffs)/size,
        "rmsReportedStdDevNormalizedResidual":math.sqrt(
            sum((delta/r["reportedStdDevSource"])**2 for delta,r in zip(diffs,rows))/size)}

def make_bundle(paths:dict[str,Path],*,pin:bool=True)->dict:
    if set(paths)!=set(SHEETS): raise IntakeError("Provide all three distinct XLSX workbooks")
    records={}
    for name in SHEETS:
        path=paths[name]
        sha=hashlib.sha256(path.read_bytes()).hexdigest()
        if pin and sha!=PINNED[name][0]: raise IntakeError("Original "+name+" XLSX SHA-256 mismatch")
        rows=read_table(path)
        if pin and len(rows)!=PINNED[name][1]: raise IntakeError("Wrong "+name+" row count")
        records[name]={"fileSha256":sha,"rowCount":len(rows),
            "experiments":sorted({r["experimentId"] for r in rows}),
            "rows":rows,"publishedPredictionMetrics":metrics(rows)}
    growth=set(records["growth"]["experiments"])
    primary=set(records["primary"]["experiments"])
    secondary=set(records["secondary"]["experiments"])
    common_growth=sorted(growth&secondary)
    common_primary=sorted(primary&secondary)
    return {"schema":SCHEMA,"sourceUrl":SOURCE,
        "license":"CC BY-NC-ND 4.0; permission to redistribute adapted data not established",
        "measuredVsPredicted":"Source XLSX columns only; NO model calibration or new prediction",
        "timeUnit":"unknown_in_uploaded_workbook",
        "measurementUnit":"unknown_in_uploaded_workbook",
        "reportedStandardDeviationMeaning":"source column; statistical interpretation unverified",
        "records":records,
        "leakageGate":{"overlapGrowthSecondary":common_growth,
            "overlapPrimarySecondary":common_primary,
            "secondaryOnlyExperimentCandidates":sorted(secondary-growth-primary),
            "secondaryIsGloballyIndependentHoldout":not common_growth and not common_primary,
            "sourcePredictionsProvenIndependent":False,
            "canClaimIndependentModelValidation":False},
        "physicalClaims":{"measurementUnitsAuthenticated":False,
            "originalExperimentProtocolsAuthenticated":False,
            "newKineticParametersEstimated":False,"prospectivePredictionsExecuted":False,
            "physicalPbeValidated":False,"sourceDataRedistributionPermitted":False}}

def make_manifest(bundle:dict)->dict:
    return {k:v for k,v in bundle.items() if k!="records"}|{
        "workbooks":{name:{k:v for k,v in entry.items() if k!="rows"}
            for name,entry in bundle["records"].items()},
        "containsRawMeasurements":False,
        "dataDisclosure":"metadata-only; no measured or predicted sample values"}

def main()->None:
    ap=argparse.ArgumentParser(description=__doc__)
    for name in SHEETS: ap.add_argument("--"+name,required=True,type=Path)
    ap.add_argument("--out-local",type=Path,help="Write PRIVATE transformed data JSON; do not commit")
    ap.add_argument("--manifest",type=Path,help="Metadata-only digest, counts and overlap summary")
    args=ap.parse_args()
    bundle=make_bundle({name:getattr(args,name) for name in SHEETS})
    for path,obj in ((args.out_local,bundle),(args.manifest,make_manifest(bundle))):
        if path is None: continue
        if path.exists(): raise IntakeError("Refusing to overwrite "+str(path))
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        if path==args.out_local:
            try: path.chmod(0o600)
            except OSError: pass
    print(json.dumps(make_manifest(bundle),indent=2))

if __name__=="__main__":
    try:main()
    except (IntakeError,OSError,ValueError) as exc:
        print("Lovastatin intake rejected: "+str(exc),file=sys.stderr)
        raise SystemExit(2)
