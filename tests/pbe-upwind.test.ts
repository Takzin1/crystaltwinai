import test from "node:test";
import assert from "node:assert/strict";
import {
  PBE_REFERENCE_VERSION, DEFAULT_PBE_SETTINGS, auditPbeReport,
  runPbeUpwind, studyPbeGridRefinement, validatePbeSettings,
  type PbeSettings,
} from "../src/lib/pbe-upwind";

test("default finite-volume PBE is deterministic, finite, positive and internally mass-closed",()=>{
  const original=structuredClone(DEFAULT_PBE_SETTINGS);
  const a=runPbeUpwind(original);
  assert.deepEqual(a,runPbeUpwind(structuredClone(original)));
  assert.deepEqual(original,DEFAULT_PBE_SETTINGS);
  assert.equal(a.schemaVersion,PBE_REFERENCE_VERSION);
  assert.equal(a.frames.length,60);
  assert.ok(a.summary.maximumCourant<=0.800000001);
  assert.ok(a.summary.maximumMassClosureResidualGPerMl<1e-9);
  assert.ok(a.summary.minimumLiquidGPerMl>=0);
  assert.equal(a.scientificClaims.originalExperimentalDataUsed,false);
  assert.equal(a.scientificClaims.realPopulationBalanceValidated,false);
  assert.equal(a.scientificClaims.equipmentControlSuitable,false);
  assert.equal(a.assumptions.fittedToExperimentalData,false);
  assert.equal(auditPbeReport(a).passed,true);
  assert.ok(a.frames.every(f=>f.totalCountPerMl>0 && f.liquidGPerMl>=0 &&
    f.binNumberPerMl.every(v=>Number.isFinite(v)&&v>=0) &&
    f.d10NumberUm!<=f.d50NumberUm! && f.d50NumberUm!<=f.d90NumberUm!));
});

test("pure advection with no births conserves number and matches first moment until terminal bin",()=>{
  const s:PbeSettings={
    ...DEFAULT_PBE_SETTINGS,steps:20,stepMinutes:0.5,
    growthUmPerMin:0.5,nucleationCountPerMlMin:0,
    initialSeedCountPerMl:100,initialLiquidGPerMl:1,
  };
  const report=runPbeUpwind(s);
  const firstCenter=report.bins.midpointsUm[0];
  const last=report.frames.at(-1)!;
  assert.equal(report.summary.cappedAtUpperBoundary,false);
  assert.ok(Math.abs(last.totalCountPerMl-s.initialSeedCountPerMl)<1e-9);
  assert.ok(Math.abs(last.numberMeanUm!-(firstCenter+s.steps*s.stepMinutes*s.growthUmPerMin))<1e-8);
  assert.ok(report.summary.maximumMassClosureResidualGPerMl<1e-9);
  assert.equal(auditPbeReport(report).passed,true);
});

test("nucleation-only produces exactly J * t additional particles; no size advection",()=>{
  const s={...DEFAULT_PBE_SETTINGS,
    growthUmPerMin:0,nucleationCountPerMlMin:100,
    initialSeedCountPerMl:100,steps:12,stepMinutes:0.5};
  const report=runPbeUpwind(s);
  const last=report.frames.at(-1)!;
  const births=s.nucleationCountPerMlMin*s.steps*s.stepMinutes;
  assert.ok(Math.abs(last.cumulativeBirthsPerMl-births)<1e-9);
  assert.ok(Math.abs(last.totalCountPerMl-s.initialSeedCountPerMl-births)<1e-9);
  assert.equal(last.d10NumberUm,report.bins.midpointsUm[0]);
  assert.equal(last.d90NumberUm,report.bins.midpointsUm[0]);
  assert.ok(report.summary.maximumMassClosureResidualGPerMl<1e-9);
});

test("depletion cuts back growth and births without creating negative dissolved mass",()=>{
  const s={...DEFAULT_PBE_SETTINGS,
    initialLiquidGPerMl:0.00001,growthUmPerMin:1.8,
    initialSeedCountPerMl:1e7,nucleationCountPerMlMin:1e7,steps:40};
  const report=runPbeUpwind(s);
  assert.ok(report.summary.minimumLiquidGPerMl>=0);
  assert.ok(report.frames.at(-1)!.liquidGPerMl<1e-8);
  assert.ok(report.summary.maximumMassClosureResidualGPerMl<1e-8);
  assert.equal(auditPbeReport(report).passed,true);
});

