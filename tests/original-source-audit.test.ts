import test from "node:test";
import assert from "node:assert/strict";
import {
  RAW_AUDIT_SCHEMA,SOURCE_DIGESTS,SOURCE_TABLE_SHAPES,
  verifyKnownFullSourceHeaderFixture,auditOriginalBigSolDBFiles,
} from "../scripts/audit-bigsoldb-raw";
import { BIGSOLDB21_SOURCE } from "../scripts/import-bigsoldb21";
import { BIGSOLDB22_SOURCE } from "../scripts/import-bigsoldb22";

test("external published source shapes are explicit, exact and source-native",()=>{
  assert.equal(RAW_AUDIT_SCHEMA,"crystaltwin-source-byte-audit/1");
  assert.equal(SOURCE_TABLE_SHAPES.v21.expectedRows,112465);
  assert.equal(SOURCE_TABLE_SHAPES.v22.expectedRows,125752);
  assert.equal(SOURCE_TABLE_SHAPES.methods.expectedRows,1842);
  assert.equal(SOURCE_TABLE_SHAPES.solidForms.expectedRows,2295);
  assert.equal(SOURCE_TABLE_SHAPES.v21.columns.length,12);
  assert.equal(SOURCE_TABLE_SHAPES.v22.columns.length,14);
  assert.equal(SOURCE_TABLE_SHAPES.methods.columns.length,10);
  assert.equal(SOURCE_TABLE_SHAPES.solidForms.columns.length,15);
  assert.deepEqual([...SOURCE_TABLE_SHAPES.v22.columns].slice(-2),["Source","solid_form_label"]);
  assert.ok(SOURCE_TABLE_SHAPES.v21.columns.includes("Solubility(mole_fraction)"));
  assert.ok(SOURCE_TABLE_SHAPES.v22.columns.includes("Solubility(mole_fraction)"));
  assert.ok(!SOURCE_TABLE_SHAPES.v22.columns.includes("method"));
  assert.ok(SOURCE_TABLE_SHAPES.methods.columns.includes("method"));
});

test("published independent checksum contracts are pinned, not invented at runtime",()=>{
  assert.equal(SOURCE_DIGESTS.v21.gitBlobSha1,BIGSOLDB21_SOURCE.gitBlobSha1);
  assert.equal(SOURCE_DIGESTS.v22.gitBlobSha1,BIGSOLDB22_SOURCE.gitBlobSha1);
  assert.equal(SOURCE_DIGESTS.v21.sizeBytes,19675205);
  assert.equal(SOURCE_DIGESTS.v22.sizeBytes,24678209);
  assert.equal(SOURCE_DIGESTS.v21.huggingFaceSha256,
    "212cb511e05051917f7ab8811282c06c99512e4f720cf270be555fdf07b4a854");
  assert.equal(SOURCE_DIGESTS.v22.zenodoMd5,"a1e12ae9575319ac4f89fea6a63a6422");
  assert.equal(SOURCE_DIGESTS.methods.zenodoMd5,"4e7a688055d0e8ebf4c8c3a202b29b7c");
  assert.equal(SOURCE_DIGESTS.solidForms.zenodoMd5,"3a077abad5373f52341f7915a9a38757");
});

test("header contract refuses swapped, missing and invented source columns",()=>{
  for(const key of ["v21","v22","methods","solidForms"] as const){
    const original=[...SOURCE_TABLE_SHAPES[key].columns];
    assert.deepEqual(verifyKnownFullSourceHeaderFixture(key,original.join(",")+"\n"),original);
    const changed=original.slice();
    changed[0]="Fictitious_Source_Column";
    assert.throws(()=>verifyKnownFullSourceHeaderFixture(key,changed.join(",")+"\n"),/header differs/);
    assert.throws(()=>verifyKnownFullSourceHeaderFixture(key,original.slice(1).join(",")+"\n"),/header differs/);
    const swapped=original.slice();
    [swapped[0],swapped[1]]=[swapped[1],swapped[0]];
    assert.throws(()=>verifyKnownFullSourceHeaderFixture(key,swapped.join(",")+"\n"),/header differs/);
  }
});

test("no claim of actual raw audit can be made using a synthetic CSV or arbitrary digest",()=>{
  const fake=new TextEncoder().encode("This is NOT BigSolDB primary CSV.\n");
  assert.throws(()=>auditOriginalBigSolDBFiles({
    v21:fake,v22:fake,methods:fake,solidForms:fake,
  }),/byte length mismatch/);
});
