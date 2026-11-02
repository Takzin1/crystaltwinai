import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseResearchDataset } from "../src/lib/research-schema";
import { SOURCE_GALLERY, SOURCE_COMPILATION, EXTERNAL_SOURCE_CANDIDATES } from "../src/lib/source-gallery";

const EXPECTED=[
  {id:"paracetamol-ethanol",material:"Paracetamol",doi:"10.1007/s10953-005-9007-8",len:5,
    temps:[293.15,298.15,303.15,308.15,313.15],
    mol:[.05045,.0546,.062,.067,.0705]},
  {id:"succinic-ethanol",material:"Succinic acid",doi:"10.1007/s10953-012-9951-z",len:12,
    temps:[278.15,283.15,288.15,293.15,298.15,303.15,308.15,313.15,318.15,323.15,328.15,333.15],
    mol:[.0354,.0401,.0422,.0438,.0525,.0633,.0753,.096,.1159,.1372,.1638,.1967]},
  {id:"isoimperatorin-ethanol",material:"Isoimperatorin",doi:"10.1007/s10953-012-9917-1",len:9,
    temps:[288.2,293.2,298.2,303.2,308.2,313.2,318.2,323.2,328.2],
    mol:[.002631,.003774,.005313,.00733,.009987,.013379,.017758,.023003,.03005]},
] as const;
test("curated BigSolDB viewer subsets preserve independently transcribed native observations",()=>{
  assert.equal(SOURCE_GALLERY.length,3);
  for(const expected of EXPECTED){
    const record=SOURCE_GALLERY.find(v=>v.id===expected.id);
    assert.ok(record);
    const raw=readFileSync("public"+record.path,"utf8");
    const source=parseResearchDataset(raw);
    assert.equal(source.metadata.title.includes(expected.material),true);
    assert.ok(source.metadata.material===expected.material||source.metadata.material.startsWith(expected.material+" ("));
    assert.equal(source.metadata.solvent,"ethanol");
    assert.equal(source.metadata.doi,expected.doi);
    assert.equal(source.metadata.sourceUrl,SOURCE_COMPILATION.url);
    assert.equal(source.metadata.provenance,"measured");
    assert.equal(source.metadata.experimentMode,"equilibrium_curve");
    assert.equal(source.metadata.concentrationBasis,"mole_fraction");
    assert.equal(source.metadata.units.temperature,"K");
    assert.equal(source.metadata.units.solubility,"mole_fraction");
    assert.equal(source.metadata.sourceFileSha256,undefined);
    assert.equal(source.measurements.length,expected.len);
    assert.deepEqual(source.measurements.map(p=>p.temperature),expected.temps);
    assert.deepEqual(source.measurements.map(p=>p.solubility),expected.mol);
    assert.match(source.metadata.notes??"",/not independently (verified|authenticated)/i);
    assert.match(source.metadata.license??"",/CC BY 4.0/);
    assert.ok(source.measurements.every(p=>p.temperature!>0&&p.solubility!>0&&p.solubility!<1));
  }
});
test("source candidate rights and experimental authenticity are not misrepresented",()=>{
  assert.equal(SOURCE_COMPILATION.originalArticleRightsAuthenticated,false);
  assert.equal(SOURCE_COMPILATION.rawInstrumentFilesAuthenticated,false);
  assert.equal(SOURCE_COMPILATION.publishedViewerRowsOnly,true);
  assert.ok(EXTERNAL_SOURCE_CANDIDATES.some(s=>s.license==="CC BY-NC-ND"));
  assert.ok(EXTERNAL_SOURCE_CANDIDATES.every(s=>s.status.startsWith("external_reference_only")));
});
