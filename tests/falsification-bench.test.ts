import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_INPUT, PARAMETERS } from "../src/config/parameters";
import { SCENARIOS } from "../src/config/scenarios";
import { runSimulation } from "../src/lib/engine";
import {
  runConservativeReference, auditConservativeReference,
} from "../src/lib/conservative-reference";
import {
  runFalsificationBenchmark, auditPrimaryTrajectory, FALSIFICATION_SCHEMA,
} from "../src/lib/falsification-bench";

test("the conservative compartment conserves its own total mass for all presets", () => {
  for (const scenario of SCENARIOS) {
    const points = runConservativeReference(scenario.input);
    assert.equal(points.length, scenario.input.timeSteps);
    const audit = auditConservativeReference(scenario.input, points);
    assert.equal(audit.accepted, true, JSON.stringify(audit.violations));
    assert.equal(audit.physicalValidation, false);
    assert.ok(audit.maxAbsMassClosureError < 1e-12);
    assert.ok(points.every(p => p.liquidConcentration >= 0 &&
      p.solidEquivalent >= 0 && p.totalEquivalent >= 0));
  }
});

test("two-compartment audit rejects fabricated mass, missing time step and cooling", () => {
  const input = {...DEFAULT_INPUT};
  const clean = runConservativeReference(input);
  for (const mutate of [
    (p: typeof clean) => {p[1].step = 99;},
    (p: typeof clean) => {p[1].liquidConcentration += 0.02;},
    (p: typeof clean) => {p[1].solidEquivalent = -0.01;},
    (p: typeof clean) => {p[1].totalEquivalent += 0.01;},
    (p: typeof clean) => {p[1].temperature += 2;},
    (p: typeof clean) => {p[1].liquidConcentration = Number.NaN;},
  ]) {
    const modified = structuredClone(clean);
    mutate(modified);
    assert.equal(auditConservativeReference(input,modified).accepted, false);
  }
  assert.equal(auditConservativeReference(input, clean.slice(1)).accepted, false);
  assert.throws(() => auditConservativeReference(input,clean,0.1),/tolerance/);
  assert.throws(() => auditConservativeReference({...input,temperature:1000},clean),/temperature/);
});

test("primary software audit rejects corrupted data without claiming physical validation", () => {
  const valid = runSimulation({...DEFAULT_INPUT});
  assert.deepEqual(auditPrimaryTrajectory(valid),[]);
  for (const mutate of [
    (r: typeof valid) => {r.series[0].step = 2;},
    (r: typeof valid) => {r.series[0].temperature = 500;},
    (r: typeof valid) => {r.series[1].concentration = 100;},
    (r: typeof valid) => {r.series[1].growthRate = -1;},
    (r: typeof valid) => {r.series[1].crystalYield = -1;},
    (r: typeof valid) => {r.series[1].quality = 111;},
    (r: typeof valid) => {r.summary.avgGrowthRate = 999;},
    (r: typeof valid) => {r.summary.finalYield = 999;},
    (r: typeof valid) => {r.summary.qualityScore = NaN;},
    (r: typeof valid) => {r.summary.qualityScore = 42;},
    (r: typeof valid) => {r.summary.stabilityScore = 42;},
    (r: typeof valid) => {r.summary.maxSupersaturation = 900;},
    (r: typeof valid) => {r.summary.nucleationEvents = 999;},
    (r: typeof valid) => {r.series[2].supersaturation = -1;},
  ]) {
    const modified = structuredClone(valid);
    mutate(modified);
    assert.ok(auditPrimaryTrajectory(modified).length > 0);
  }
});

test("multi-scenario bench is deterministic, bounded and explicitly synthetic", () => {
  const original = structuredClone(DEFAULT_INPUT);
  const first = runFalsificationBenchmark(original);
  const next = runFalsificationBenchmark({...original});
  assert.deepEqual(first,next);
  assert.deepEqual(original,DEFAULT_INPUT);
  assert.equal(first.schemaVersion,FALSIFICATION_SCHEMA);
  assert.equal(first.kind,"synthetic_software_falsification_only");
  assert.equal(first.summary.cases,SCENARIOS.length+1);
  assert.equal(first.summary.softwareFailures,0);
  assert.equal(first.cases.at(-1)?.id,"current-user-input");
  assert.ok(first.cases.every(item => item.softwareInvariantsPass &&
    item.deterministicRepeat && item.conservativeClosureMaxAbs < 1e-10 &&
    item.primaryVsRelaxation.temperatureMaxAbs < 1e-9 &&
    item.primaryVsConservative.temperatureMaxAbs < 1e-9));
  assert.equal(first.evidence.experimentalDataUsed,false);
  assert.equal(first.evidence.trainedOrCalibrated,false);
  assert.equal(first.evidence.holdoutValidated,false);
  assert.equal(first.evidence.physicalModelValidated,false);
  assert.equal(first.evidence.hardwareExecuted,false);
  assert.ok(first.summary.largestConcentrationRmse >= 0);
});

test("invalid user inputs fail closed before a benchmark can be exported", () => {
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, 100]) {
    assert.throws(()=>runFalsificationBenchmark({...DEFAULT_INPUT, coolingRate:bad}));
  }
  assert.throws(()=>runFalsificationBenchmark({...DEFAULT_INPUT,timeSteps:10.5}));
  assert.equal(runFalsificationBenchmark().summary.cases,SCENARIOS.length);
});

test("256 bounded seeded inputs satisfy closure and software constraints", () => {
  let seed=0x671ab234;
  const rand=() => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32; };
  for(let i=0;i<256;i++){
    const input={...DEFAULT_INPUT};
    for(const item of PARAMETERS){
      const sample=item.min+(item.max-item.min)*rand();
      input[item.id]=item.id==="timeSteps"?Math.round(sample):sample;
    }
    const mass=runConservativeReference(input);
    const assessment=auditConservativeReference(input,mass);
    assert.equal(assessment.accepted,true,`case ${i}: ${assessment.violations.join(";")}`);
    assert.deepEqual(auditPrimaryTrajectory(runSimulation(input)),[]);
  }
});
