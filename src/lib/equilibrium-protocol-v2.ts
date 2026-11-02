/**
 * Equilibrium Benchmark Protocol v2 (strictly SOURCE-NATIVE observations).
 *
 * Three *predeclared* descriptive models are fitted on training data alone.
 * No source/article authentication, PBE, kinetics, bootstrap confidence
 * interval or equipment-control fitness is implied.
 *
 * This module never downloads files or mutates the imported observations.
 */
import { evaluateEquilibriumReference, type Metric } from "./equilibrium-reference";
import { parseResearchDataset, type ResearchDataset } from "./research-schema";

export const EQUILIBRIUM_PROTOCOL_V2 = "crystaltwin-equilibrium-evaluation/2" as const;
export type ModelKey = "constant" | "linear" | "vanthoff";
export type ModelScore = {
  status: "scored" | "invalid_forecast";
  mae: number | null;
  rmse: number | null;
  signedBias: number | null;
  count: number;
};
export interface PredictionRow {
  temperatureK: number;
  observedMoleFraction: number;
  constant: number | null;
  linear: number | null;
  vanthoff: number | null;
}
const K_MIN = 1e-10;

/** Mole fractions (0,1) are constrained, including *predicted* values. */
function physicalMoleFraction(value:number):number|null {
  return Number.isFinite(value) && value > 0 && value < 1 ? value : null;
}
function score(predictions:readonly PredictionRow[],key:ModelKey):ModelScore {
  const predicted=predictions.map(p=>p[key]);
  if(predicted.some(v=>v===null)){
    return {status:"invalid_forecast",mae:null,rmse:null,signedBias:null,count:predictions.length};
  }
  const errors=predictions.map((p,i)=>(predicted[i] as number)-p.observedMoleFraction);
  const n=errors.length;
  return {
    status:"scored",mae:errors.reduce((sum,e)=>sum+Math.abs(e),0)/n,
    rmse:Math.sqrt(errors.reduce((sum,e)=>sum+e*e,0)/n),
    signedBias:errors.reduce((sum,e)=>sum+e,0)/n,count:n,
  };
}

