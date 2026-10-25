import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import { sha256Bytes, sha256Text } from "../src/lib/pilot/sha256";

test("sha256 matches FIPS 180-4 vectors", () => {
  assert.equal(sha256Text(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Text("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256 matches node:crypto across block boundaries and unicode", () => {
  for (const size of [1, 55, 56, 63, 64, 65, 119, 120, 1000, 70_000]) {
    const data = new Uint8Array(randomBytes(size));
    assert.equal(sha256Bytes(data), createHash("sha256").update(data).digest("hex"), `size ${size}`);
  }
  const text = "結晶化 °C/min ✓ 🧪";
  assert.equal(sha256Text(text), createHash("sha256").update(text, "utf8").digest("hex"));
});
