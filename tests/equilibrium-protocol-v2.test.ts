import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseResearchDataset, type ResearchDataset } from "../src/lib/research-schema";
import { evaluateEquilibriumReference } from "../src/lib/equilibrium-reference";
import { EQUILIBRIUM_PROTOCOL_V2, evaluateEquilibriumProtocolV2 }
  from "../src/lib/equilibrium-protocol-v2";

const example=():ResearchDataset=>parseResearchDataset(
  readFileSync("public/examples/bigsoldb21-paracetamol-ethanol.measured.json","utf8")
);
const clone=<T>(data:T):T=>structuredClone(data);

test("literature-compiled BigSolDB five-point holdout compares predeclared three baselines",()=>{
  const data=example();
  const first=evaluateEquilibriumProtocolV2(data);
  const again=evaluateEquilibriumProtocolV2(data);
  const original=evaluateEquilibriumReference(data);
  assert.deepEqual(first,again);
  assert.equal(first.schemaVersion,EQUILIBRIUM_PROTOCOL_V2);
  assert.deepEqual(first.protocol.modelKeys,["constant","linear","vanthoff"]);
  assert.equal(first.protocol.trainedCount,3);
  assert.equal(first.protocol.holdoutCount,2);
  assert.deepEqual(first.protocol.holdoutTemperaturesK,[308.15,313.15]);
  assert.equal(first.protocol.usesHoldoutForTraining,false);
  assert.equal(first.protocol.noPhysicalModelValidation,true);
  assert.equal(first.holdoutMetrics.vanthoff.status,"scored");
  assert.equal(first.holdoutMetrics.linear.status,"scored");
  assert.equal(first.holdoutMetrics.constant.status,"scored");
  assert.ok(Math.abs(first.holdoutMetrics.linear.rmse!-original.holdout.linear.rmse)<1e-12);
  assert.ok(Math.abs(first.holdoutMetrics.constant.mae!-original.holdout.constant.mae)<1e-12);
  assert.ok(first.holdoutMetrics.vanthoff.rmse!>0);
  assert.equal(first.declaredSource.measuredOriginIndependentlyAuthenticated,false);
  assert.equal(first.physicalClaims.crystalGrowthValidated,false);
  assert.equal(first.physicalClaims.populationBalanceValidated,false);
  assert.equal(first.physicalClaims.originalSourceAuthenticated,false);
});

test("held-out labels cannot leak into constant, linear or van't Hoff training coefficients",()=>{
  const reference=example();
  const standard=evaluateEquilibriumProtocolV2(reference);
  const mutated=clone(reference);
  mutated.measurements[3].solubility=0.21;
  mutated.measurements[4].solubility=0.31;
  const changed=evaluateEquilibriumProtocolV2(mutated);
  assert.deepEqual(standard.fittedOnTrainingOnly,changed.fittedOnTrainingOnly);
  assert.deepEqual(standard.protocol,changed.protocol);
  assert.notDeepEqual(standard.holdoutMetrics,changed.holdoutMetrics);
  assert.deepEqual(reference,example());
});

test("van't Hoff exact apparent reference generates essentially zero error on synthetic data",()=>{
  const data=example();
  const temps=[290,295,300,305,310,315];
  data.metadata.title="Synthetic apparent van't Hoff (not lab data)";
  data.metadata.provenance="synthetic";
  data.measurements=temps.map(temperature=>({
    temperature,
    solubility:Math.exp(-3+400*(1/temperature-1/290)),
  }));
  const report=evaluateEquilibriumProtocolV2(data);
  assert.equal(report.protocol.trainedCount,4);
  assert.equal(report.protocol.holdoutCount,2);
  assert.ok(report.holdoutMetrics.vanthoff.rmse!<1e-12);
  assert.ok(report.limitations.some(w=>w.includes("not declared as measured")));
  assert.equal(report.declaredSource.provenance,"synthetic");
});

test("explicit degC data converts only temperatures, never the mole fraction basis",()=>{
  const original=example();
  const celsius=clone(original);
  celsius.metadata.units.temperature="°C";
  for(const row of celsius.measurements)row.temperature=Number((row.temperature!-273.15).toFixed(9));
  const a=evaluateEquilibriumProtocolV2(original);
  const b=evaluateEquilibriumProtocolV2(celsius);
  assert.ok(Math.abs(a.holdoutMetrics.vanthoff.rmse!-b.holdoutMetrics.vanthoff.rmse!)<1e-12);
  assert.ok(Math.abs(a.holdoutMetrics.linear.rmse!-b.holdoutMetrics.linear.rmse!)<1e-12);
});

test("invalid out-of-range model predictions produce NULL metrics instead of fake RMSE",()=>{
  const data=example();
  const temps=[290,295,300,305,310];
  const fractions=[0.9,0.6,0.3,0.2,0.1];
  data.measurements=temps.map((temperature,i)=>({temperature,solubility:fractions[i]}));
  const report=evaluateEquilibriumProtocolV2(data);
  assert.equal(report.holdoutMetrics.linear.status,"invalid_forecast");
  assert.equal(report.holdoutMetrics.linear.rmse,null);
  assert.ok(report.predictions.some(point=>point.linear===null));
  assert.ok(report.limitations.some(x=>x.includes("score is withheld")));
});

test("fail closed for mixed run identities, invalid units, missing temperatures",()=>{
  const mixed=example();
  mixed.measurements[0].runId="run-A";
  mixed.measurements[1].runId="run-B";
  assert.throws(()=>evaluateEquilibriumProtocolV2(mixed),/Multiple run/);

  const source=example();
  source.metadata.concentrationBasis="mol_per_L";
  assert.throws(()=>evaluateEquilibriumProtocolV2(source),/unit does not match|mole_fraction/);

  const broken=example();
  delete broken.measurements[2].temperature;
  assert.throws(()=>evaluateEquilibriumProtocolV2(broken),/temperature/);

  const invalid=example();
  invalid.measurements[0].temperature=0;
  assert.throws(()=>evaluateEquilibriumProtocolV2(invalid),/above 0 K/);

  const duplicate=example();
  duplicate.measurements[4].temperature=duplicate.measurements[3].temperature;
  assert.throws(()=>evaluateEquilibriumProtocolV2(duplicate),/Duplicate/);

  const nonfinite=example();
  nonfinite.measurements[3].solubility=Infinity;
  assert.throws(()=>evaluateEquilibriumProtocolV2(nonfinite),/finite/);
});
