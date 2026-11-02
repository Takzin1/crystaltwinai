import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseResearchDataset } from "../src/lib/research-schema";
import {
  EQUILIBRIUM_BENCHMARK_VERSION, evaluateEquilibriumReference,
} from "../src/lib/equilibrium-reference";
import {
  BIGSOLDB21_SHA256, readCsvTable, convertBigSolDB21,
} from "../scripts/import-bigsoldb21";

const path="public/examples/bigsoldb21-paracetamol-ethanol.measured.json";
const dataset=()=>parseResearchDataset(readFileSync(path,"utf8"));
const selection={
  compound:"Paracetamol",solvent:"ethanol",doi:"10.1007/s10953-005-9007-8",
};

test("verbatim BigSolDB v2.1 sample preserves 5 observed measurements and mole fractions",()=>{
  const parsed=dataset();
  assert.equal(parsed.metadata.experimentMode,"equilibrium_curve");
  assert.equal(parsed.metadata.provenance,"measured");
  assert.equal(parsed.metadata.units.solubility,"mole_fraction");
  assert.equal(parsed.metadata.concentrationBasis,"mole_fraction");
  assert.equal(parsed.metadata.doi,selection.doi);
  assert.deepEqual(parsed.measurements.map(m=>m.temperature),[
    293.15,298.15,303.15,308.15,313.15]);
  assert.deepEqual(parsed.measurements.map(m=>m.solubility),[
    0.05045,0.0546,0.062,0.067,0.0705]);
  assert.equal(parsed.metadata.sourceFileSha256,undefined);
});

test("holdout never fits on the two highest temperatures and is deterministic",()=>{
  const report=evaluateEquilibriumReference(dataset());
  assert.equal(report.reportSchemaVersion,EQUILIBRIUM_BENCHMARK_VERSION);
  assert.equal(report.partition.strategy,"forward_temperature_extrapolation");
  assert.equal(report.partition.trainingCount,3);
  assert.equal(report.partition.holdoutCount,2);
  assert.equal(report.predictions.length,2);
  assert.equal(report.predictions[0].temperatureK,308.15);
  assert.equal(report.predictions[1].temperatureK,313.15);
  assert.ok(report.holdout.linear.rmse>0);
  assert.ok(report.holdout.constant.rmse>0);
  assert.equal(report.scientificClaims.physicalCrystallizationKineticsValidated,false);
  assert.equal(report.scientificClaims.originalArticleIndependentlyVerified,false);
  assert.equal(report.scientificClaims.isOutOfSampleForFittedCurve,true);
  assert.deepEqual(report,evaluateEquilibriumReference(dataset()));
});

test("mutating held-out outcomes does not change training coefficients",()=>{
  const original=dataset();
  const expected=evaluateEquilibriumReference(original);
  original.measurements[3].solubility=0.3;
  original.measurements[4].solubility=0.4;
  const changed=evaluateEquilibriumReference(original);
  assert.deepEqual(changed.baseline,expected.baseline);
  assert.notDeepEqual(changed.holdout,expected.holdout);
});

test("reject non-compatible units, unsupported experiments and duplicate temperatures",()=>{
  const bad=dataset();
  bad.metadata.experimentMode="trajectory";
  assert.throws(()=>evaluateEquilibriumReference(bad));
  const other=dataset();
  other.metadata.units.solubility="mol/L";
  assert.throws(()=>evaluateEquilibriumReference(other),/unit does not match|requires mole_fraction/);
  const duplicates=dataset();
  duplicates.measurements[2].temperature=duplicates.measurements[1].temperature;
  assert.throws(()=>evaluateEquilibriumReference(duplicates),/Duplicate/);
  const invalid=dataset();
  invalid.measurements[0].solubility=Number.NaN;
  assert.throws(()=>evaluateEquilibriumReference(invalid));
});

const columns=[
  "SMILES_Solute","Temperature_K","Solvent","SMILES_Solvent",
  "Solubility(mole_fraction)","Solubility(mol/L)","LogS(mol/L)",
  "Compound_Name","CAS","PubChem_CID","FDA_Approved","Source",
];
const values=[0.05045,0.0546,0.062,0.067,0.0705];
const mockCSV=()=>[columns.join(","),...values.map((v,i)=>
  ["CC(=O)Nc1ccc(O)cc1",(293.15+i*5).toFixed(2),"ethanol","CCO",
    String(v),"1","0","Paracetamol","103-90-2","1983","Yes",selection.doi].join(",")
)].join("\r\n")+"\r\n";

test("strict BigSolDB 2.1 adapter preserves source-native units and grouping",()=>{
  const csv=mockCSV();
  const adapted=convertBigSolDB21(csv,selection,BIGSOLDB21_SHA256);
  assert.deepEqual(adapted.measurements,dataset().measurements);
  assert.equal(adapted.metadata.sourceFileSha256,BIGSOLDB21_SHA256);
  assert.equal(adapted.metadata.transformations?.[0]?.inputSha256,BIGSOLDB21_SHA256);
  assert.equal(adapted.metadata.provenance,"measured");
  assert.equal(evaluateEquilibriumReference(adapted).partition.holdoutCount,2);
});

test("CSV parser handles quotes and rejects malformed input",()=>{
  const rows=readCsvTable('a,b\r\n"quoted, cell","literal ""quote"""\r\n');
  assert.deepEqual(rows,[["a","b"],["quoted, cell",'literal "quote"']]);
  assert.throws(()=>readCsvTable('a,b\n"unterminated'),/Unclosed/);
  assert.throws(()=>readCsvTable('a,b\n1'),/length/);
});

test("adversarial adapter rows: refuse incorrect headers, mixed identities, duplicates and small samples",()=>{
  const csv=mockCSV();
  assert.throws(()=>convertBigSolDB21(csv.replace("Temperature_K","Temp"),selection,BIGSOLDB21_SHA256),/schema/);
  assert.throws(()=>convertBigSolDB21(csv, {...selection,doi:"10.0000/wrong"},BIGSOLDB21_SHA256),/5–1000/);
  assert.throws(()=>convertBigSolDB21(csv.replace("0.05045",""),selection,BIGSOLDB21_SHA256),/Invalid/);
  assert.throws(()=>convertBigSolDB21(csv.replace("303.15","298.15"),selection,BIGSOLDB21_SHA256),/Duplicate/);
  assert.throws(()=>convertBigSolDB21(csv.replace("CCO,0.062","CO,0.062"),selection,BIGSOLDB21_SHA256),/Mixed/);
  assert.throws(()=>convertBigSolDB21(csv.replace("0.062","999"),selection,BIGSOLDB21_SHA256),/Invalid/);
  assert.throws(()=>convertBigSolDB21(csv,selection,"ABC"),/sha256/);
});
