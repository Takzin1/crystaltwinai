import test from "node:test";
import assert from "node:assert/strict";
import {
 LOVASTATIN_BOOKS,LOVASTATIN_SCHEMA,lovastatinMetrics,
 lovastatinRunComparison,validateLovastatinEvidence,type LovastatinRow
} from "../src/lib/lovastatin-evidence";

const observed={
 growth:["PICKL73","PICKL75","PICKL78","PICKL86","PICKL89"],
 primary:["PICKL80","PICKL83","PICKL84","PICKL85"],
 secondary:["PICKL72","PICKL73","PICKL74","PICKL75","PICKL76",
 "PICKL77","PICKL78","PICKL86","PICKL87","PICKL89","PICKL90"],
};
function fake(){
 const records={} as Record<string,unknown>;
 for(const [phase,ids] of Object.entries(observed)){
  const n=LOVASTATIN_BOOKS[phase as keyof typeof LOVASTATIN_BOOKS].n;
  const lengths=ids.map((_,i)=>Math.floor(n/ids.length)+(i<n%ids.length?1:0));
  let rowNum=2;
  const rows:LovastatinRow[]=ids.flatMap((id,j)=>
   Array.from({length:lengths[j]},(_,i)=>({
    experimentId:id,timeSource:i+1,measuredSource:.2-i*.001,
    reportedPredictionSource:.21-i*.001,reportedStdDevSource:.008,
    xlsxRow:rowNum++,
   })));
  records[phase]={
   fileSha256:LOVASTATIN_BOOKS[phase as keyof typeof LOVASTATIN_BOOKS].sha256,
   rowCount:n,experiments:ids,rows,
   publishedPredictionMetrics:lovastatinMetrics(rows),
  };
 }
 return {
  schema:LOVASTATIN_SCHEMA,
  sourceUrl:"https://pureportal.strath.ac.uk/en/datasets/data-for-benchmarking-model-based-design-of-experiment-approaches/",
  license:"CC BY-NC-ND 4.0; permission for adapted data unknown",
  measuredVsPredicted:"Source XLSX columns only; NO model calibration or new prediction",
  timeUnit:"unknown_in_uploaded_workbook",
  measurementUnit:"unknown_in_uploaded_workbook",
  reportedStandardDeviationMeaning:"source column only",
  records,
  leakageGate:{
   overlapGrowthSecondary:["PICKL73","PICKL75","PICKL78","PICKL86","PICKL89"],
   overlapPrimarySecondary:[],
   secondaryOnlyExperimentCandidates:["PICKL72","PICKL74","PICKL76","PICKL77","PICKL87","PICKL90"],
   secondaryIsGloballyIndependentHoldout:false,
   sourcePredictionsProvenIndependent:false,canClaimIndependentModelValidation:false,
  },
  physicalClaims:{
   measurementUnitsAuthenticated:false,
   originalExperimentProtocolsAuthenticated:false,
   newKineticParametersEstimated:false,
   prospectivePredictionsExecuted:false,physicalPbeValidated:false,
   sourceDataRedistributionPermitted:false,
  },
 };
}
test("15 unique experiment IDs, 150 observations, and leaked Growth runs are correctly distinguished",()=>{
 const data=validateLovastatinEvidence(fake());
 assert.deepEqual(Object.values(data.records).map(r=>r.rowCount),[37,38,75]);
 assert.equal(new Set(Object.values(data.records).flatMap(r=>r.experiments)).size,15);
 assert.equal(data.leakageGate.overlapGrowthSecondary.length,5);
 assert.equal(data.leakageGate.secondaryOnlyExperimentCandidates.length,6);
 assert.equal(data.leakageGate.secondaryIsGloballyIndependentHoldout,false);
 assert.equal(lovastatinRunComparison(data,"secondary","PICKL73").sharesGrowthIdentity,true);
 assert.equal(lovastatinRunComparison(data,"secondary","PICKL72").sharesGrowthIdentity,false);
 assert.equal(lovastatinRunComparison(data,"secondary","PICKL72").canClaimIndependentPrediction,false);
});
test("metric calculations retain sign and do not masquerade as physical kinetic calibration",()=>{
 const data=validateLovastatinEvidence(fake());
 const r=lovastatinRunComparison(data,"primary","PICKL80");
 assert.ok(Math.abs(r.metrics.rmseSourceUnits-.01)<1e-12);
 assert.ok(Math.abs(r.metrics.biasPredictionMinusMeasurement-.01)<1e-12);
 assert.ok(Math.abs(r.metrics.rmsReportedStdDevNormalizedResidual-1.25)<1e-12);
 assert.equal(data.physicalClaims.newKineticParametersEstimated,false);
 assert.equal(data.physicalClaims.physicalPbeValidated,false);
});
test("fail closed for forged source hashes, drifted predictions, missing rows, duplicate times and false holdout claims",()=>{
 const clone=()=>fake() as ReturnType<typeof fake> & { records:Record<string,any>; leakageGate:Record<string,any>;physicalClaims:Record<string,any> };
 let d=clone();d.records.growth.fileSha256="0".repeat(64);
 assert.throws(()=>validateLovastatinEvidence(d),/sha\/row count/);
 d=clone();d.records.secondary.rows.pop();
 assert.throws(()=>validateLovastatinEvidence(d),/row count/);
 d=clone();d.records.primary.rows[1].timeSource=d.records.primary.rows[0].timeSource;
 assert.throws(()=>validateLovastatinEvidence(d),/time\/provenance/);
 d=clone();d.records.growth.rows[0].reportedPredictionSource+=.1;
 assert.throws(()=>validateLovastatinEvidence(d),/metric differs/);
 d=clone();d.leakageGate.overlapGrowthSecondary=[];
 assert.throws(()=>validateLovastatinEvidence(d),/overlap gate/);
 d=clone();d.leakageGate.canClaimIndependentModelValidation=true;
 assert.throws(()=>validateLovastatinEvidence(d),/falsely certified/);
 d=clone();d.physicalClaims.physicalPbeValidated=true;
 assert.throws(()=>validateLovastatinEvidence(d),/physical validation claim/);
 d=clone();d.measurementUnit="mol/L";
 assert.throws(()=>validateLovastatinEvidence(d),/units\/rights/);
});
