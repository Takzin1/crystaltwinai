import assert from "node:assert/strict";
import test from "node:test";
import {
 loadIbuprofenSource
} from "../scripts/expand-ibuprofen-evidence";
import {
 IBUPROFEN_SOURCE,ibuprofenCurveForCondition,
 ibuprofenSourceLabel,validateIbuprofenSource,expandIbuprofenCurve
} from "../src/lib/ibuprofen-source";

test("exact uploaded ZIP -> workbook -> sparse JSON fingerprints validate on all source curves",()=>{
 const {source,normalizedJsonSha256}=loadIbuprofenSource();
 assert.equal(normalizedJsonSha256,IBUPROFEN_SOURCE.normalizedSparseJsonSha256);
 assert.equal(source.sourceZipSha256,IBUPROFEN_SOURCE.zipSha256);
 assert.equal(source.sourceXlsxSha256,IBUPROFEN_SOURCE.xlsxSha256);
 assert.equal(source.sizeNm.length,142);
 assert.equal(source.conditions.length,23);
 assert.equal(source.curves.length,17);
 assert.equal(source.sizeNm[0],.20947417959189);
 assert.equal(source.sizeNm.at(-1),19095.4322284161);
 assert.deepEqual(validateIbuprofenSource(source),source);
});
test("all 23 source-condition curves preserve 100 normalized reported percentage points and source null",()=>{
 const {source}=loadIbuprofenSource();
 for(const condition of source.conditions){
  const row=ibuprofenCurveForCondition(source,condition.id);
  assert.equal(row.distribution.length,142);
  assert.ok(Math.abs(row.totalPercent-100)<1e-6,condition.id);
  assert.ok(row.distribution.every(x=>x===null||(Number.isFinite(x)&&x>=0)));
  assert.ok(row.d50ReportedBinNm!==null&&row.d50ReportedBinNm>0);
 }
 const thick=ibuprofenCurveForCondition(source,"thickness-707_2");
 assert.equal(thick.distribution[141],null);
 assert.equal(source.curves.reduce((n,c)=>n+c.missing.length,0),1);
 assert.equal(ibuprofenCurveForCondition(source,"solvent-c10-e10").distribution[141],0);
});
test("reported identical curves are joined by exact source identity instead of treated as independent replicates",()=>{
 const {source}=loadIbuprofenSource();
 const curve=(id:string)=>source.conditions.find(c=>c.id===id)!.curve;
 assert.equal(curve("solvent-c10-e10"),curve("cooling-c10-t5"));
 assert.equal(curve("solvent-c30-e10"),curve("cooling-c30-t5"));
 assert.equal(curve("solvent-c30-e10"),curve("thickness-176_8"));
 assert.equal(curve("solvent-c30-e10"),curve("film-diameter-6cm"));
 assert.equal(curve("thickness-55_4"),curve("film-diameter-4cm"));
 assert.equal(curve("thickness-353_6"),curve("film-diameter-2cm"));
 assert.equal(new Set(source.conditions.map(c=>c.curve)).size,17);
});
test("condition labels preserve original units: film-thickness unit not assumed, diameter in cm",()=>{
 const {source}=loadIbuprofenSource();
 const get=(id:string)=>source.conditions.find(c=>c.id===id)!;
 assert.match(ibuprofenSourceLabel(get("solvent-c5-e20")),/0\.05 g\/mL.*0\.2/);
 assert.match(ibuprofenSourceLabel(get("cooling-c30-t-5")),/-5 °C/);
 assert.match(ibuprofenSourceLabel(get("thickness-707_2")),/unit unspecified/);
 assert.match(ibuprofenSourceLabel(get("film-diameter-12cm")),/12 cm/);
});
test("adversarial data modifications fail with evidence rather than silent reweighting",()=>{
 const {source}=loadIbuprofenSource();
 const clone=()=>structuredClone(source);
 let bad=clone();bad.reportedDistributionBasis="number_percent" as typeof bad.reportedDistributionBasis;
 assert.throws(()=>validateIbuprofenSource(bad),/basis/);
 bad=clone();bad.sourceXlsxSha256="0".repeat(64);
 assert.throws(()=>validateIbuprofenSource(bad),/fingerprint/);
 bad=clone();bad.sizeNm[25]=bad.sizeNm[24];
 assert.throws(()=>validateIbuprofenSource(bad),/increasing/);
 bad=clone();bad.curves[0].nonzero[0][1]=-1;
 assert.throws(()=>validateIbuprofenSource(bad),/invalid or duplicated/);
 bad=clone();bad.curves[0].nonzero[0][1]=50;
 assert.throws(()=>validateIbuprofenSource(bad),/curve sum/);
 bad=clone();bad.curves[0].missing=[141];
 assert.throws(()=>validateIbuprofenSource(bad),/missing original final/);
 bad=clone();bad.conditions[0].sourceColumn=17;
 assert.throws(()=>validateIbuprofenSource(bad),/worksheet-column/);
 bad=clone();bad.conditions[1].id=bad.conditions[0].id;
 assert.throws(()=>validateIbuprofenSource(bad),/identity/);
 bad=clone();bad.conditions[0].curve=17;
 assert.throws(()=>validateIbuprofenSource(bad),/identity/);
});
test("sparse source expansion must reject a false zero in a missing cell",()=>{
 assert.deepEqual(expandIbuprofenCurve(3,{nonzero:[[0,45],[2,55]],missing:[1]}),[45,null,55]);
 assert.throws(()=>expandIbuprofenCurve(3,{nonzero:[[0,45],[2,55]],missing:[2]}),/Missing cell index/);
 assert.throws(()=>expandIbuprofenCurve(3,{nonzero:[[0,45],[0,55]],missing:[]}),/invalid or duplicated/);
});