import test from "node:test";
import assert from "node:assert/strict";
import { parseResearchDataset, MAX_RESEARCH_BYTES } from "../src/lib/research-schema";
import {
  kelvinToCelsius,secondsToMinutes,hoursToMinutes,
  kelvinPerHourToCelsiusPerMinute,molarityToGramPerMl,
  massPercentToGramPerMl,barGaugeToAbsolute,
} from "../src/lib/units";
import { normalizedTrajectory,alignByTime } from "../src/lib/research-time-series";
import { projectResearchToEducationalV1 } from "../src/lib/research-projection";

const base = {
  schemaVersion:2,
  metadata:{
    title:"Fictional test trajectory",
    authors:[] as string[],provenance:"synthetic",experimentMode:"trajectory",
    material:"fictional",solvent:"water",concentrationBasis:"mass_percent",
    temperatureSource:"bath",
    units:{time:"s",temperature:"K",concentration:"%"},
  },
  measurements:[
    {time:0,temperature:300,concentration:5},
    {time:60,temperature:299,concentration:5},
    {time:120,temperature:298,concentration:4.9},
  ],
};
function parse(value: unknown) {return parseResearchDataset(JSON.stringify(value));}
function mutate(fn:(draft:any)=>void) {const draft=structuredClone(base);fn(draft);return draft;}

