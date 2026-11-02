/**
 * A strictly unit-preserving equilibrium *reference* benchmark.
 * Deterministic ascending-temperature holdout. This fits only the supplied
 * equilibrium curve; it never validates cooling kinetics or crystal growth.
 */
import type { ResearchDataset } from "./research-schema";
import { parseResearchDataset } from "./research-schema";

export const EQUILIBRIUM_BENCHMARK_VERSION = "crystaltwin-equilibrium-reference/1" as const;

export interface EquilibriumPoint {
  temperatureK: number;
  observed: number;
}
export interface PredictedEquilibriumPoint extends EquilibriumPoint {
  linearPredicted: number;
  constantPredicted: number;
  linearResidual: number;
  constantResidual: number;
}
export interface Metric {
  n: number;
  mae: number;
  rmse: number;
  bias: number;
}
const metrics=(errors:readonly number[]):Metric=>({
  n:errors.length,
  mae:errors.reduce((s,e)=>s+Math.abs(e),0)/errors.length,
  rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),
  bias:errors.reduce((s,e)=>s+e,0)/errors.length,
});
const finite=(v:unknown): v is number=>typeof v==="number"&&Number.isFinite(v);

/**
 * No interpolation of missing points. No conversion between mass fraction,
 * mole fraction, or g/mL; unit must be explicit, native and shared.
 */
export function evaluateEquilibriumReference(dataset:ResearchDataset) {
  // Reuse strict source-native validation even for in-memory callers.
  const verified=parseResearchDataset(JSON.stringify(dataset));
  const m=verified.metadata;
  if (m.experimentMode!=="equilibrium_curve") throw new Error("Expected an equilibrium_curve dataset.");
  if (m.units.temperature!=="K" && m.units.temperature!=="°C") {
    throw new Error("Explicit K or °C temperatures are required.");
  }
  if (m.concentrationBasis!=="mole_fraction" || m.units.solubility!=="mole_fraction") {
    throw new Error("This reference evaluator requires mole_fraction; no implicit conversion is safe.");
  }
  if (!m.solvent) throw new Error("Solvent must be declared.");
  if (verified.measurements.length<5 || verified.measurements.length>1000) {
    throw new Error("At least five and at most 1000 equilibrium points are needed.");
  }
  const points:EquilibriumPoint[]=verified.measurements.map(row=>{
    if (!finite(row.temperature)||!finite(row.solubility)||row.solubility<=0||row.solubility>=1) {
      throw new Error("Incomplete or invalid equilibrium observation.");
    }
    return {temperatureK:m.units.temperature==="K"?row.temperature:row.temperature+273.15,
      observed:row.solubility};
  }).sort((a,b)=>a.temperatureK-b.temperatureK);
  for(let i=1;i<points.length;i++){
    if(points[i].temperatureK-points[i-1].temperatureK<1e-9)
      throw new Error("Duplicate or nearly identical temperatures are not independent conditions.");
  }
  const holdoutN=Math.max(2,Math.ceil(points.length*0.3));
  const split=points.length-holdoutN;
  const training=points.slice(0,split);
  const holdout=points.slice(split);
  const tempBase=training[0].temperatureK;
  const x=training.map(p=>p.temperatureK-tempBase);
  const y=training.map(p=>p.observed);
  const xMean=x.reduce((a,b)=>a+b,0)/x.length;
  const yMean=y.reduce((a,b)=>a+b,0)/y.length;
  const sxx=x.reduce((acc,v)=>acc+(v-xMean)**2,0);
  if(!(sxx>1e-9))throw new Error("Insufficient independent training temperatures.");
  const slope=x.reduce((acc,v,i)=>acc+(v-xMean)*(y[i]-yMean),0)/sxx;
  const intercept=yMean-slope*xMean;
  // Forward-temperature holdout is EXTRAPOLATION, not IID random test.
  const prediction:PredictedEquilibriumPoint[]=holdout.map(p=>{
    const linearPredicted=intercept+slope*(p.temperatureK-tempBase);
    const constantPredicted=yMean;
    return {...p,linearPredicted,constantPredicted,
      linearResidual:linearPredicted-p.observed,
      constantResidual:constantPredicted-p.observed};
  });
  const linearMetrics=metrics(prediction.map(p=>p.linearResidual));
  const constantMetrics=metrics(prediction.map(p=>p.constantResidual));
  return {
    reportSchemaVersion:EQUILIBRIUM_BENCHMARK_VERSION,
    reference:{
      title:m.title,doi:m.doi??null,sourceUrl:m.sourceUrl??null,
      declaredLicense:m.license??null,provenance:m.provenance,
      material:m.material,solvent:m.solvent,
      unit:"mole_fraction" as const,originalTemperatureUnit:m.units.temperature,
      originalRawMeasurementsAuthenticated:false as const,
    },
    partition:{
      strategy:"forward_temperature_extrapolation" as const,
      orderedByTemperature:true as const,
      trainingCount:training.length,holdoutCount:holdout.length,
      trainingTemperatureRangeK:[training[0].temperatureK,training.at(-1)!.temperatureK],
      holdoutTemperatureRangeK:[holdout[0].temperatureK,holdout.at(-1)!.temperatureK],
    },
    baseline:{
      type:"linear_least_squares_and_constant_training_mean" as const,
      slopeMoleFractionPerK:slope,interceptAtTrainingStart:intercept,
      trainingStartK:tempBase,trainingMeanMoleFraction:yMean,
    },
    predictions:prediction,
    holdout:{
      linear:linearMetrics,constant:constantMetrics,
    },
    scientificClaims:{
      isOutOfSampleForFittedCurve:true as const,
      originalArticleIndependentlyVerified:false as const,
      physicalCrystallizationKineticsValidated:false as const,
      growthNucleationOrPBEValidated:false as const,
      suitableForEquipmentControl:false as const,
    },
    limitations:[
      "Small condition-dependent source compilation; no raw experiment authentication.",
      "Ordered high-temperature holdout measures extrapolation, not IID generalization.",
      "Fitted baseline is a descriptive two-parameter line, not a physical crystallization or PBE model.",
      "No mixing of mole fractions with g/mL or mol/L: the unit basis is preserved.",
      "No laboratory replicate variance, instrument calibration or polymorph control established.",
      "Holdout rows must never be used for fitting or selection of the model/hyperparameters.",
    ],
  };
}
