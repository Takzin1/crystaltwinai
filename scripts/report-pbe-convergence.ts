/**
 * Reproducible numerical verification artifact. NO external measurements.
 * Emits exact per-bin cell integrals, predictions and empirical orders.
 * CI uploads the generated JSON on both Node 20 and Node 22.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runAnalyticPbeAccuracyStudy, type FluxScheme } from "../src/lib/pbe-analytic-accuracy";

const options={
  initialProfile:"smooth_sin4" as const,
  initialSupportUm:[15,45] as [number,number],
  growthUmPerMin:0.6,
  timeMinutes:20,
  numberPerMl:100000,
  meshes:[64,128,256],
};
const spatial=runAnalyticPbeAccuracyStudy({...options,maxCourant:0.4});
const temporal=[0.4,0.2,0.1].map(maxCourant=>
  runAnalyticPbeAccuracyStudy({...options,maxCourant}));
const normalizedDistance=(a:readonly number[],b:readonly number[])=>
  a.reduce((total,v,i)=>total+Math.abs(v-b[i]),0)/options.numberPerMl;
const spatialOrders=(scheme:FluxScheme)=>{
  const values=spatial.cases.filter(c=>c.scheme===scheme).map(c=>c.normalizedL1);
  return values.slice(0,-1).map((v,i)=>Math.log2(v/values[i+1]));
};
const timeOrders=(scheme:FluxScheme)=>{
  const values=temporal.map(t=>t.cases.find(c=>c.bins===128&&c.scheme===scheme)!);
  const d1=normalizedDistance(values[0].predictedBinCount,values[1].predictedBinCount);
  const d2=normalizedDistance(values[1].predictedBinCount,values[2].predictedBinCount);
  return {gridBins:128,courants:temporal.map(t=>t.settings.maxCourant),
    actualSteps:values.map(v=>v.timeSteps),coarseDifference:d1,fineDifference:d2,
    observedSelfConvergenceOrder:Math.log2(d1/d2)};
};
const report={
  schema:"crystaltwin-pbe-smooth-verification-report/1",
  kind:"fully_synthetic_exact_characteristic_reference" as const,
  reproducibility:{
    deterministic:true,
    exactInitialShape:"compact sin^4 on [15,45] um",
    analyticFinalShape:"compact sin^4 on [27,57] um",
    initialNumberPerMl:options.numberPerMl,
    noExperimentalObservations:true,
    noMeasuredKinetics:true,
    noExperimentalPhysicalValidation:true,
  },
  spatial,
  observedSpatialOrders:{
    upwind:spatialOrders("upwind"),
    musclMinmodSspRk2:spatialOrders("muscl-minmod-ssprk2"),
  },
  temporalSelfConvergence:{
    upwind:timeOrders("upwind"),
    musclMinmodSspRk2:timeOrders("muscl-minmod-ssprk2"),
  },
};
const failure=spatial.cases.some(c=>c.particleNumberRelativeError>1e-10 ||
  c.minimumBinCount<0 || !Number.isFinite(c.normalizedL1));
if(failure || !spatial.trend.musclL1LowerAtEveryMesh ||
    !spatial.trend.musclL1StrictlyDecreases)
  throw new Error("PBE convergence report numerical acceptance gate failed.");
const dir="artifacts/pbe-verification";
mkdirSync(dir,{recursive:true});
const path=join(dir,"smooth-convergence.json");
writeFileSync(path,JSON.stringify(report,null,2)+"\n","utf8");
console.log(JSON.stringify({path,spatial:spatial.comparisons,
  observedSpatialOrders:report.observedSpatialOrders,
  temporalSelfConvergence:report.temporalSelfConvergence,
  physicalValidation:false},null,2));
