import test from "node:test";
import assert from "node:assert/strict";
import { parseResearchDataset } from "../src/lib/research-schema";
import {
  summarizeResearchDataset, assessResearchComparability, appendDeclaredTransformation,
} from "../src/lib/research-integrity";
import { alignByTimeDetailed, normalizedTrajectory, alignByTime } from "../src/lib/research-time-series";
import { projectResearchToEducationalV1 } from "../src/lib/research-projection";

const metadata={
  title:"Fictional multi-sensor test (NOT laboratory data)",
  authors:[] as string[],
  provenance:"synthetic",
  experimentMode:"trajectory",
  material:"fictional solute",
  solvent:"fictional water",
  researchRevision:"2.1",
  timeOrigin:"relative_to_run_start",
  temperatureSource:"sample",
  concentrationBasis:"g_per_mL_solution",
  units:{time:"min",temperature:"°C",concentration:"g/mL"},
};
const key=(runId:string,channelId:string)=>({runId,cycleId:"cycle-1",channelId});
const rows=[
  {...key("a","temp"),time:0,temperature:60,concentration:0.4},
  {...key("b","temp"),time:0,temperature:65,concentration:0.42},
  {...key("a","temp"),time:1,temperature:null,concentration:null,
   missingReasons:{temperature:"sensor_failure",concentration:"not_measured"}},
  {...key("b","temp"),time:1,temperature:64,concentration:0.42},
  {...key("a","temp"),time:2,temperature:58,concentration:0.39},
];
const dataset=(list:unknown[]=rows,meta:unknown=metadata)=>
  parseResearchDataset(JSON.stringify({schemaVersion:2,metadata:meta,measurements:list}));

