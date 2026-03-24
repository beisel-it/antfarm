import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, "..", "dist", "cli", "cli.js");

function parseLastJsonLine(output: string) {
  const lines = output.trim().split("\n").reverse();
  for (const line of lines) {
    try {
      return JSON.parse(line);
    } catch {
      // continue searching
    }
  }
  throw new Error("No parsable JSON found in output");
}

describe("contract verify-criteria CLI", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("emits structured pass output and exits 0 when all criteria pass", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "antfarm-criteria-pass-"));
    const criteriaPath = path.join(tmpDir, "criteria.json");
    fs.writeFileSync(criteriaPath, JSON.stringify(["Criterion A", "Criterion B"]));

    const output = execFileSync("node", [cliPath, "contract", "verify-criteria", "--file", criteriaPath, "--decisions", JSON.stringify(["pass", "pass"]), "--json", "--log"], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const parsed = parseLastJsonLine(output);
    assert.equal(parsed.status, "ok");
    assert.equal(parsed.data.overall, "pass");
    assert.equal(parsed.data.criteria.length, 2);
    assert.ok(parsed.data.criteria.every((c: any) => c.status === "pass"));
  });

  it("exits non-zero and reports needs-work when any criterion is not pass", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "antfarm-criteria-fail-"));
    const criteriaPath = path.join(tmpDir, "criteria.json");
    fs.writeFileSync(criteriaPath, JSON.stringify(["Criterion 1", "Criterion 2"]));

    try {
      execFileSync("node", [cliPath, "contract", "verify-criteria", "--file", criteriaPath, "--decisions", JSON.stringify(["pass", "needs-work"]), "--json"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.fail("Expected verify-criteria to exit non-zero when a criterion needs work");
    } catch (err: any) {
      assert.equal(err.status, 1);
      const parsed = parseLastJsonLine(err.stdout?.toString() ?? "");
      assert.equal(parsed.status, "error");
      assert.equal(parsed.data.overall, "needs-work");
      const second = parsed.data.criteria.find((c: any) => c.id === "c2");
      assert(second);
      assert.equal(second.status, "needs-work");
    }
  });
});
