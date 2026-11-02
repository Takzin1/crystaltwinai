/**
 * Purely numerical analytic verification of size-advection PBE.
 *
 * Manufactured initial condition n(L,0) = N/(b-a) on [a,b], zero elsewhere.
 * Exact linear size-independent-growth solution n(L,t)=n(L-G*t,0).
 * The two finite-volume methods advance IDENTICAL physical initial
 * distributions. No births, solute coupling, boundaries, kinetics or
 * experimental measurements. This is a solver verification only.
 *
 * MUSCL minmod + SSP RK2 is a positivity-preserving, spatially
 * second-order candidate for smooth data. The chosen top-hat has two
 * discontinuities, so DO NOT claim globally second-order convergence.
 * Report measured L1 errors rather than guessed orders.
 */

export const ADVECTION_ACCURACY_VERSION="crystaltwin-advection-analytic/1" as const;
export type FluxScheme="upwind"|"muscl-minmod-ssprk2";
export type AccuracyCase={
  bins:number;
  dxUm:number;
  timeSteps:number;
  courant:number;
  scheme:FluxScheme;
  normalizedL1:number;
  maxRelativeBinError:number;
  totalNumberPerMl:number;
  particleNumberRelativeError:number;
  firstMomentUm:number;
  firstMomentErrorUm:number;
  minimumBinCount:number;
  numericalNegativePopulation:false;
  exactBinCount:number[];
  predictedBinCount:number[];
};
export type AccuracyStudy={
  version:typeof ADVECTION_ACCURACY_VERSION;
  kind:"analytic_const_velocity_top_hat_numeric_verification";
  settings:{
    sizeMinUm:0;
    sizeMaxUm:120;
    initialSupportUm:[number,number];
    numberPerMl:number;
    growthUmPerMin:number;
    timeMinutes:number;
    maxCourant:number;
    meshes:number[];
  };
  expectedMeanUm:number;
  cases:AccuracyCase[];
  comparisons:{
    bins:number;
    upwindL1:number;
    musclL1:number;
    musclImprovementFraction:number;
  }[];
  trend:{
    upwindL1StrictlyDecreases:boolean;
    musclL1StrictlyDecreases:boolean;
    musclL1LowerAtEveryMesh:boolean;
    actualObservedErrorOnly:true;
    asymptoticOrderCertified:false;
  };
  physicalClaims:{
    laboratoryMeasurements:false;
    crystallizationKineticsValidated:false;
    industrialControlSuitable:false;
  };
  limitations:string[];
};

function nonnegative(x:number, label:string):number{
  if(!Number.isFinite(x)||x<0)throw new Error(label+" must be finite and nonnegative.");
  return x;
}
function minmod(a:number,b:number):number {
  return a*b<=0?0:(a>0?1:-1)*Math.min(Math.abs(a),Math.abs(b));
}
function overlap(cellLeft:number,cellRight:number,left:number,right:number){
  return Math.max(0,Math.min(cellRight,right)-Math.max(cellLeft,left));
}
const sum=(rows:readonly number[])=>rows.reduce((acc,v)=>acc+v,0);
function advectionCase(
  bins:number,scheme:FluxScheme,
  numberPerMl:number,growthUmPerMin:number,timeMinutes:number,
  support:[number,number],
):AccuracyCase{
  if(!Number.isInteger(bins)||bins<32||bins>256)
    throw new RangeError("Grid must contain 32..256 cells.");
  const dx=120/bins;
  const density=numberPerMl/(support[1]-support[0]);
  const exactShift=growthUmPerMin*timeMinutes;
  if(support[1]+exactShift>=120)
    throw new Error("Analytic support must remain inside the size domain.");
  const exact=(shift:number)=>Array.from({length:bins},(_,i)=>
    density*overlap(i*dx,(i+1)*dx,support[0]+shift,support[1]+shift));
  let values=exact(0);
  const exactCells=exact(exactShift);
  const steps=Math.max(1,Math.ceil(exactShift/(dx*0.4)));
  const courant=exactShift/(steps*dx);
  if(courant>0.4000000001||!Number.isFinite(courant))
    throw new Error("Internal CFL contract violated.");
  const advance=(source:readonly number[]):number[]=>{
    const slopes=scheme==="upwind"?
      source.map(()=>0):
      source.map((q,i)=>minmod(q-(i===0?0:source[i-1]),
        (i===bins-1?0:source[i+1])-q));
    const face=source.map((n,i)=>courant*(n+slopes[i]/2));
    return source.map((n,i)=>n-face[i]+(i?face[i-1]:0));
  };
  for(let step=0;step<steps;step++){
    const next=advance(values);
    if(scheme==="upwind"){values=next;}
    else{
      const second=advance(next);
      values=values.map((n,i)=>(n+second[i])/2);
    }
    if(values.some(v=>!Number.isFinite(v)||v< -1e-8))
      throw new Error("Numerical positivity failed at step "+step+".");
    for(let i=0;i<values.length;i++)if(values[i]<0)values[i]=0;
  }
  const total=sum(values);
  const expectedMean=(support[0]+support[1])/2+exactShift;
  const mean=sum(values.map((v,i)=>v*(i+.5)*dx))/total;
  if(!Number.isFinite(mean))throw new Error("Invalid numerical first moment.");
  return{
    bins,dxUm:dx,timeSteps:steps,courant,scheme,
    normalizedL1:sum(values.map((v,i)=>Math.abs(v-exactCells[i])))/numberPerMl,
    maxRelativeBinError:Math.max(...values.map((v,i)=>Math.abs(v-exactCells[i])))/numberPerMl,
    totalNumberPerMl:total,
    particleNumberRelativeError:Math.abs(total-numberPerMl)/numberPerMl,
    firstMomentUm:mean,
    firstMomentErrorUm:mean-expectedMean,
    minimumBinCount:Math.min(...values),
    numericalNegativePopulation:false,
    exactBinCount:exactCells,
    predictedBinCount:values,
  };
}

