/**
 * SYNTHETIC size-structured population balance equation teaching reference.
 *
 * Discretises ∂n/∂t + ∂(G n)/∂L = J δ(L-Lmin) with first-order
 * positive-velocity upwinding, bounded substep Courant number and an
 * absorbing-into-terminal-bin approximation at the high-L boundary.
 * Model G and J are INPUT CONSTANTS, not measured, temperature-dependent
 * or fitted; no PBE model/experimental validation is asserted.
 *
 * Fixed notional solution volume: 1 mL. Counts in particles/mL; size in
 * micrometres; spherical particle mass in g/particle; solute and solid
 * inventories in g/mL. The decrease in dissolved solute is exactly
 * accounted for by discrete particle mass increments, including births.
 *
 * Important: the discrete solute-conservation rescaling is a numerically
 * conservative teaching device, NOT a physical supersaturation closure.
 */
export const PBE_REFERENCE_VERSION="crystaltwin-pbe-upwind/1" as const;
export interface PbeSettings {
  bins:number;
  minLengthUm:number;
  maxLengthUm:number;
  steps:number;
  stepMinutes:number;
  growthUmPerMin:number;
  nucleationCountPerMlMin:number;
  initialSeedCountPerMl:number;
  initialLiquidGPerMl:number;
  crystalDensityGPerCm3:number;
}
export const DEFAULT_PBE_SETTINGS: PbeSettings = {
  bins:64,minLengthUm:2,maxLengthUm:122,steps:60,stepMinutes:1,
  growthUmPerMin:0.45,nucleationCountPerMlMin:25000,
  initialSeedCountPerMl:2500000,initialLiquidGPerMl:0.35,
  crystalDensityGPerCm3:1.2,
};
export interface PbeFrame {
  step:number;
  timeMinutes:number;
  binNumberPerMl:number[];
  liquidGPerMl:number;
  solidGPerMl:number;
  totalGPerMl:number;
  totalCountPerMl:number;
  cumulativeBirthsPerMl:number;
  d10NumberUm:number|null;
  d50NumberUm:number|null;
  d90NumberUm:number|null;
  numberMeanUm:number|null;
  substeps:number;
  maximumCourant:number;
  upperBoundaryCapped:boolean;
}
export interface PbeReport {
  schemaVersion:typeof PBE_REFERENCE_VERSION;
  kind:"synthetic_uncalibrated_population_balance";
  settings:PbeSettings;
  bins:{midpointsUm:number[];particleMassG:number[];widthUm:number};
  initialMassGPerMl:number;
  frames:PbeFrame[];
  summary:{
    numberConservationResidual:number;
    maximumMassClosureResidualGPerMl:number;
    minimumLiquidGPerMl:number;
    cappedAtUpperBoundary:boolean;
    maximumCourant:number;
    maximumSubsteps:number;
  };
  assumptions:{
    fictitiousFixedVolumeMl:1;
    sphericalParticles:true;
    constantNonfittedGrowthAndNucleation:true;
    lastBinTruncatesFurtherGrowth:true;
    seedPopulationPlacedInFirstBin:true;
    noBreakageOrAgglomeration:true;
    fittedToExperimentalData:false;
  };
  scientificClaims:{
    originalExperimentalDataUsed:false;
    physicalKineticsValidated:false;
    realPopulationBalanceValidated:false;
    holdoutValidated:false;
    equipmentControlSuitable:false;
  };
  limitations:string[];
}
const finiteRange=(value:number,name:string,lo:number,hi:number)=>{
  if(typeof value!=="number"||!Number.isFinite(value)||value<lo||value>hi)
    throw new RangeError(name+" must be finite within "+lo+".."+hi);
};
export function validatePbeSettings(settings:PbeSettings):void {
  finiteRange(settings.bins,"bins",16,256);
  if(!Number.isInteger(settings.bins))throw new RangeError("bins must be integer");
  finiteRange(settings.minLengthUm,"minLengthUm",0.1,20);
  finiteRange(settings.maxLengthUm,"maxLengthUm",20,500);
  if(settings.maxLengthUm-settings.minLengthUm<10)throw new RangeError("size domain must cover at least 10 micrometres");
  finiteRange(settings.steps,"steps",1,120);
  if(!Number.isInteger(settings.steps))throw new RangeError("steps must be integer");
  finiteRange(settings.stepMinutes,"stepMinutes",0.05,5);
  finiteRange(settings.growthUmPerMin,"growthUmPerMin",0,2);
  finiteRange(settings.nucleationCountPerMlMin,"nucleationCountPerMlMin",0,1e8);
  finiteRange(settings.initialSeedCountPerMl,"initialSeedCountPerMl",0,1e10);
  finiteRange(settings.initialLiquidGPerMl,"initialLiquidGPerMl",0,2);
  finiteRange(settings.crystalDensityGPerCm3,"crystalDensityGPerCm3",0.5,5);
  if(settings.initialSeedCountPerMl===0&&settings.nucleationCountPerMlMin===0)
    throw new RangeError("At least some initial seeds or nucleation is required.");
  const dx=(settings.maxLengthUm-settings.minLengthUm)/settings.bins;
  const substeps=Math.max(1,Math.ceil(settings.growthUmPerMin*
    settings.stepMinutes/(dx*0.8)));
  if(substeps*settings.steps*settings.bins>3000000)
    throw new RangeError("PBE work limit exceeded: reduce steps, growth, bins or interval.");
  const seedMass=settings.crystalDensityGPerCm3*Math.PI/6*
    ((settings.minLengthUm+dx/2)*1e-4)**3*settings.initialSeedCountPerMl;
  if(seedMass>2)throw new RangeError("Initial seeds exceed illustrative mass limit.");
}
const sum=(numbers:readonly number[])=>numbers.reduce((a,b)=>a+b,0);
function quantileByCount(counts:readonly number[],centers:readonly number[],p:number):number|null{
  const total=sum(counts);
  if(total<=0)return null;
  const target=p*total;
  let cumulative=0;
  for(let i=0;i<counts.length;i++){
    cumulative+=counts[i];
    if(cumulative>=target)return centers[i];
  }
  return centers.at(-1)??null;
}
export function runPbeUpwind(settings:PbeSettings=DEFAULT_PBE_SETTINGS):PbeReport {
  validatePbeSettings(settings);
  const config={...settings};
  const width=(config.maxLengthUm-config.minLengthUm)/config.bins;
  const midpoints=Array.from({length:config.bins},(_,i)=>
    config.minLengthUm+width*(i+0.5));
  const masses=midpoints.map(L=>config.crystalDensityGPerCm3*
    Math.PI/6*(L*1e-4)**3);
  const counts=Array.from({length:config.bins},()=>0);
  counts[0]=config.initialSeedCountPerMl;
  const initialSolid=sum(counts.map((n,i)=>n*masses[i]));
  const initialMass=initialSolid+config.initialLiquidGPerMl;
  let liquid=config.initialLiquidGPerMl;
  let births=0;
  let upperBoundaryCapped=false;
  let maxCourant=0;
  let maxSubsteps=0;
  const frames:PbeFrame[]=[];
  for(let step=1;step<=config.steps;step++){
    const substeps=Math.max(1,Math.ceil(
      config.growthUmPerMin*config.stepMinutes/(width*0.8)));
    const dt=config.stepMinutes/substeps;
    const cfl=config.growthUmPerMin*dt/width;
    if(cfl>0.800000001)throw new Error("Internal Courant bound failure.");
    maxCourant=Math.max(maxCourant,cfl);
    maxSubsteps=Math.max(maxSubsteps,substeps);
    let blocked=false;
    for(let substep=0;substep<substeps;substep++){
      if(cfl>0&&counts[config.bins-1]>1e-10){
        blocked=true; upperBoundaryCapped=true;
      }
      const transfers=counts.slice(0,-1).map(n=>cfl*n);
      const proposedBirths=config.nucleationCountPerMlMin*dt;
      // n_i changes linearly with a common transfer/birth fraction alpha.
      const change=Array.from({length:config.bins},()=>0);
      change[0]+=proposedBirths;
      for(let i=0;i<transfers.length;i++){
        change[i]-=transfers[i];
        change[i+1]+=transfers[i];
      }
      const proposedMassIncrease=proposedBirths*masses[0]+
        sum(transfers.map((flux,i)=>flux*(masses[i+1]-masses[i])));
      if(!Number.isFinite(proposedMassIncrease)||proposedMassIncrease<0)
        throw new Error("Non-physical proposed solid mass increment.");
      const fraction=proposedMassIncrease>liquid&&proposedMassIncrease>0?
        Math.max(0,liquid/proposedMassIncrease):1;
      for(let i=0;i<counts.length;i++){
        counts[i]+=fraction*change[i];
        if(!Number.isFinite(counts[i])||counts[i]<-1e-7)
          throw new Error("Negative or non-finite population count.");
        // Round-off only; never hide a material negative population.
        if(counts[i]<0)counts[i]=0;
      }
      births+=fraction*proposedBirths;
      liquid-=fraction*proposedMassIncrease;
      if(liquid<0 && liquid>-1e-12)liquid=0;
      if(liquid<-1e-12||!Number.isFinite(liquid))
        throw new Error("Negative or non-finite liquid inventory.");
    }
    const solid=sum(counts.map((n,i)=>n*masses[i]));
    const number=sum(counts);
    const mean=number>0?sum(counts.map((n,i)=>n*midpoints[i]))/number:null;
    frames.push({
      step,timeMinutes:step*config.stepMinutes,
      binNumberPerMl:[...counts],
      liquidGPerMl:liquid,solidGPerMl:solid,totalGPerMl:liquid+solid,
      totalCountPerMl:number,cumulativeBirthsPerMl:births,
      d10NumberUm:quantileByCount(counts,midpoints,0.1),
      d50NumberUm:quantileByCount(counts,midpoints,0.5),
      d90NumberUm:quantileByCount(counts,midpoints,0.9),
      numberMeanUm:mean,
      substeps,maximumCourant:cfl,upperBoundaryCapped:blocked,
    });
  }
  const residuals=frames.map(frame=>Math.abs(frame.totalGPerMl-initialMass));
  const frameLast=frames[frames.length-1];
  return {
    schemaVersion:PBE_REFERENCE_VERSION,
    kind:"synthetic_uncalibrated_population_balance",
    settings:config,
    bins:{midpointsUm:midpoints,particleMassG:masses,widthUm:width},
    initialMassGPerMl:initialMass,
    frames,
    summary:{
      numberConservationResidual:Math.abs(frameLast.totalCountPerMl-
        (config.initialSeedCountPerMl+frameLast.cumulativeBirthsPerMl)),
      maximumMassClosureResidualGPerMl:Math.max(...residuals),
      minimumLiquidGPerMl:Math.min(...frames.map(f=>f.liquidGPerMl)),
      cappedAtUpperBoundary:upperBoundaryCapped,
      maximumCourant:maxCourant,maximumSubsteps:maxSubsteps,
    },
    assumptions:{
      fictitiousFixedVolumeMl:1,sphericalParticles:true,
      constantNonfittedGrowthAndNucleation:true,
      lastBinTruncatesFurtherGrowth:true,
      seedPopulationPlacedInFirstBin:true,
      noBreakageOrAgglomeration:true,fittedToExperimentalData:false,
    },
    scientificClaims:{
      originalExperimentalDataUsed:false,
      physicalKineticsValidated:false,realPopulationBalanceValidated:false,
      holdoutValidated:false,equipmentControlSuitable:false,
    },
    limitations:[
      "Synthetic finite-volume size-advection reference; growth G and nucleation J are fixed input constants and are not fitted.",
      "Single notional 1 mL volume; spherical particles and imposed density are educational assumptions.",
      "High-size boundary accumulates particles in its final bin, artificially limiting further growth; boundary-capped runs must not be interpreted as size-accurate.",
      "Solute depletion rescales discretized growth and births when depleted; it is not a measured supersaturation/thermodynamic closure.",
      "First-bin seed and birth positioning depends on bin width: compare grids as numerical diagnostics, not as identical physical initial conditions.",
      "d10/d50/d90 and number mean are NUMBER-WEIGHTED by bin centers, not mass- or volume-weighted experimental particle-size quantiles.",
      "No agglomeration, breakage, dissolution, temperature schedule, stochastic nucleation or experimental PSD validation.",
    ],
  };
}

