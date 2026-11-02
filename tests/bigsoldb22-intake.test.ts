import assert from "node:assert/strict";
import test from "node:test";
import {
  BIGSOLDB22_SOURCE, attestBigSolDB22Source, calculateGitBlobSha1,
  convertBigSolDB22Rows, convertOfficialBigSolDB22, type BigSolDB22Selection,
} from "../scripts/import-bigsoldb22";
import { parseResearchDataset } from "../src/lib/research-schema";
import { evaluateEquilibriumReference } from "../src/lib/equilibrium-reference";
import { makeResearchEvidenceManifest } from "../src/lib/research-evidence";

const header=[
  "SMILES_Solute","Temperature_K","Solvent","SMILES_Solvent",
  "Solubility(mole_fraction)","Solubility(mol/L)","LogS(mol/L)",
  "Compound_Name","CAS","PubChem_CID","FDA_Approved","Source",
  "MeasurementTechnique","Solid_Phase",
];
const doi="10.1234/synthetic-test-only";
const selection:BigSolDB22Selection={
  compound:"Toy reference compound",solvent:"ethanol",doi,
  methodColumn:"MeasurementTechnique",solidFormColumn:"Solid_Phase",
};
const stub={
  sha256:"a".repeat(64),
  gitBlobSha1:BIGSOLDB22_SOURCE.gitBlobSha1,
  byteLength:BIGSOLDB22_SOURCE.sizeBytes,
};
function csv(options?:{mixedMethod?:boolean,mixedForm?:boolean,duplicates?:boolean,badUnit?:boolean}) {
  const rows=Array.from({length:6},(_,i)=>[
    "TOY-SOLUTE",(293.15+(options?.duplicates&&i===4?3:i)*5).toFixed(2),
    "ethanol","CCO",
    String(options?.badUnit&&i===1?100:0.05+0.005*i),
    "1","0","Toy reference compound","00-00-0","1","No",doi,
    options?.mixedMethod&&i===5?"spectroscopy":"gravimetric",
    options?.mixedForm&&i===5?"Form B":"Form A",
  ]);
  return [header.join(","),...rows.map(row=>row.join(","))].join("\n")+"\n";
}
test("official BigSolDB v2.2 metadata is pinned to GitHub revision and exact Git object",()=>{
  assert.equal(BIGSOLDB22_SOURCE.githubRepository,"levakrasnovs/BigSolDBv2.0");
  assert.equal(BIGSOLDB22_SOURCE.sizeBytes,24678209);
  assert.equal(BIGSOLDB22_SOURCE.gitBlobSha1,"0108873f585dae3700923367b59030e002ac71f5");
  assert.equal(calculateGitBlobSha1(Buffer.from("hello")),
    "b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0");
  assert.throws(()=>attestBigSolDB22Source(Buffer.from(csv())),/byte length/);
  assert.throws(()=>convertOfficialBigSolDB22(Buffer.from(csv()),selection),/byte length/);
});

test("synthetic fixture: preserve method, solid form, native mole fraction, hash trace",()=>{
  const data=convertBigSolDB22Rows(csv(),selection,stub);
  assert.equal(data.schemaVersion,2);
  assert.equal(data.metadata.provenance,"unverified");
  assert.equal(data.metadata.concentrationBasis,"mole_fraction");
  assert.equal(data.metadata.units.solubility,"mole_fraction");
  assert.equal(data.metadata.measurementMethod,"gravimetric");
  assert.equal(data.metadata.solidForm,"Form A");
  assert.equal(data.metadata.license,undefined);
  assert.equal(data.metadata.sourceFileSha256,stub.sha256);
  assert.equal(data.metadata.transformations?.[0]?.inputSha256,stub.sha256);
  assert.equal(data.measurements.length,6);
  assert.equal(data.measurements[1].temperature,298.15);
  assert.equal(data.measurements[1].solubility,0.055);
  assert.equal(parseResearchDataset(JSON.stringify(data)).metadata.solidForm,"Form A");
  const holdout=evaluateEquilibriumReference(data);
  assert.equal(holdout.partition.holdoutCount,2);
  assert.equal(holdout.reference.provenance,"unverified");
  const record=makeResearchEvidenceManifest({
    dataset:data,researchJsonSha256:"b".repeat(64),
    originalSourceFile:null,generatedAt:"2026-11-02T11:30:00.000Z",
  });
  assert.equal(record.declaredMetadata.solidForm,"Form A");
  assert.equal(record.verificationClaims.originalPublisherAuthenticated,false);
  assert.equal(record.verificationClaims.physicalMeasurementVerified,false);
});

