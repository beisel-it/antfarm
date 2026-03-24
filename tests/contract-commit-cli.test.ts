import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, "..", "dist", "cli", "cli.js");

function initRepo(dir: string) {
  execSync("git init", { cwd: dir });
  try {
    execSync("git checkout -b main", { cwd: dir, stdio: "ignore" });
  } catch {
    // branch may already exist; ignore
  }
  execSync("git config user.name 'Test User'", { cwd: dir });
  execSync("git config user.email 'test@example.com'", { cwd: dir });
  fs.writeFileSync(path.join(dir, "README.md"), "# test\n");
  execSync("git add README.md", { cwd: dir });
  execSync("git commit -m 'init'", { cwd: dir });
}

function parseJsonLine(output: string) {
  const lines = output.trim().split("\n");
  const last = lines[lines.length - 1];
  return JSON.parse(last);
}

describe("contract commit CLI", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "antfarm-contract-commit-"));
    initRepo(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a commit and emits structured output", () => {
    const message = "Test structured commit";
    fs.writeFileSync(path.join(tmpDir, "file.txt"), "hello");
    execSync("git add file.txt", { cwd: tmpDir });

    const output = execFileSync("node", [cliPath, "contract", "commit", "--message", message], {
      cwd: tmpDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const parsed = parseJsonLine(output);
    assert.equal(parsed.status, "ok");
    assert.equal(parsed.data.message, message);
    assert.equal(parsed.data.stagedFiles, 1);
    assert.match(parsed.data.sha, /^[0-9a-f]{40}$/);

    const logMsg = execSync("git log -1 --pretty=%B", { cwd: tmpDir, encoding: "utf-8" }).trim();
    assert.equal(logMsg, message);
  });

  it("fails with structured error when no staged changes", () => {
    try {
      execFileSync("node", [cliPath, "contract", "commit", "--message", "No staged"], {
        cwd: tmpDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.fail("Expected command to fail when no staged changes");
    } catch (err: any) {
      assert.equal(err.status, 1);
      const stdout = (err.stdout ?? "").toString();
      const parsed = parseJsonLine(stdout);
      assert.equal(parsed.status, "error");
      assert.match(parsed.summary, /No staged/i);
    }
  });
});
