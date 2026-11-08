/**
 * Analytic size-advection finite-volume benchmark on uniform/nonuniform grids.
 *
 * Methodological reference: W. Zhang et al. (2024), Computers & Chemical
 * Engineering 183, 108612, DOI 10.1016/j.compchemeng.2024.108612,
 * §§4.1, 6.1 and Eqs. (49)-(51). This is NOT a reproduction of CADET's
 * Koren/WENO solvers or its published numeric results.
 *
 * Solve d n/dt + G d n/dL = 0, G >= 0, with a compact top-hat initial
 * distribution. Evolve finite-volume cell COUNTS (not densities) using
 * conservative first-order upwind flux G*N_i/dL_i on arbitrary cell widths.
 * Reference each cell against the exact integral of translated top-hat.
 */
export const ZHANG_NONUNIFORM_BENCHMARK_VERSION =
  "crystaltwin-zhang-nonuniform-advection/1" as const;

export type MeshType = "uniform" | "geometric_left_refined";

export interface NonuniformPbeCase {
  meshType: MeshType;
  bins: number;
  gridEdgesUm: number[];
  minimumWidthUm: number;
  maximumWidthUm: number;
  actualCourant: number;
  substeps: number;
  exactCellCounts: number[];
  predictedCellCounts: number[];
  normalizedL1: number;
  populationConservationRelativeError: number;
  boundaryOutflowPerMl: number;
  observedMoments: number[];
  referenceMoments: number[];
  relativeMomentErrors: number[];
  minimumPopulation: number;
}

export interface ZhangPbeBenchmark {
  schemaVersion: typeof ZHANG_NONUNIFORM_BENCHMARK_VERSION;
  kind: "analytic_uniform_vs_nonuniform_fvm_numerical_verification";
  source: {
    doi: "10.1016/j.compchemeng.2024.108612";
    citedParts: ["4.1", "6.1", "eq49", "eq50", "eq51"];
    fullPaperResultsReproduced: false;
  };
  settings: {
    sizeRangeUm: [0, 120];
    initialSupportUm: [number, number];
    totalNumberPerMl: number;
    growthUmPerMin: number;
    durationMin: number;
    maxCourant: number;
    geometricWidthRatio: number;
    meshes: number[];
  };
  cases: NonuniformPbeCase[];
  refinement: {
    meshType: MeshType;
    coarseBins: number;
    fineBins: number;
    coarseL1: number;
    fineL1: number;
    observedOrder: number | null;
  }[];
  physicalClaims: {
    measuredCrystallizationData: false;
    kineticsValidated: false;
    quantumDeviceUsed: false;
    paperCaseReproduced: false;
  };
  limitations: string[];
}

const range = (v: number, name: string, low: number, high: number) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < low || v > high) {
    throw new RangeError(name + " must lie within " + low + ".." + high + ".");
  }
};
const sum = (numbers: readonly number[]) =>
  numbers.reduce((acc, value) => acc + value, 0);
const overlap = (a: number, b: number, left: number, right: number) =>
  Math.max(0, Math.min(b, right) - Math.max(a, left));

function gridEdges(bins: number, mesh: MeshType, ratio: number): number[] {
  if (mesh === "uniform") {
    return Array.from({ length: bins + 1 }, (_, i) => 120 * i / bins);
  }
  // Smooth geometric mapping, with exactly the same physical domain.
  // Width ratio between first and last cells approaches 'ratio'.
  const logarithm = Math.log(ratio);
  const denominator = Math.expm1(logarithm);
  return Array.from({ length: bins + 1 }, (_, i) => (
    i === 0 ? 0 : i === bins ? 120 :
      120 * Math.expm1(logarithm * i / bins) / denominator
  ));
}

function analyticMoment(
  order: number, left: number, right: number, concentration: number,
): number {
  return concentration * (right ** (order + 1) -
    left ** (order + 1)) / (order + 1);
}