test("v2 accepts native time, Kelvin, mass% without changing original values",()=>{
  const original=mutate(()=>{});
  const out=parse(original);
  assert.equal(out.schemaVersion,2);
  assert.equal(out.measurements[0].temperature,300);
  assert.equal(out.measurements[1].time,60);
  assert.equal(out.metadata.concentrationBasis,"mass_percent");
  assert.equal(normalizedTrajectory(out,"temperature")[1].timeMinutes,1);
  assert.ok(Math.abs(normalizedTrajectory(out,"temperature")[0].value-26.85)<1e-9);
});
test("reject unsupported schema, invalid JSON and excessive input",()=>{
  assert.throws(()=>parse({schemaVersion:1,metadata:base.metadata,measurements:base.measurements}),/schemaVersion/);
  assert.throws(()=>parseResearchDataset("{"),/Invalid research JSON/);
  assert.throws(()=>parseResearchDataset(" ".repeat(MAX_RESEARCH_BYTES+1)),/1 MiB/);
  assert.throws(()=>parse({...base,measurements:[]}),/1–10000/);
});
test("strict field provenance and unit declaration",()=>{
  assert.throws(()=>parse(mutate(x=>{x.metadata.units.temperature="banana";})),/unit for temperature/);
  assert.throws(()=>parse(mutate(x=>{x.measurements[0].quality=90;})),/unsupported field quality/);
  assert.throws(()=>parse(mutate(x=>{delete x.metadata.units.temperature;})),/Missing declared unit/);
  assert.throws(()=>parse(mutate(x=>{x.metadata.concentrationBasis="g_per_mL_solution";})),/does not match/);
  assert.throws(()=>parse(mutate(x=>{x.measurements[0].pressure=1;})),/Missing declared unit/);
  assert.throws(()=>parse(mutate(x=>{x.metadata.sourceUrl="javascript:alert(1)";})),/https URL/);
});
test("reject improper numeric quantities and duplicate/unsorted times",()=>{
  assert.throws(()=>parse(mutate(x=>{x.measurements[1].time=0;})),/strictly increase/);
  assert.throws(()=>parse(mutate(x=>{x.measurements[0].concentration=102;})),/percent > 100/);
  assert.throws(()=>parse(mutate(x=>{x.measurements[0].temperature=-1;})),/Kelvin below zero/);
  assert.throws(()=>parse(mutate(x=>{x.measurements[0].temperature=Number.NaN;})),/finite JSON number/);
  assert.throws(()=>parse(mutate(x=>{x.measurements[0].temperature=-273.16;x.metadata.units.temperature="°C";})),/absolute zero/);
});
test("equilibrium does not invent time; endpoint sweep does not invent steps",()=>{
  const e={...base,metadata:{...base.metadata,experimentMode:"equilibrium_curve",concentrationBasis:"mole_fraction",units:{temperature:"K",solubility:"mole_fraction"}},measurements:[{temperature:300,solubility:0.01}]};
  assert.equal(parse(e).measurements[0].time,undefined);
  assert.throws(()=>parse({...e,measurements:[{temperature:300}]}),/requires temperature and solubility/);
  const sweep={...base,metadata:{...base.metadata,experimentMode:"endpoint_sweep",units:{d50:"µm"}},measurements:[{conditionId:"a",d50:21},{conditionId:"b",d50:25}]};
  assert.equal(parse(sweep).measurements[0].conditionId,"a");
  assert.throws(()=>parse({...sweep,measurements:[{conditionId:"a",d50:21},{conditionId:"a",d50:25}]}),/Duplicate conditionId/);
});
test("distribution PSD monotonic quantiles and units",()=>{
  const d={...base,metadata:{...base.metadata,experimentMode:"distribution",units:{d10:"µm",d50:"µm",d90:"µm"}},measurements:[{d10:2,d50:5,d90:9}]};
  assert.equal(parse(d).measurements[0].d50,5);
  assert.throws(()=>parse({...d,measurements:[{d10:8,d50:5,d90:9}]}),/d10 exceeds d50/);
});
test("conversion requires explicit physical data",()=>{
  assert.equal(kelvinToCelsius(273.15),0);
  assert.equal(secondsToMinutes(120),2);
  assert.equal(hoursToMinutes(2),120);
  assert.ok(Math.abs(kelvinPerHourToCelsiusPerMinute(1)-1/60)<1e-12);
  assert.equal(molarityToGramPerMl(1,100),0.1);
  assert.equal(massPercentToGramPerMl(10,1.2),0.12);
  assert.equal(barGaugeToAbsolute(0.25,1.01325),1.26325);
  assert.throws(()=>molarityToGramPerMl(1,Number.NaN),/finite/);
  assert.throws(()=>massPercentToGramPerMl(10,0),/positive/);
  assert.throws(()=>barGaugeToAbsolute(0.5,0),/positive/);
});
test("interpolation never extrapolates or crosses missing long gaps",()=>{
  const points=[{timeMinutes:0,value:10},{timeMinutes:2,value:20},{timeMinutes:10,value:30}];
  assert.deepEqual(alignByTime(points,[-1,0,1,2,3,9,10,11],3),[null,10,15,20,null,null,30,null]);
  assert.throws(()=>alignByTime([points[1],points[0]],[1]),/strictly increase/);
  assert.throws(()=>alignByTime(points,[1],0),/Invalid max gap/);
});
test("no automatic v1 coercion of hydrate inhibitor mass%, bath temperature or unverified timebase",()=>{
  const data=parse(base);
  assert.throws(()=>projectResearchToEducationalV1(data,false),/acknowledgement/);
  assert.throws(()=>projectResearchToEducationalV1(data,true),/g\/mL/);
  const v={...base,
    metadata:{...base.metadata,concentrationBasis:"g_per_mL_solution",temperatureSource:"sample",units:{time:"min",temperature:"°C",concentration:"g/mL"}},
    measurements:[{time:1,temperature:60,concentration:0.40},{time:2,temperature:59,concentration:0.39}]};
  const mapped=projectResearchToEducationalV1(parse(v),true);
  assert.deepEqual(mapped.fields,["temperature","concentration"]);
  assert.equal(mapped.rows[1].step,2);
  assert.throws(()=>projectResearchToEducationalV1(parse({...v,measurements:[{time:0,temperature:60,concentration:0.40},{time:1.5,temperature:59,concentration:0.39}]}),true),/non-integer/);
  assert.throws(()=>projectResearchToEducationalV1(parse({...v,metadata:{...v.metadata,temperatureSource:"bath"}}),true),/sample-temperature/);
});
