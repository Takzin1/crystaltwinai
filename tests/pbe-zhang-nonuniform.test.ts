import assert from "node:assert/strict";
import test from "node:test";
import {
  runZhangNonuniformPbeBenchmark,
  ZHANG_NONUNIFORM_BENCHMARK_VERSION,
} from "../src/lib/pbe-zhang-nonuniform";

test("paper-grounded nonuniform transport reference is deterministic with exact cell integration", () => {
  const first = runZhangNonuniformPbeBenchmark();
  assert.deepEqual(first, runZhangNonuniformPbeBenchmark());
  assert.equal(first.schemaVersion, ZHANG_NONUNIFORM_BENCHMARK_VERSION);
  assert.equal(first.source.fullPaperResultsReproduced, false);
  assert.equal(first.cases.length, 6);
  assert.equal(first.refinement.length, 4);
  assert.deepEqual(first.settings.meshes, [64, 128, 256]);
  assert.equal(first.physicalClaims.measuredCrystallizationData, false);
  assert.equal(first.physicalClaims.paperCaseReproduced, false);
  for (const row of first.cases) {
    assert.equal(row.gridEdgesUm.length, row.bins + 1);
    assert.equal(row.gridEdgesUm[0], 0);
    assert.equal(row.gridEdgesUm.at(-1), 120);
    assert.ok(row.gridEdgesUm.every((x, i, arr) => i === 0 || x > arr[i - 1]));
    assert.equal(row.exactCellCounts.length, row.bins);
    assert.equal(row.predictedCellCounts.length, row.bins);
    assert.ok(row.actualCourant <= 0.4000000001);
    assert.ok(row.minimumPopulation >= 0);
    assert.ok(row.normalizedL1 >= 0 && row.normalizedL1 < 1);
    assert.ok(row.populationConservationRelativeError < 1e-10);
    assert.ok(row.boundaryOutflowPerMl / first.settings.totalNumberPerMl < 1e-12);
    assert.equal(row.observedMoments.length, 7);
    assert.equal(row.referenceMoments.length, 7);
    assert.equal(row.relativeMomentErrors.length, 7);
    assert.ok(row.relativeMomentErrors.every(v => Number.isFinite(v) && v >= 0));
    assert.ok(row.relativeMomentErrors[0] < 1e-10);
  }
  for (const meshType of ["uniform", "geometric_left_refined"]) {
    const rows = first.cases.filter(x => x.meshType === meshType);
    assert.ok(rows.at(-1)!.normalizedL1 < rows[0].normalizedL1,
      "Fine grid should reduce L1 for " + meshType);
  }
});

test("nonuniform cell widths are nontrivial and conserve with the local Courant bound", () => {
  const study = runZhangNonuniformPbeBenchmark({
    meshes: [32, 80, 160],
    geometricWidthRatio: 5,
    growthUmPerMin: 1.1,
    durationMin: 17,
  });
  for (const run of study.cases.filter(x => x.meshType === "geometric_left_refined")) {
    assert.ok(run.maximumWidthUm / run.minimumWidthUm > 4.5);
    assert.ok(run.maximumWidthUm / run.minimumWidthUm < 5.01);
    assert.ok(run.populationConservationRelativeError < 1e-10);
    assert.ok(run.actualCourant <= 0.400000001);
    assert.equal(run.gridEdgesUm.length, run.bins + 1);
  }
});

test("zero advection equals analytically integrated initial cell counts", () => {
  const study = runZhangNonuniformPbeBenchmark({growthUmPerMin: 0});
  assert.ok(study.cases.every(row =>
    row.normalizedL1 === 0 &&
    row.boundaryOutflowPerMl === 0 &&
    row.populationConservationRelativeError < 1e-11));
  assert.ok(study.refinement.every(row => row.observedOrder === null));
});

test("bad ranges, time horizon and grid resolution fail closed", () => {
  const bad = [
    {meshes: [256, 128, 64]},
    {meshes: [64, 64, 256]},
    {meshes: [32, 64]},
    {meshes: [16, 64, 128]},
    {meshes: [64, 128, 512]},
    {growthUmPerMin: -0.1},
    {growthUmPerMin: NaN},
    {durationMin: Infinity},
    {durationMin: -1},
    {totalNumberPerMl: 0},
    {totalNumberPerMl: Infinity},
    {maxCourant: 0},
    {geometricWidthRatio: 1},
    {geometricWidthRatio: 10},
    {initialSupportUm: [20, 10] as [number, number]},
    {initialSupportUm: [0, 1] as [number, number]},
    {initialSupportUm: [112, 116] as [number, number]},
    {growthUmPerMin: 2, durationMin: 120},
  ];
  for (const option of bad) {
    assert.throws(() => runZhangNonuniformPbeBenchmark(option), /./);
  }
});
