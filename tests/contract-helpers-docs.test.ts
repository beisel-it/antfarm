import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const docsPath = resolve(import.meta.dirname, "../docs/contract-helpers.md");
const docsContent = readFileSync(docsPath, "utf-8");
const readmeContent = readFileSync(resolve(import.meta.dirname, "../README.md"), "utf-8");

describe("contract helper documentation", () => {
  it("documents both contract helper commands", () => {
    assert.match(docsContent, /contract commit/);
    assert.match(docsContent, /contract verify-criteria/);
  });

  it("README links to the contract helpers doc", () => {
    assert.ok(readmeContent.includes("docs/contract-helpers.md"));
  });
});
