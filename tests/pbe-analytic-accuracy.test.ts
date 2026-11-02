import assert from "node:assert/strict";
import test from "node:test";
import { runAnalyticPbeAccuracyStudy,ADVECTION_ACCURACY_VERSION } from "../src/lib/pbe-analytic-accuracy";

test("analytic characteristic benchmark is deterministic, number-conserving, and tested against exact finite-volume bins",()=>{
 const a=runAnalyticPbeAccuracyStudy();
 assert.deepEqual(a,runAnalyticPbeAccuracyStudy());
 assert.equal(a.version,ADVECTION_ACCURACY_VERSION);
 assert.equal(a.kind,"analytic_const_velocity_top_hat_numeric_verification");
 assert.deepEqual(a.settings.meshes,[64,128,256]);
 assert.equal(a.expectedMeanUm,28);
 assert.equal(a.cases.length,6);
 assert.equal(a.comparisons.length,3);
 assert.equal(a.trend.asymptoticOrderCertified,false);
 assert.equal(a.physicalClaims.laboratoryMeasurements,false);
 assert.equal(a.physicalClaims.crystallizationKineticsValidated,false);
 for(const c of a.cases){
   assert.ok(c.normalizedL1>=0 && c.normalizedL1<1);
   assert.ok(c.particleNumberRelativeError<1e-11,"Number conservation "+c.bins);
   assert.ok(Math.abs(c.firstMomentErrorUm)<0.05,"First moment "+c.bins);
   assert.ok(c.minimumBinCount>=0);
   assert.ok(c.courant<=0.4000000001);
   assert.equal(c.exactBinCount.length,c.bins);
   assert.equal(c.predictedBinCount.length,c.bins);
   assert.ok(c.exactBinCount.every(v=>Number.isFinite(v)&&v>=0));
   assert.ok(c.predictedBinCount.every(v=>Number.isFinite(v)&&v>=0));
 }
 assert.equal(a.trend.upwindL1StrictlyDecreases,true);
 assert.equal(a.trend.musclL1StrictlyDecreases,true);
 assert.equal(a.trend.musclL1LowerAtEveryMesh,true);
 assert.ok(a.comparisons.every(c=>c.musclImprovementFraction>0&&c.musclImprovementFraction<1));
});

test("zero advection matches the exact analytic bins at every grid",()=>{
 const r=runAnalyticPbeAccuracyStudy({growthUmPerMin:0});
 assert.ok(r.cases.every(c=>c.normalizedL1===0 &&
   c.particleNumberRelativeError<1e-12 &&
   c.firstMomentErrorUm<0.5));
 assert.ok(r.comparisons.every(c=>c.upwindL1===0&&c.musclL1===0));
 assert.equal(r.trend.musclL1LowerAtEveryMesh,false);
});

test("a physically IDENTICAL support is used across all grids, not a first-cell seed substitute",()=>{
 const r=runAnalyticPbeAccuracyStudy({initialSupportUm:[11.2,23.4],timeMinutes:10,growthUmPerMin:0.7});
 assert.deepEqual(r.settings.initialSupportUm,[11.2,23.4]);
 assert.ok(r.cases.every(c=>Math.abs(c.totalNumberPerMl-100000)<1e-6));
 assert.ok(r.cases.every(c=>Math.abs(c.firstMomentUm-r.expectedMeanUm)<0.1));
});

test("bad grids, impossible supports and nonphysical input fail closed",()=>{
 const bad=[
  {meshes:[256,128,64]}, {meshes:[32,32,128]}, {meshes:[16,64,128]},
  {meshes:[64,128,512]}, {meshes:[64,128]},
  {numberPerMl:0}, {numberPerMl:Infinity},{numberPerMl:NaN},
  {timeMinutes:-1}, {timeMinutes:Infinity},
  {growthUmPerMin:-.1},{growthUmPerMin:2.1},
  {initialSupportUm:[20,10] as [number,number]},
  {initialSupportUm:[0,1] as [number,number]},
  {initialSupportUm:[110,119] as [number,number]},
  {timeMinutes:120,growthUmPerMin:1},
 ];
 for(const inputs of bad)
   assert.throws(()=>runAnalyticPbeAccuracyStudy(inputs),/./,
     "should reject "+JSON.stringify(inputs));
});