test("terminal bin caps flux explicitly, preserving mass and count but not claiming size validity",()=>{
  const s={...DEFAULT_PBE_SETTINGS,
    bins:32,minLengthUm:1,maxLengthUm:21,
    growthUmPerMin:2,steps:70,
    initialSeedCountPerMl:10,initialLiquidGPerMl:1};
  const report=runPbeUpwind(s);
  assert.equal(report.summary.cappedAtUpperBoundary,true);
  assert.equal(report.frames.at(-1)!.upperBoundaryCapped,true);
  assert.equal(auditPbeReport(report).passed,true);
  assert.equal(report.scientificClaims.physicalKineticsValidated,false);
});

test("exported frame corruption is detected independently for counts, mass, time and quantiles",()=>{
  const original=runPbeUpwind();
  assert.equal(auditPbeReport(original).passed,true);
  for(const mutate of [
    (r:typeof original)=>{r.frames[3].binNumberPerMl[0]=-2;},
    (r:typeof original)=>{r.frames[3].binNumberPerMl[2]+=200000;},
    (r:typeof original)=>{r.frames[3].liquidGPerMl+=0.01;},
    (r:typeof original)=>{r.frames[3].totalCountPerMl+=10;},
    (r:typeof original)=>{r.frames[3].solidGPerMl+=0.02;},
    (r:typeof original)=>{r.frames[3].d50NumberUm=99;},
    (r:typeof original)=>{r.frames[3].step=88;},
    (r:typeof original)=>{r.frames[3].maximumCourant=1.2;},
    (r:typeof original)=>{r.bins.midpointsUm[0]+=3;},
    (r:typeof original)=>{r.bins.particleMassG[0]*=1.1;},
  ]){
    const report=structuredClone(original);
    mutate(report);
    const audit=auditPbeReport(report);
    assert.equal(audit.passed,false,JSON.stringify(audit));
    assert.ok(audit.issues.length>0);
  }
  assert.equal(auditPbeReport(original).passed,true);
});

test("three-mesh study reports grid sensitivity without manufacturing convergence",()=>{
  const {bins:_,...input}=DEFAULT_PBE_SETTINGS;
  const result=studyPbeGridRefinement(input);
  assert.deepEqual(result.meshes,[32,64,128]);
  assert.equal(result.allSoftwareAuditsPass,true);
  assert.equal(result.gridConvergenceCertified,false);
  assert.equal(result.physicalModelValidated,false);
  assert.equal(result.results.length,3);
  assert.equal(result.comparisons.length,2);
  assert.ok(result.comparisons.every(v=>v.absSolidDeltaGPerMl>=0 &&
    v.absD50DeltaUm!==null && v.absD50DeltaUm>=0));
  assert.deepEqual(result,studyPbeGridRefinement(input));
  assert.throws(()=>studyPbeGridRefinement(input,[32,32,128]),/ascending/);
});

test("malformed numerical settings are refused before allocation or propagation",()=>{
  const base=DEFAULT_PBE_SETTINGS;
  const cases:Partial<PbeSettings>[]=[
    {bins:4},{bins:32.5},{bins:300},{minLengthUm:-1},
    {maxLengthUm:base.minLengthUm+2},{steps:-1},{steps:2.5},
    {stepMinutes:0},{growthUmPerMin:-1},{growthUmPerMin:3},
    {nucleationCountPerMlMin:-1},{initialSeedCountPerMl:-1},
    {initialLiquidGPerMl:-1},{crystalDensityGPerCm3:0},
    {steps:Number.NaN},{bins:Infinity},
    {initialSeedCountPerMl:0,nucleationCountPerMlMin:0},
    {initialSeedCountPerMl:1e10,crystalDensityGPerCm3:5,maxLengthUm:20,minLengthUm:19},
  ];
  for(const settings of cases){
    assert.throws(()=>validatePbeSettings({...base,...settings}),/./,JSON.stringify(settings));
  }
});

test("96 bounded synthetic settings maintain nonnegative populations and audited mass closure",()=>{
  let seed=0x1badd00d;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<96;i++){
    const settings={...DEFAULT_PBE_SETTINGS,
      bins:[16,24,32,48,64][Math.floor(rnd()*5)],
      steps:Math.ceil(3+rnd()*20),
      growthUmPerMin:0.02+rnd()*1.2,
      nucleationCountPerMlMin:Math.floor(rnd()*5e5),
      initialSeedCountPerMl:1e3+rnd()*1e7,
      initialLiquidGPerMl:0.0001+rnd()*0.9,
      stepMinutes:0.1+rnd()*2,
      crystalDensityGPerCm3:0.7+rnd()*2,
    };
    const report=runPbeUpwind(settings);
    const audit=auditPbeReport(report);
    assert.equal(audit.passed,true,"trial "+i+": "+audit.issues.join("; "));
    assert.ok(report.summary.maximumMassClosureResidualGPerMl<1e-8);
  }
});