test("v2.1 accepts interleaved repeated time across independent runs",()=>{
  const d=dataset();
  const summary=summarizeResearchDataset(d);
  assert.equal(summary.series.length,2);
  assert.equal(summary.series[0].rows,3);
  assert.equal(summary.series[1].rows,2);
  assert.equal(summary.missingByField.temperature,1);
  assert.equal(summary.missingByField.concentration,1);
  assert.equal(d.measurements[2].missingReasons?.temperature,"sensor_failure");
  assert.equal(d.measurements[2].temperature,undefined);
  assert.throws(()=>normalizedTrajectory(d,"temperature"),/explicit runId/);
  assert.deepEqual(normalizedTrajectory(d,"temperature",key("a","temp")).map(p=>p.timeMinutes),[0,1,2]);
  assert.equal(normalizedTrajectory(d,"temperature",key("b","temp"))[0].value,65);
  assert.throws(()=>normalizedTrajectory(d,"temperature",key("c","temp")),/not found/);
});
test("missing values are interpolation barriers, no fabricated points",()=>{
  const data=normalizedTrajectory(dataset(),"temperature",key("a","temp"));
  assert.equal(data[1].value,null);
  assert.equal(data[1].missingReason,"sensor_failure");
  const result=alignByTimeDetailed(data,[-1,0,0.5,1,1.5,2,3],3);
  assert.deepEqual(result.map(r=>r.value),[null,60,null,null,null,58,null]);
  assert.deepEqual(result.map(r=>r.origin),[
    "unavailable","observed","unavailable","unavailable","unavailable","observed","unavailable"
  ]);
  assert.equal(result[2].reason,"missing_observation_barrier");
  assert.equal(result[3].reason,"sensor_failure");
  assert.deepEqual(alignByTime(data,[0.5,1,1.5]),[null,null,null]);
  const legacy=alignByTimeDetailed([{timeMinutes:0,value:60},{timeMinutes:2,value:58}],[1],3);
  assert.equal(legacy[0].origin,"interpolated");
  assert.equal(legacy[0].value,59);
});
test("null without a reason remains distinguishable from omitted fields",()=>{
  const simple=dataset([
    {time:0,temperature:60,concentration:0.4},
    {time:1,temperature:null,concentration:0.4},
    {time:2,temperature:58,concentration:0.3},
  ]);
  assert.equal(simple.measurements[1].missingReasons?.temperature,"unspecified");
  const sparse=dataset([
    {time:0,temperature:60,concentration:0.4},
    {time:1,concentration:0.4},
    {time:2,temperature:58,concentration:0.3},
  ]);
  assert.equal(sparse.measurements[1].missingReasons,undefined);
  const v=normalizedTrajectory(sparse,"temperature");
  assert.equal(v[1].value,null);
  assert.equal(v[1].missingReason,"not_reported");
  assert.equal(alignByTime(v,[0.5,1.5])[0],null);
});
test("reject identity mixing, duplicate per-channel times and fake missing reason labels",()=>{
  assert.throws(()=>dataset([...rows,{...key("a","temp"),time:2,temperature:55,concentration:0.2}]),/strictly increase/);
  assert.throws(()=>dataset([rows[0],{time:1,temperature:58,concentration:0.3}]),/identified and unidentified/);
  assert.throws(()=>dataset([rows[0],{runId:"a",time:1,temperature:58,concentration:0.3}]),/runId, cycleId and channelId/);
  assert.throws(()=>dataset([{time:0,temperature:null,concentration:0.4,
    missingReasons:{temperature:"not_valid"}},{time:1,temperature:58,concentration:0.4}]),/missing reason/);
  assert.throws(()=>dataset([{time:0,temperature:60,concentration:0.4,
    missingReasons:{temperature:"sensor_failure"}},{time:1,temperature:58,concentration:0.4}]),/explicit null/);
});
test("reject partial PSD contradiction even without d50",()=>{
  const psd={
    ...metadata,experimentMode:"distribution",
    units:{d10:"µm",d90:"µm"},
  };
  assert.throws(()=>dataset([{d10:20,d90:10}],psd),/d10 exceeds d90/);
});
test("no educational projection until single channel and time origin explicit",()=>{
  assert.throws(()=>projectResearchToEducationalV1(dataset(),true),/multiple runs/);
  const v=dataset([
    {time:1,temperature:60,concentration:0.4},
    {time:2,temperature:59,concentration:0.39},
  ]);
  assert.equal(projectResearchToEducationalV1(v,true).rows.length,2);
  const unknown=dataset([{time:1,temperature:60,concentration:0.4},{time:2,temperature:59,concentration:0.39}],
    {...metadata,timeOrigin:"unknown"});
  assert.throws(()=>projectResearchToEducationalV1(unknown,true),/time origin/);
  const nullMeasured=dataset([
    {time:1,temperature:60,concentration:0.4},
    {time:2,temperature:null,concentration:0.39},
  ]);
  assert.throws(()=>projectResearchToEducationalV1(nullMeasured,true),/missing temperature/);
});
test("comparison eligibility checks physics metadata and explicit per-field units",()=>{
  const d=dataset([
    {time:1,temperature:60,concentration:0.4},
    {time:2,temperature:59,concentration:0.39},
  ]);
  assert.equal(assessResearchComparability(d,d,"temperature").comparable,true);
  const different=dataset([
    {time:1,temperature:60,concentration:0.4},
    {time:2,temperature:59,concentration:0.39},
  ],{...metadata,material:"different fictional material"});
  const check=assessResearchComparability(d,different,"temperature");
  assert.equal(check.comparable,false);
  assert.ok(check.reasons.some(reason=>reason.startsWith("material:")));
  assert.equal(assessResearchComparability(dataset(),d,"temperature").comparable,false);
  const unknown=dataset([{time:1,temperature:60,concentration:0.4}],{...metadata,timeOrigin:"unknown"});
  assert.equal(assessResearchComparability(unknown,unknown,"temperature").comparable,false);
});
test("declared transforms carry version and digest information, without mutating original",()=>{
  const d=dataset();
  const record={
    operation:"source_mapping" as const,software:"test mapping tool",version:"0.1",
    inputSha256:"a".repeat(64),notes:"Synthetic rows only",
  };
  const withRecord=appendDeclaredTransformation(d,record);
  assert.equal(d.metadata.transformations,undefined);
  assert.equal(withRecord.metadata.transformations?.[0].operation,"source_mapping");
  assert.equal(withRecord.metadata.transformations?.[0].inputSha256,"a".repeat(64));
  assert.equal(summarizeResearchDataset(withRecord).transformationCount,1);
  const reparsed=dataset(rows,{...metadata,transformations:[record]});
  assert.equal(reparsed.metadata.transformations?.[0].version,"0.1");
  assert.throws(()=>dataset(rows,{...metadata,transformations:[{...record,inputSha256:"bad"}]}),/Invalid transformation SHA/);
  assert.throws(()=>dataset(rows,{...metadata,transformations:[{...record,operation:"magical_calibration"}]}),/transformation operation/);
});
test("legacy v2 single-channel shape remains accepted",()=>{
  const legacy=dataset([
    {time:0,temperature:50,concentration:0.4},
    {time:1,temperature:49,concentration:0.39},
  ],{...metadata,timeOrigin:undefined,researchRevision:undefined});
  assert.equal(legacy.measurements.length,2);
  assert.equal(normalizedTrajectory(legacy,"temperature").length,2);
  assert.equal(summarizeResearchDataset(legacy).series.length,1);
});