export function evaluateEquilibriumProtocolV2(source:ResearchDataset) {
  // v1 enforces strict declared units, 5+ observations, no duplicate temperatures,
  // and independent high-temperature holdout for linear and constant baselines.
  const base=evaluateEquilibriumReference(source);
  const dataset=parseResearchDataset(JSON.stringify(source));
  const identityGroups=new Set(dataset.measurements.map(row=>
    JSON.stringify([row.runId??null,row.cycleId??null,row.channelId??null])));
  if(identityGroups.size!==1){
    throw new Error("Multiple run/cycle/channel identities must not be pooled into one equilibrium holdout.");
  }
  // A single dataset metadata block cannot certify each row's distinct DOI,
  // polymorph or measurement protocol. Preserve these as declarations only.
  const values=dataset.measurements.map(row=>({
    temperatureK:dataset.metadata.units.temperature==="K"?
      row.temperature!:row.temperature!+273.15,
    observed:row.solubility!,
  })).sort((a,b)=>a.temperatureK-b.temperatureK);
  if(values.some(p=>!Number.isFinite(p.temperatureK)||p.temperatureK<=K_MIN)){
    throw new Error("Van't Hoff protocol requires temperatures strictly above 0 K.");
  }
  const cutoff=base.partition.trainingCount;
  const training=values.slice(0,cutoff);
  const holdout=values.slice(cutoff);
  if(training.length<3||holdout.length<2)throw new Error("Insufficient training or evaluation observations.");
  const startT=training[0].temperatureK;

  // Apparent log(x) = a + b * (1000/T - 1000/Tref).
  // NOT enthalpy estimation (unknown activity coefficients, polymorph, etc.).
  const x=training.map(p=>1000*(1/p.temperatureK-1/startT));
  const y=training.map(p=>Math.log(p.observed));
  if(y.some(value=>!Number.isFinite(value)))throw new Error("Non-finite logarithmic solubility.");
  const avg=(values:readonly number[])=>values.reduce((sum,v)=>sum+v,0)/values.length;
  const xMean=avg(x);
  const yMean=avg(y);
  const variance=x.reduce((sum,v)=>sum+(v-xMean)**2,0);
  if(!Number.isFinite(variance)||variance<=1e-15){
    throw new Error("Insufficient temperature variation for reciprocal-temperature fit.");
  }
  const slope=x.reduce((sum,v,i)=>sum+(v-xMean)*(y[i]-yMean),0)/variance;
  const intercept=yMean-slope*xMean;
  if(!Number.isFinite(slope)||!Number.isFinite(intercept)){
    throw new Error("Non-finite van't Hoff fit.");
  }
  const rows:PredictionRow[]=holdout.map((point,i)=>{
    const b=base.predictions[i];
    if(Math.abs(b.temperatureK-point.temperatureK)>1e-8 ||
       Math.abs(b.observed-point.observed)>1e-10)
      throw new Error("Independent holdout indices disagree.");
    const apparent=intercept+slope*1000*(1/point.temperatureK-1/startT);
    return {
      temperatureK:point.temperatureK,
      observedMoleFraction:point.observed,
      constant:physicalMoleFraction(b.constantPredicted),
      linear:physicalMoleFraction(b.linearPredicted),
      vanthoff:physicalMoleFraction(Math.exp(apparent)),
    };
  });
  const metrics:{[K in ModelKey]:ModelScore}={
    constant:score(rows,"constant"),
    linear:score(rows,"linear"),
    vanthoff:score(rows,"vanthoff"),
  };
  const warnings:string[]=[
    "Holdout consists of HIGHER temperatures: out-of-range extrapolation, not IID generalization.",
    "All three models were predeclared; comparing holdout RMSE does not authorize selecting or tuning on that same holdout.",
    "Apparent van't Hoff fit (log mole fraction vs reciprocal Kelvin) is NOT an independent thermodynamic phase or activity-coefficient model.",
    "A Git byte match or a metadata DOI does not verify the original paper's measurements, method, licensing or solid form.",
    "No laboratory replication, measurement uncertainty, physical process kinetics, PBE or industrial validation.",
  ];
  if(dataset.metadata.provenance!=="measured")
    warnings.push("Dataset is not declared as measured: model-to-data scores are not experimental validation.");
  if(!dataset.metadata.measurementMethod)
    warnings.push("Measurement method not independently identified in dataset metadata.");
  if(!dataset.metadata.solidForm)
    warnings.push("Polymorph / solid form is unspecified.");
  if(Object.values(metrics).some(v=>v.status==="invalid_forecast"))
    warnings.push("One or more models predicted outside the physical mole-fraction range (0,1), so their holdout score is withheld.");
  return {
    schemaVersion:EQUILIBRIUM_PROTOCOL_V2,
    kind:"single_curve_high_temperature_extrapolation" as const,
    declaredSource:{
      title:dataset.metadata.title,doi:dataset.metadata.doi??null,
      sourceUrl:dataset.metadata.sourceUrl??null,
      license:dataset.metadata.license??null,
      provenance:dataset.metadata.provenance,
      material:dataset.metadata.material,solvent:dataset.metadata.solvent!,
      measurementMethod:dataset.metadata.measurementMethod??null,
      solidForm:dataset.metadata.solidForm??null,
      originalSourceSha256:dataset.metadata.sourceFileSha256??null,
      runIdentity:JSON.parse([...identityGroups][0]) as [string|null,string|null,string|null],
      measuredOriginIndependentlyAuthenticated:false as const,
    },
    protocol:{
      unit:"mole_fraction" as const,temperatureUnit:"K" as const,
      split:"ascending_temperature_last_30_percent_held_out" as const,
      usesHoldoutForTraining:false as const,
      fitsModelsBeforeExaminingHoldout:true as const,
      trainedCount:training.length,holdoutCount:holdout.length,
      trainingTemperaturesK:training.map(p=>p.temperatureK),
      holdoutTemperaturesK:holdout.map(p=>p.temperatureK),
      modelKeys:["constant","linear","vanthoff"] as const,
      noPhysicalModelValidation:true as const,
    },
    fittedOnTrainingOnly:{
      constantMoleFraction:base.baseline.trainingMeanMoleFraction,
      linearSlopeMoleFractionPerK:base.baseline.slopeMoleFractionPerK,
      linearInterceptAtTrainingStart:base.baseline.interceptAtTrainingStart,
      vanthoffLogInterceptAtTrainingStart:intercept,
      vanthoffSlopePerThousandReciprocalKelvin:slope,
      temperatureReferenceK:startT,
    },
    predictions:rows,
    holdoutMetrics:metrics,
    physicalClaims:{
      crystalGrowthValidated:false as const,
      nucleationValidated:false as const,
      populationBalanceValidated:false as const,
      equipmentControlSuitable:false as const,
      originalSourceAuthenticated:false as const,
    },
    limitations:warnings,
  };
}
