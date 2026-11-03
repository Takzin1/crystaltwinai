import test from "node:test";
import assert from "node:assert/strict";
import {loadInductionSource} from "../scripts/expand-induction-source";
import {
 INDUCTION_EVIDENCE,INDUCTION_MODELS,
 inductionCdfComparison,validateInductionSource
} from "../src/lib/induction-source";

test("real uploaded XLSX transcript is SHA-256 pinned with 17 original cases and 131 measurements",()=>{
 const {source,sourceSha256}=loadInductionSource();
 assert.equal(sourceSha256,INDUCTION_EVIDENCE.jsonSha256);
 assert.equal(source.sourceSha256,INDUCTION_EVIDENCE.xlsxSha256);
 assert.equal(source.data.length,17);
 assert.equal(source.data.filter(x=>x.partition==="train").length,14);
 assert.equal(source.data.filter(x=>x.partition==="holdout_source_label").length,3);
 assert.equal(source.data.reduce((n,c)=>n+c.inductionTimesSource.length,0),131);
 assert.equal(source.measurementTimeUnit,"not_stated_in_workbook");
 assert.equal(source.volumeUnit,"not_stated_in_workbook");
 assert.equal(source.modelReproducedByCrystalTwinAI,false);
 assert.equal(source.data[0].id,"EasyMax-85-RC-150");
 assert.deepEqual(source.data[0].inductionTimesSource,[24902,30160,33250,33440,60710]);
 assert.equal(source.data[0].hydrodynamics.sr_mean,11.85);
 assert.deepEqual(validateInductionSource(source),source);
});
test("three source-labeled heldout CDFs pair only with the matching untrained experiments",()=>{
 const {source}=loadInductionSource();
 const counts=[9,7,5];
 assert.deepEqual(source.heldoutSourceCdf.map(x=>x.timeSource.length),counts);
 for(const [i,curve] of source.heldoutSourceCdf.entries()){
  assert.equal(curve.caseId,source.data[14+i].id);
  assert.equal(curve.empiricalCdf[0],1/counts[i]);
  assert.equal(curve.empiricalCdf.at(-1),1);
  for(const model of INDUCTION_MODELS){
   const r=inductionCdfComparison(curve,model);
   assert.ok(r.rmseProbability>=0&&r.rmseProbability<=1);
   assert.equal(r.n,counts[i]);
   assert.match(r.label,/not_crystaltwinai_prediction/);
  }
 }
});
test("source did not sort or impute raw replicate times when importing source rows",()=>{
 const {source}=loadInductionSource();
 const raw=source.data.find(x=>x.id==="OptiMax-630-RC-220")!;
 const cdf=source.heldoutSourceCdf.find(x=>x.caseId===raw.id)!;
 assert.deepEqual(raw.inductionTimesSource,[6518,14990,14972,18942,20680,21360,37088]);
 assert.deepEqual(cdf.timeSource,[6518,14972,14990,18942,20680,21360,37088]);
});
test("fail-closed against invented units, leakage, changed source observations or fake model evidence",()=>{
 const orig=loadInductionSource().source;
 const copy=()=>structuredClone(orig);
 let x=copy();x.measurementTimeUnit="seconds" as typeof x.measurementTimeUnit;
 assert.throws(()=>validateInductionSource(x),/unit boundary/);
 x=copy();x.modelReproducedByCrystalTwinAI=true as false;
 assert.throws(()=>validateInductionSource(x),/evidence category/);
 x=copy();x.data[0].partition="holdout_source_label";
 assert.throws(()=>validateInductionSource(x),/partition/);
 x=copy();x.data[0].inductionTimesSource.push(20);
 assert.throws(()=>validateInductionSource(x),/raw observation count/);
 x=copy();x.heldoutSourceCdf[0].empiricalCdf[0]=.45;
 assert.throws(()=>validateInductionSource(x),/rank\/n/);
 x=copy();x.heldoutSourceCdf[0].timeSource[0]=2;
 assert.throws(()=>validateInductionSource(x),/not equal/);
 x=copy();x.heldoutSourceCdf[0].paperModelCdf["J7+T8"][0]=2;
 assert.throws(()=>validateInductionSource(x),/numeric range/);
 x=copy();x.sourceSha256="0".repeat(64);
 assert.throws(()=>validateInductionSource(x),/provenance/);
});