test("mixed measurement protocols and polymorphs fail closed unless explicitly separated",()=>{
  assert.throws(()=>convertBigSolDB22Rows(csv({mixedMethod:true}),selection,stub),/Mixed measurement method/);
  assert.throws(()=>convertBigSolDB22Rows(csv({mixedForm:true}),selection,stub),/Mixed solid form/);
  const selected=convertBigSolDB22Rows(csv({mixedMethod:true,mixedForm:true}),
    {...selection,methodValue:"gravimetric",solidFormValue:"Form A"},stub);
  assert.equal(selected.measurements.length,5);
  assert.equal(selected.metadata.solidForm,"Form A");
  assert.equal(selected.metadata.measurementMethod,"gravimetric");
  assert.throws(()=>convertBigSolDB22Rows(csv({mixedMethod:true}),
    {...selection,methodValue:"spectroscopy"},stub),/5..1000/);
  assert.throws(()=>convertBigSolDB22Rows(csv(),
    {...selection,methodValue:"unknown"},stub),/not match/);
});

test("no silent unit conversion or chemical/provenance mixtures",()=>{
  assert.throws(()=>convertBigSolDB22Rows(csv({badUnit:true}),selection,stub),/Invalid source-native/);
  assert.throws(()=>convertBigSolDB22Rows(csv({duplicates:true}),selection,stub),/Duplicate temperatures/);
  assert.throws(()=>convertBigSolDB22Rows(csv().replace("Toy reference compound","Other compound").replace("Toy reference compound","Other compound"),selection,stub),/5..1000/);
  assert.throws(()=>convertBigSolDB22Rows(csv().replace("TOY-SOLUTE,308.15","OTHER-SOLUTE,308.15"),selection,stub),/Mixed or missing SMILES_Solute/);
  assert.throws(()=>convertBigSolDB22Rows(csv().replace("10.1234/synthetic-test-only","10.9999/different").replace("10.1234/synthetic-test-only","10.9999/different"),selection,stub),/5..1000/);
  assert.throws(()=>convertBigSolDB22Rows(csv().replace("Solubility(mole_fraction)","Solubility(mol/kg)"),selection,stub),/Duplicate header names|Missing required/);
  assert.throws(()=>convertBigSolDB22Rows(csv(),{...selection,methodColumn:"not_a_column"},stub),/existing metadata column/);
  assert.throws(()=>convertBigSolDB22Rows(csv(),{...selection,solidFormValue:"Form A",solidFormColumn:undefined},stub),/requires an explicit/);
  assert.throws(()=>convertBigSolDB22Rows(csv(),{...selection,methodColumn:"Solid_Phase"},stub),/must differ/);
  assert.throws(()=>convertBigSolDB22Rows(csv(),selection,{...stub,sha256:"bad"}),/Malformed source evidence/);
});


test("official v2.2 solid_form_label is an explicit gate rather than silently pooling polymorphs",()=>{
  const officialFixture=csv().replace("Solid_Phase","solid_form_label");
  assert.throws(()=>convertBigSolDB22Rows(officialFixture,
    {...selection,solidFormColumn:undefined},stub),
    /requires explicit --solid-form-column/);
  const selected=convertBigSolDB22Rows(officialFixture,
    {...selection,solidFormColumn:"solid_form_label"},stub);
  assert.equal(selected.metadata.solidForm,"Form A");
  assert.throws(()=>convertBigSolDB22Rows(
    officialFixture.replace(",Form A\n",",\n"),
    {...selection,solidFormColumn:"solid_form_label"},stub),
    /solid form is missing/);
});

test("pure-solvent molarity and logS cannot impersonate measurement protocol metadata",()=>{
  for(const methodColumn of ["Solubility(mol/L)","LogS(mol/L)","CAS"]){
    assert.throws(()=>convertBigSolDB22Rows(csv(),{...selection,methodColumn},stub),
      /cannot be mapped to a numeric or chemical metadata column/);
  }
});
