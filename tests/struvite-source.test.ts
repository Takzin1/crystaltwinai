import assert from "node:assert/strict";
import test from "node:test";
import { expandStruviteBundle } from "../scripts/expand-struvite-evidence";
import {
  STRUVITE_SOURCE,validateStruviteBundle,measuredVsSimulatedPsdL1
} from "../src/lib/struvite-source";

test("complete XLSX-derived real evidence decompresses with exact SHA-256 and all 87 size bins",()=>{
 const {data,jsonText,sha256}=expandStruviteBundle();
 assert.equal(data.schema,"crystaltwin-struvite-poiseuille/1");
 assert.equal(data.sourceXlsxSha256,STRUVITE_SOURCE.xlsxSha256);
 assert.equal(data.sourceZipSha256,STRUVITE_SOURCE.zipSha256);
 assert.equal(sha256,STRUVITE_SOURCE.normalizedJsonSha256);
 assert.equal(Buffer.byteLength(jsonText,"utf8"),23069);
 assert.equal(data.sizeUm.length,87);
 assert.deepEqual(data.sizeUm.slice(0,3),[.01,.0114,.0129]);
 assert.equal(data.sizeUm.at(-1),586);
 assert.equal(data.psd.rMeasured.bySI["0.8"].volPercent.length,87);
 assert.equal(data.psd.ijMeasuredValidation.bySI["1.4"].volPercent.length,87);
 assert.equal(data.psd.rOptimizedModel.bySI["1.0"].volPercent.length,87);
 assert.equal(data.psd.ijGalbraithModel.bySI["0.8"].volPercent.length,87);
 assert.equal(data.psd.rMeasured.bySI["0.8"].volPercent[0],0);
 assert.ok(Math.abs(data.psd.rMeasured.bySI["0.8"].volPercent[62]-5.0858965750641225)<1e-14);
 assert.deepEqual(validateStruviteBundle(data),data);
});

test("measured R fit-side and IJ reported validation never mixed as one scientific claim",()=>{
 const data=expandStruviteBundle().data;
 assert.equal(data.psd.rMeasured.kind,"measured");
 assert.equal(data.psd.ijMeasuredValidation.kind,"measured");
 assert.equal(data.psd.rOptimizedModel.kind,"simulated");
 assert.equal(data.psd.ijGalbraithModel.kind,"simulated");
 for(const si of ["0.8","1.0","1.4"] as const){
   const r=measuredVsSimulatedPsdL1(data,"R",si);
   const ij=measuredVsSimulatedPsdL1(data,"IJ",si);
   assert.ok(r.normalizedL1Fraction>0&&r.normalizedL1Fraction<=2);
   assert.ok(ij.normalizedL1Fraction>0&&ij.normalizedL1Fraction<=2);
   assert.match(r.comparisonType,/fit_side/);
   assert.match(ij.comparisonType,/not_optimized_model_holdout/);
   for(const group of ["rMeasured","rOptimizedModel","ijMeasuredValidation","ijGalbraithModel"] as const){
     const sum=data.psd[group].bySI[si].volPercent.reduce((x,y)=>x+y,0);
     assert.ok(Math.abs(sum-100)<.12,group+" sum="+sum);
   }
 }
 assert.equal(data.modelValidationClaims,false);
});

test("observed phosphate times and missing points remain exactly distinct from model time grids",()=>{
 const data=expandStruviteBundle().data;
 const obs=data.phosphate.rMeasured;
 assert.deepEqual(obs.timeMin,[55,65,75,85,95,105,115,125,135]);
 assert.deepEqual(obs.bySI["1.4"].slice(-3),[null,null,null]);
 assert.equal(obs.bySI["0.8"][0],.008504725);
 assert.equal(obs.reported95CiMolPerL,8.88e-5);
 assert.equal(data.phosphate.optimizedModel.timeMin[0],0);
 assert.equal(data.phosphate.optimizedModel.timeMin.at(-1),140);
 assert.equal(data.phosphate.galbraithModel.timeMin.length,15);
 assert.equal(data.phosphate.unit,"mol/L");
 assert.equal(data.phosphate.analyte,"PO4-P");
 assert.equal(data.phosphate.optimizedModel.bySI["0.8"][0],.009994051);
});

test("malformed evidence, provenance swaps and unsupported CI claims fail closed",()=>{
 const original=expandStruviteBundle().data;
 const candidate=()=>structuredClone(original);
 let bad=candidate();bad.psd.rMeasured.kind="simulated";
 assert.throws(()=>validateStruviteBundle(bad),/provenance was relabeled/);
 bad=candidate();bad.psd.rMeasured.bySI["0.8"].volPercent.pop();
 assert.throws(()=>validateStruviteBundle(bad),/aligned observations/);
 bad=candidate();bad.psd.ijMeasuredValidation.bySI["1.0"].volPercent[8]=-1;
 assert.throws(()=>validateStruviteBundle(bad),/invalid observation/);
 bad=candidate();bad.psd.rMeasured.bySI["0.8"].volPercent[10]+=10;
 assert.throws(()=>validateStruviteBundle(bad),/percent sum/);
 bad=candidate();bad.psd.ijGalbraithModel.bySI["0.8"].ci95Reported=[0];
 assert.throws(()=>validateStruviteBundle(bad),/cannot fabricate confidence/);
 bad=candidate();bad.phosphate.rMeasured.bySI["1.4"][8]=0;
 assert.throws(()=>validateStruviteBundle(bad),/cannot be imputed/);
 bad=candidate();bad.modelValidationClaims=true as false;
 assert.throws(()=>validateStruviteBundle(bad),/validation claims/);
 bad=candidate();bad.sourceXlsxSha256="0".repeat(64);
 assert.throws(()=>validateStruviteBundle(bad),/provenance fingerprint/);
});
