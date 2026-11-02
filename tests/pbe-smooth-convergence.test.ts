import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVECTION_ACCURACY_VERSION, runAnalyticPbeAccuracyStudy,
} from "../src/lib/pbe-analytic-accuracy";

const setup={
  initialProfile:"smooth_sin4" as const,
  initialSupportUm:[15,45] as [number,number],
  growthUmPerMin:0.6,timeMinutes:20,numberPerMl:100000,
  meshes:[64,128,256],
};
const l1=(xs:readonly number[],ys:readonly number[])=>xs.reduce((a,v,i)=>a+Math.abs(v-ys[i]),0)/setup.numberPerMl;

test("smooth sin^4 exact cell-integral reference is normalized, bounded and deterministic",()=>{
  const reference=runAnalyticPbeAccuracyStudy({...setup,maxCourant:0.4});
  assert.deepEqual(reference,runAnalyticPbeAccuracyStudy({...setup,maxCourant:0.4}));
  assert.equal(reference.version,ADVECTION_ACCURACY_VERSION);
  assert.equal(reference.kind,"analytic_const_velocity_smooth_numeric_verification");
  assert.equal(reference.settings.initialProfile,"smooth_sin4");
  assert.equal(reference.expectedMeanUm,42);
  assert.equal(reference.settings.maxCourant,0.4);
  for(const c of reference.cases){
    const exactTotal=c.exactBinCount.reduce((a,b)=>a+b,0);
    const actualTotal=c.predictedBinCount.reduce((a,b)=>a+b,0);
    assert.ok(Math.abs(exactTotal-setup.numberPerMl)/setup.numberPerMl<1e-12);
    assert.ok(Math.abs(actualTotal-setup.numberPerMl)/setup.numberPerMl<1e-11);
    assert.ok(c.particleNumberRelativeError<1e-11);
    assert.ok(c.predictedBinCount.every(x=>Number.isFinite(x)&&x>=0));
    assert.ok(c.exactBinCount.every(x=>Number.isFinite(x)&&x>=0));
    assert.ok(c.minimumBinCount>=0);
    assert.ok(Math.abs(c.firstMomentErrorUm)<0.035);
    assert.ok(Math.abs(c.normalizedL1-l1(c.predictedBinCount,c.exactBinCount))<1e-13);
    assert.ok(c.courant>0&&c.courant<=0.4+1e-12);
  }
  assert.equal(reference.physicalClaims.laboratoryMeasurements,false);
  assert.equal(reference.physicalClaims.crystallizationKineticsValidated,false);
});

test("spatial refinement shows empirical orders without asserting a universal order",()=>{
  const r=runAnalyticPbeAccuracyStudy({...setup,maxCourant:0.4});
  assert.equal(r.trend.upwindL1StrictlyDecreases,true);
  assert.equal(r.trend.musclL1StrictlyDecreases,true);
  assert.equal(r.trend.musclL1LowerAtEveryMesh,true);
  const u=r.comparisons.map(x=>x.upwindL1),m=r.comparisons.map(x=>x.musclL1);
  for(let i=0;i<2;i++){
    const upwindOrder=Math.log2(u[i]/u[i+1]);
    const musclOrder=Math.log2(m[i]/m[i+1]);
    assert.ok(upwindOrder>0.65&&upwindOrder<1.4,"upwind empirical order "+upwindOrder);
    assert.ok(musclOrder>1.2&&musclOrder<2.2,"MUSCL empirical order "+musclOrder);
  }
  assert.ok(m[2]<u[2]/3,"MUSCL must reduce fine-grid smooth-profile error.");
  assert.equal(r.trend.asymptoticOrderCertified,false);
});

test("temporal self-convergence isolates timestep error at fixed spatial grid",()=>{
  const results=[0.4,0.2,0.1].map(maxCourant=>
    runAnalyticPbeAccuracyStudy({...setup,maxCourant}));
  for(const scheme of ["upwind","muscl-minmod-ssprk2"] as const){
    const sequences=results.map(r=>r.cases.find(c=>c.bins===128&&c.scheme===scheme)!);
    assert.deepEqual(sequences.map(s=>s.timeSteps),[32,64,128]);
    assert.ok(sequences.every(s=>s.particleNumberRelativeError<1e-11));
    const coarse=l1(sequences[0].predictedBinCount,sequences[1].predictedBinCount);
    const fine=l1(sequences[1].predictedBinCount,sequences[2].predictedBinCount);
    assert.ok(fine>0&&coarse>fine,"time differences fail for "+scheme);
    const order=Math.log2(coarse/fine);
    assert.ok(order>(scheme==="upwind"?0.7:1.55),"time convergence "+scheme+": "+order);
    assert.ok(order<(scheme==="upwind"?1.5:2.5),"time order overclaim "+scheme+": "+order);
  }
});

test("zero-growth smooth profile is exact identity without false convergence claims",()=>{
  const r=runAnalyticPbeAccuracyStudy({...setup,growthUmPerMin:0});
  assert.ok(r.cases.every(c=>c.normalizedL1===0&&c.particleNumberRelativeError<1e-11));
  assert.equal(r.trend.musclL1LowerAtEveryMesh,false);
});

test("invalid profiles and Courant values fail closed",()=>{
  for(const maxCourant of [0,-.1,0.001,0.41,1,Infinity,NaN])
    assert.throws(()=>runAnalyticPbeAccuracyStudy({...setup,maxCourant}),/Courant/);
  assert.throws(()=>runAnalyticPbeAccuracyStudy({
    ...setup,initialProfile:"measured_lab_trace" as "top_hat",
  }),/Unknown analytic initial profile/);
});

test("32 deterministic alternate smooth supports conserve nonnegative particle counts",()=>{
  let seed=0x12c0ffee;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<32;i++){
    const a=5+rand()*20;
    const b=a+15+rand()*24;
    const maxCourant=[0.1,0.2,0.4][i%3];
    const report=runAnalyticPbeAccuracyStudy({
      initialProfile:"smooth_sin4",initialSupportUm:[a,b],
      growthUmPerMin:0.1+rand()*0.8,timeMinutes:5+rand()*20,
      numberPerMl:10000+rand()*1000000,maxCourant,meshes:[48,96,192],
    });
    for(const row of report.cases){
      assert.ok(row.particleNumberRelativeError<1e-9);
      assert.ok(row.minimumBinCount>=0&&row.normalizedL1>=0);
      assert.ok(Number.isFinite(row.firstMomentUm));
      assert.ok(row.courant<=maxCourant+1e-12);
    }
  }
});