function evaluateCase(
  bins: number,
  meshType: MeshType,
  support: [number, number],
  numberPerMl: number,
  velocity: number,
  time: number,
  maxCourant: number,
  ratio: number,
): NonuniformPbeCase {
  const edges = gridEdges(bins, meshType, ratio);
  const widths = edges.slice(1).map((right, i) => right - edges[i]);
  const minimumWidth = Math.min(...widths);
  if (!Number.isFinite(minimumWidth) || minimumWidth <= 0) {
    throw new Error("Nonuniform grid is invalid.");
  }
  const density = numberPerMl / (support[1] - support[0]);
  const shifted: [number, number] = [
    support[0] + velocity * time, support[1] + velocity * time,
  ];
  const cellIntegrals = (left: number, right: number) =>
    widths.map((_, i) => density * overlap(edges[i], edges[i + 1], left, right));
  const exactCellCounts = cellIntegrals(shifted[0], shifted[1]);
  let counts = cellIntegrals(support[0], support[1]);
  const substeps = Math.max(1, Math.ceil(velocity * time / (maxCourant * minimumWidth)));
  const stepDistance = velocity * time / substeps;
  const actualCourant = stepDistance / minimumWidth;
  if (!Number.isFinite(actualCourant) || actualCourant > maxCourant + 1e-12) {
    throw new Error("Local Courant condition failed.");
  }
  if (substeps * bins > 3_000_000) {
    throw new RangeError("Numerical workload exceeds the benchmark limit.");
  }
  let boundaryOutflowPerMl = 0;
  for (let t = 0; t < substeps; t++) {
    const transfers = counts.map((count, i) => count * stepDistance / widths[i]);
    boundaryOutflowPerMl += transfers[bins - 1];
    counts = counts.map((count, i) =>
      count - transfers[i] + (i === 0 ? 0 : transfers[i - 1]));
    if (!counts.every(n => Number.isFinite(n) && n >= -1e-9)) {
      throw new Error("Invalid or materially negative finite-volume cell count.");
    }
    // Round-off only; do not conceal a material negative population.
    counts = counts.map(n => n < 0 ? 0 : n);
  }
  const normalizedL1 =
    sum(counts.map((n, i) => Math.abs(n - exactCellCounts[i]))) / numberPerMl;
  const total = sum(counts);
  const populationConservationRelativeError =
    Math.abs(total + boundaryOutflowPerMl - numberPerMl) / numberPerMl;
  const observedMoments = Array.from({ length: 7 }, (_, order) =>
    sum(counts.map((n, i) => n * ((edges[i] + edges[i + 1]) / 2) ** order)));
  const referenceMoments = Array.from({ length: 7 }, (_, order) =>
    analyticMoment(order, shifted[0], shifted[1], density));
  const relativeMomentErrors = referenceMoments.map((reference, i) =>
    Math.abs(observedMoments[i] - reference) / reference);
  return {
    meshType, bins, gridEdgesUm: edges,
    minimumWidthUm: minimumWidth, maximumWidthUm: Math.max(...widths),
    actualCourant, substeps, exactCellCounts,
    predictedCellCounts: counts, normalizedL1,
    populationConservationRelativeError, boundaryOutflowPerMl,
    observedMoments, referenceMoments, relativeMomentErrors,
    minimumPopulation: Math.min(...counts),
  };
}

/**
 * Experiment settings are OUR openly declared test values, not unverified
 * supplementary parameters or purported reproductions of paper Figs. 2-12.
 */
