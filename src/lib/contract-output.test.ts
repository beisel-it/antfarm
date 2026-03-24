import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { writeContractOutput } from "../../dist/lib/contract-output.js";

describe("contract-output helper", () => {
  let writes: string[];
  let originalExitCode: number | undefined;

  beforeEach(() => {
    writes = [];
    originalExitCode = process.exitCode;
    mock.method(process.stdout, "write", (chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    mock.restoreAll();
    process.exitCode = originalExitCode ?? 0;
  });

  it("writes human-readable lines and JSON for success", () => {
    writeContractOutput(
      { status: "ok", summary: "all good", data: { foo: "bar" } },
      { exitOnError: false }
    );

    const output = writes.join("");
    assert.match(output, /Status: ok/);
    assert.match(output, /Summary: all good/);
    assert.match(output, /Data: {"foo":"bar"}/);
    assert.match(output, /{"status":"ok","summary":"all good","data":{"foo":"bar"}}/);
    assert.equal(process.exitCode ?? 0, originalExitCode ?? 0);
  });

  it("includes error info and sets exit code on error status", () => {
    process.exitCode = 0;
    writeContractOutput({ status: "error", summary: "failed", error: "boom" }, { exitOnError: true });

    const output = writes.join("");
    assert.match(output, /Status: error/);
    assert.match(output, /Summary: failed/);
    assert.match(output, /Error: boom/);
    assert.match(output, /{"status":"error","summary":"failed","error":"boom"}/);
    assert.equal(process.exitCode, 1);
  });

  it("throws a ContractError when throwOnError is true", () => {
    assert.throws(
      () =>
        writeContractOutput(
          { status: "error", summary: "bad", error: { reason: "nope" } },
          { throwOnError: true, exitOnError: false }
        ),
      /bad|nope/
    );
  });
});