/**
 * Independent post-hoc invariants: recompute inventories and distribution
 * summaries from exported bins, rather than trusting cached frame totals.
 */
export function auditPbeReport(report:PbeReport){
  validatePbeSettings(report.settings);
  const issues:string[]=[];
  const maxErrors:number[]=[];
  if(report.frames.length!==report.settings.steps)issues.push("Missing or surplus frames.");
  const {midpointsUm:mid,particleMassG:masses}=report.bins;
  if(mid.length!==report.settings.bins||masses.length!==report.settings.bins)
    issues.push("Bin geometry length mismatch.");
  const width=(report.settings.maxLengthUm-report.settings.minLengthUm)/report.settings.bins;
  if(Math.abs(width-report.bins.widthUm)>1e-12)issues.push("Grid width mismatch.");
  for(let i=0;i<report.settings.bins;i++){
    const expected=report.settings.minLengthUm+(i+0.5)*width;
    if(Math.abs(mid[i]-expected)>1e-9||
       Math.abs(masses[i]-report.settings.crystalDensityGPerCm3*Math.PI/6*(expected*1e-4)**3)>1e-14)
      issues.push("Bin geometry or particle mass modified at bin "+i);
  }
  let previousLiquid=report.settings.initialLiquidGPerMl;
  let previousNumber=report.settings.initialSeedCountPerMl;
  let previousBirths=0;
  for(let i=0;i<report.frames.length;i++){
    const f=report.frames[i];
    if(!f||f.binNumberPerMl.length!==mid.length||
       !f.binNumberPerMl.every(v=>Number.isFinite(v)&&v>=0)){
      issues.push("Invalid population at step "+(i+1));continue;
    }
    const count=sum(f.binNumberPerMl);
    const solid=sum(f.binNumberPerMl.map((v,k)=>v*masses[k]));
    const closure=Math.abs(f.liquidGPerMl+solid-report.initialMassGPerMl);
    maxErrors.push(closure);
    if(!Number.isFinite(f.liquidGPerMl)||f.liquidGPerMl < -1e-10||
       f.liquidGPerMl>previousLiquid+1e-9)issues.push("Liquid increases or becomes negative at step "+(i+1));
    if(f.step!==i+1||Math.abs(f.timeMinutes-(i+1)*report.settings.stepMinutes)>1e-8)
      issues.push("Time index mismatch at step "+(i+1));
    if(!Number.isFinite(f.totalGPerMl)||Math.abs(f.totalGPerMl-(solid+f.liquidGPerMl))>1e-9||
       Math.abs(f.solidGPerMl-solid)>1e-9||
       closure>1e-8)issues.push("Mass balance or reported solid mismatch at step "+(i+1));
    if(Math.abs(count-f.totalCountPerMl)>1e-6||
       Math.abs(count-(report.settings.initialSeedCountPerMl+f.cumulativeBirthsPerMl))>1e-5||
       count<previousNumber-1e-5||f.cumulativeBirthsPerMl<previousBirths-1e-5)
      issues.push("Particle count accounting mismatch at step "+(i+1));
    if(f.maximumCourant>0.800000001||f.maximumCourant<0||
       !Number.isInteger(f.substeps)||f.substeps<1)
      issues.push("Courant control mismatch at step "+(i+1));
    if([f.d10NumberUm,f.d50NumberUm,f.d90NumberUm].some(v=>v!==null && !Number.isFinite(v)))
      issues.push("Nonfinite size quantile at step "+(i+1));
    const computed=[0.1,0.5,0.9].map(p=>quantileByCount(f.binNumberPerMl,mid,p));
    const declared=[f.d10NumberUm,f.d50NumberUm,f.d90NumberUm];
    if(computed.some((v,k)=>v!==declared[k]))
      issues.push("Particle quantile mismatch at step "+(i+1));
    const mean=count>0?sum(f.binNumberPerMl.map((v,k)=>v*mid[k]))/count:null;
    if(mean===null?f.numberMeanUm!==null:
      f.numberMeanUm===null||Math.abs(mean-f.numberMeanUm)>1e-8)
      issues.push("Particle mean mismatch at step "+(i+1));
    previousLiquid=f.liquidGPerMl;previousNumber=count;
    previousBirths=f.cumulativeBirthsPerMl;
  }
  return {
    passed:issues.length===0,
    issues,
    maximumRecomputedMassErrorGPerMl:maxErrors.length?Math.max(...maxErrors):null,
    physicalValidation:false as const,
  };
}