export function runZhangNonuniformPbeBenchmark(options?: {
  meshes?: number[];
  initialSupportUm?: [number, number];
  totalNumberPerMl?: number;
  growthUmPerMin?: number;
  durationMin?: number;
  maxCourant?: number;
  geometricWidthRatio?: number;
}): ZhangPbeBenchmark {
  const meshes = options?.meshes ?? [64, 128, 256];
  if (!Array.isArray(meshes) || meshes.length !== 3 ||
      meshes.some((v, i) => !Number.isInteger(v) || v < 32 || v > 256 ||
        (i > 0 && v <= meshes[i - 1]))) {
    throw new RangeError("Use three ascending integer grids within 32..256 cells.");
  }
  const support: [number, number] = options?.initialSupportUm ?? [10, 20];
  if (!Array.isArray(support) || support.length !== 2) {
    throw new RangeError("Support must contain two bounds.");
  }
  range(support[0], "support low", 0, 118);
  range(support[1], "support high", 0, 120);
  if (support[1] - support[0] < 2) {
    throw new RangeError("Support must have width >= 2 micrometres.");
  }
  const numberPerMl = options?.totalNumberPerMl ?? 100_000;
  const velocity = options?.growthUmPerMin ?? 0.65;
  const duration = options?.durationMin ?? 20;
  const maxCourant = options?.maxCourant ?? 0.4;
  const ratio = options?.geometricWidthRatio ?? 3;
  range(numberPerMl, "totalNumberPerMl", 1, 1e10);
  range(velocity, "growthUmPerMin", 0, 2);
  range(duration, "durationMin", 0, 120);
  range(maxCourant, "maxCourant", 0.05, 0.4);
  range(ratio, "geometricWidthRatio", 1.25, 8);
  if (support[1] + velocity * duration >= 110) {
    throw new RangeError("Translated support must not approach the upper boundary.");
  }
  const meshTypes: MeshType[] = ["uniform", "geometric_left_refined"];
  const cases = meshTypes.flatMap(mesh =>
    meshes.map(n => evaluateCase(n, mesh, support, numberPerMl,
      velocity, duration, maxCourant, ratio)));
  const refinement = meshTypes.flatMap(mesh => meshes.slice(1).map((fine, i) => {
    const coarse = meshes[i];
    const a = cases.find(c => c.meshType === mesh && c.bins === coarse)!;
    const b = cases.find(c => c.meshType === mesh && c.bins === fine)!;
    return {
      meshType: mesh, coarseBins: coarse, fineBins: fine,
      coarseL1: a.normalizedL1, fineL1: b.normalizedL1,
      observedOrder: a.normalizedL1 > 0 && b.normalizedL1 > 0 ?
        Math.log(a.normalizedL1 / b.normalizedL1) / Math.log(fine / coarse) : null,
    };
  }));
  return {
    schemaVersion: ZHANG_NONUNIFORM_BENCHMARK_VERSION,
    kind: "analytic_uniform_vs_nonuniform_fvm_numerical_verification",
    source: {
      doi: "10.1016/j.compchemeng.2024.108612",
      citedParts: ["4.1", "6.1", "eq49", "eq50", "eq51"],
      fullPaperResultsReproduced: false,
    },
    settings: {
      sizeRangeUm: [0, 120], initialSupportUm: [...support],
      totalNumberPerMl: numberPerMl, growthUmPerMin: velocity,
      durationMin: duration, maxCourant, geometricWidthRatio: ratio,
      meshes: [...meshes],
    },
    cases, refinement,
    physicalClaims: {
      measuredCrystallizationData: false,
      kineticsValidated: false,
      quantumDeviceUsed: false,
      paperCaseReproduced: false,
    },
    limitations: [
      "Analytic transport-only verification: no actual particle-size measurement, kinetic parameter fitting, nucleation, growth-rate dispersion or solute mass balance.",
      "Implements only first-order conservative upwind flux on arbitrary grid widths; CADET Koren/WENO and adaptive implicit BDF/IDAS are not reproduced.",
      "All constants are declared CrystalTwinAI demonstration values, NOT the paper's unverified supplementary test parameters.",
      "Bin-center moment quadrature approximates physical moments, while the reference moments integrate the exact translated rectangle.",
      "Finite support remains away from the upper domain boundary; recorded outflow must be inspected for other settings.",
      "Observed convergence orders are mesh-specific diagnostics, not formal global error-order proofs.",
    ],
  };
}