export function runAnalyticPbeAccuracyStudy(options?:{
  growthUmPerMin?:number;timeMinutes?:number;numberPerMl?:number;
  initialSupportUm?:[number,number];meshes?:number[];
}):AccuracyStudy {
  const growthUmPerMin=nonnegative(options?.growthUmPerMin??0.65,"growth");
  const timeMinutes=nonnegative(options?.timeMinutes??20,"time");
  const numberPerMl=options?.numberPerMl??100000;
  if(!Number.isFinite(numberPerMl)||numberPerMl<=0||numberPerMl>1e9)
    throw new RangeError("Count must lie within (0, 1e9].");
  const support=options?.initialSupportUm??[10,20];
  if(!Array.isArray(support)||support.length!==2||support.some(v=>!Number.isFinite(v))||
    support[0]<0||support[1]>120||support[0]>=support[1]||support[1]-support[0]<2)
    throw new RangeError("Analytic initial support must be a bounded interval at least 2 µm wide.");
  if(growthUmPerMin>2||timeMinutes>120||support[1]+growthUmPerMin*timeMinutes>=120)
    throw new RangeError("Growth and duration must keep support away from the right boundary.");
  const meshes=options?.meshes??[64,128,256];
  if(meshes.length!==3||meshes.some((n,i)=>!Number.isInteger(n)||n<32||n>256||(i>0&&n<=meshes[i-1])))
    throw new RangeError("Use three strictly increasing grids from 32..256.");
  const cases=meshes.flatMap(bins=>(["upwind","muscl-minmod-ssprk2"] as FluxScheme[])
    .map(scheme=>advectionCase(bins,scheme,numberPerMl,growthUmPerMin,timeMinutes,support)));
  const comparisons=meshes.map(bins=>{
    const upwind=cases.find(c=>c.bins===bins&&c.scheme==="upwind")!;
    const muscl=cases.find(c=>c.bins===bins&&c.scheme==="muscl-minmod-ssprk2")!;
    return{
      bins,upwindL1:upwind.normalizedL1,musclL1:muscl.normalizedL1,
      musclImprovementFraction:upwind.normalizedL1>0?
        1-muscl.normalizedL1/upwind.normalizedL1:0,
    };
  });
  return{
    version:ADVECTION_ACCURACY_VERSION,
    kind:"analytic_const_velocity_top_hat_numeric_verification",
    settings:{
      sizeMinUm:0,sizeMaxUm:120,
      initialSupportUm:[...support],numberPerMl,growthUmPerMin,timeMinutes,
      maxCourant:0.4,meshes:[...meshes],
    },
    expectedMeanUm:(support[0]+support[1])/2+growthUmPerMin*timeMinutes,
    cases,comparisons,
    trend:{
      upwindL1StrictlyDecreases:comparisons.every((r,i)=>i===0||r.upwindL1<comparisons[i-1].upwindL1),
      musclL1StrictlyDecreases:comparisons.every((r,i)=>i===0||r.musclL1<comparisons[i-1].musclL1),
      musclL1LowerAtEveryMesh:comparisons.every(r=>r.musclL1<r.upwindL1),
      actualObservedErrorOnly:true,
      asymptoticOrderCertified:false,
    },
    physicalClaims:{
      laboratoryMeasurements:false,
      crystallizationKineticsValidated:false,
      industrialControlSuitable:false,
    },
    limitations:[
      "This is a numerical verification against an exact constant-positive-growth translation, NOT physical crystallization validation.",
      "The discontinuous top-hat initial condition cannot prove second-order asymptotic convergence of a MUSCL scheme.",
      "No nucleation, solvent mass depletion, agglomeration, dissolution, temperature or phase-change mechanisms are tested here.",
      "No full BigSolDB source CSV or laboratory particle-size measurements are involved.",
      "Both schemes use the SAME physical support across grids; this benchmark deliberately avoids the separate PBE teaching solver's first-bin seed-placement sensitivity.",
    ],
  };
}