export function studyPbeGridRefinement(
  input:Omit<PbeSettings,"bins">,
  meshes:readonly number[]=[32,64,128],
){
  if(meshes.length!==3||meshes.some((m,i)=>
    !Number.isInteger(m)||m<16||m>256||(i>0 && m<=meshes[i-1])))
    throw new Error("Specify three ascending integer grid sizes from 16..256.");
  const runs=meshes.map(bins=>runPbeUpwind({...input,bins}));
  const results=runs.map(report=>{
    const frame=report.frames.at(-1)!;
    const audit=auditPbeReport(report);
    return {bins:report.settings.bins,
      d50NumberUm:frame.d50NumberUm,
      numberMeanUm:frame.numberMeanUm,
      solidGPerMl:frame.solidGPerMl,
      maximumMassClosureResidualGPerMl:report.summary.maximumMassClosureResidualGPerMl,
      upperBoundaryCapped:report.summary.cappedAtUpperBoundary,
      softwareAuditPassed:audit.passed,
    };
  });
  const comparisons=results.slice(1).map((fine,i)=>{
    const coarse=results[i];
    return {coarseBins:coarse.bins,fineBins:fine.bins,
      absD50DeltaUm:coarse.d50NumberUm===null||fine.d50NumberUm===null?null:
        Math.abs(coarse.d50NumberUm-fine.d50NumberUm),
      absNumberMeanDeltaUm:coarse.numberMeanUm===null||fine.numberMeanUm===null?null:
        Math.abs(coarse.numberMeanUm-fine.numberMeanUm),
      absSolidDeltaGPerMl:Math.abs(coarse.solidGPerMl-fine.solidGPerMl),
    };
  });
  return {
    schemaVersion:"crystaltwin-pbe-grid-study/1" as const,
    kind:"synthetic_discretization_sensitivity_not_experimental_convergence" as const,
    input:{...input},meshes:[...meshes],results,comparisons,
    allSoftwareAuditsPass:results.every(r=>r.softwareAuditPassed),
    gridConvergenceCertified:false as const,
    physicalModelValidated:false as const,
    limitations:[
      "Successive grid differences describe numerical sensitivity, not a mathematically proven asymptotic convergence order.",
      "Seed nuclei occupy the first discretization bin, whose representative size changes with resolution.",
      "Terminal-bin size capping may mask numerical trends; check per-grid upperBoundaryCapped.",
      "All kinetics and densities are uncalibrated and no real measurements or instrument data are used.",
    ],
  };
}
