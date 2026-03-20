import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../dist/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliBin = join(__dirname, "..", "dist", "cli", "cli.js");

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(process.execPath, [cliBin, ...args], {
    encoding: "utf-8",
    timeout: 10000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

describe("projects CLI commands", () => {
  let addedId: string;
  let idPrefix: string;

  before(() => {
    // Clean up projects table before tests
    const db = getDb();
    db.prepare("DELETE FROM projects").run();
  });

  it("project add exits 0 and prints the new id", () => {
    const result = runCli([
      "project", "add", "My Project",
      "--git-repo-path", "/repo",
      "--github-repo-url", "https://github.com/x/y",
    ]);
    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    addedId = result.stdout.trim();
    assert.match(addedId, /^[0-9a-f-]{36}$/, `Expected a UUID, got: ${addedId}`);
    idPrefix = addedId.slice(0, 8);
  });

  it("project list shows the added project", () => {
    const result = runCli(["project", "list"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("My Project"), `Expected 'My Project' in output:\n${result.stdout}`);
    assert.ok(result.stdout.includes("/repo"), `Expected '/repo' in output:\n${result.stdout}`);
    assert.ok(result.stdout.includes("https://github.com/x/y"), `Expected github url in output:\n${result.stdout}`);
  });

  it("project list --json outputs a valid JSON array", () => {
    const result = runCli(["project", "list", "--json"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    let parsed: unknown;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, "Output should be valid JSON");
    assert.ok(Array.isArray(parsed), "JSON output should be an array");
    const arr = parsed as Array<{ name: string }>;
    assert.ok(arr.length > 0, "JSON array should have at least one entry");
    assert.ok(arr.some((p) => p.name === "My Project"), "JSON array should contain 'My Project'");
  });

  it("project update exits 0 and updates the name", () => {
    const result = runCli(["project", "update", idPrefix, "--name", "New Name"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);

    // Verify updated name appears in list
    const listResult = runCli(["project", "list"]);
    assert.ok(listResult.stdout.includes("New Name"), `Expected 'New Name' in list output:\n${listResult.stdout}`);
  });

  it("project delete exits 0 and removes the project", () => {
    const result = runCli(["project", "delete", idPrefix]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("Deleted project"), `Expected 'Deleted project' in output:\n${result.stdout}`);
  });

  it("project list after delete does not show the deleted project", () => {
    const result = runCli(["project", "list"]);
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(!result.stdout.includes("My Project"), `Expected 'My Project' not in output:\n${result.stdout}`);
    assert.ok(!result.stdout.includes("New Name"), `Expected 'New Name' not in output:\n${result.stdout}`);
  });

  it("usage text includes project commands", () => {
    // Run with no args to trigger usage
    const result = runCli([]);
    // usage is printed to stdout or exits non-zero — check stdout
    const combined = result.stdout + result.stderr;
    assert.ok(combined.includes("antfarm project list"), `Usage should include 'antfarm project list':\n${combined}`);
    assert.ok(combined.includes("antfarm project add"), `Usage should include 'antfarm project add':\n${combined}`);
    assert.ok(combined.includes("antfarm project update"), `Usage should include 'antfarm project update':\n${combined}`);
    assert.ok(combined.includes("antfarm project delete"), `Usage should include 'antfarm project delete':\n${combined}`);
  });
});
