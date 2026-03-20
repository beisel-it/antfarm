import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { getDb } from "../dist/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliBin = join(__dirname, "..", "dist", "cli", "cli.js");

function runCli(args: string[], env?: Record<string, string>): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(process.execPath, [cliBin, ...args], {
    encoding: "utf-8",
    timeout: 10000,
    env: { ...process.env, ...env },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

function insertProject(name: string): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(id, name, now, now);
  return id;
}

function insertRun(opts: {
  id?: string;
  projectId: string | null;
  status: string;
  workflowId?: string;
  task?: string;
  runNumber?: number;
}): string {
  const db = getDb();
  const id = opts.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    opts.runNumber ?? 1,
    opts.workflowId ?? "feature-dev",
    opts.task ?? "Test task",
    opts.status,
    "{}",
    opts.projectId,
    now,
    now
  );
  return id;
}

describe("CLI single-run-per-project guard (US-003)", () => {
  before(() => {
    const db = getDb();
    db.prepare("DELETE FROM steps").run();
    db.prepare("DELETE FROM runs").run();
    db.prepare("DELETE FROM projects").run();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM steps").run();
    db.prepare("DELETE FROM runs").run();
    db.prepare("DELETE FROM projects").run();
  });

  it("exits with code 1 when project already has a running run", () => {
    const projectId = insertProject("Test Project");
    insertRun({ projectId, status: "running", runNumber: 5 });

    const result = runCli([
      "workflow", "run", "feature-dev", "some task",
      "--project", projectId,
    ]);

    assert.equal(result.status, 1, `Expected exit code 1, got ${result.status}. stderr: ${result.stderr}`);
  });

  it("stderr contains 'already has an active run' when guard fires", () => {
    const projectId = insertProject("Another Project");
    insertRun({ projectId, status: "running", runNumber: 7 });

    const result = runCli([
      "workflow", "run", "feature-dev", "new task",
      "--project", projectId,
    ]);

    assert.ok(
      result.stderr.includes("already has an active run"),
      `Expected 'already has an active run' in stderr, got: "${result.stderr}"`
    );
  });

  it("stderr starts with 'Cannot start run:' when guard fires", () => {
    const projectId = insertProject("My Project");
    insertRun({ projectId, status: "running", runNumber: 3 });

    const result = runCli([
      "workflow", "run", "feature-dev", "blocked task",
      "--project", projectId,
    ]);

    assert.ok(
      result.stderr.startsWith("Cannot start run:"),
      `Expected stderr to start with 'Cannot start run:', got: "${result.stderr}"`
    );
  });

  it("resolves project id from prefix", () => {
    const projectId = insertProject("Prefix Test Project");
    insertRun({ projectId, status: "running", runNumber: 9 });

    const prefix = projectId.slice(0, 8);
    const result = runCli([
      "workflow", "run", "feature-dev", "task via prefix",
      "--project", prefix,
    ]);

    assert.equal(result.status, 1, `Expected exit code 1, got ${result.status}`);
    assert.ok(
      result.stderr.includes("already has an active run"),
      `Expected guard error in stderr, got: "${result.stderr}"`
    );
  });

  it("exits with code 1 and stderr 'Project not found' when --project prefix doesn't match", () => {
    const result = runCli([
      "workflow", "run", "feature-dev", "some task",
      "--project", "nonexistent-prefix",
    ]);

    assert.equal(result.status, 1, `Expected exit code 1, got ${result.status}`);
    assert.ok(
      result.stderr.includes("Project not found"),
      `Expected 'Project not found' in stderr, got: "${result.stderr}"`
    );
  });

  it("workflow run without --project is unaffected by the guard", () => {
    // Insert a run for some project — should not affect runs without projectId
    const projectId = insertProject("Unrelated Project");
    insertRun({ projectId, status: "running", runNumber: 1 });

    // Running without --project should not trigger the guard (it may fail for other reasons)
    const result = runCli([
      "workflow", "run", "nonexistent-workflow", "some task",
    ]);

    assert.ok(
      !result.stderr.includes("already has an active run"),
      `Guard should NOT fire for runs without --project, got stderr: "${result.stderr}"`
    );
    assert.ok(
      !result.stderr.startsWith("Cannot start run:"),
      `Should not get 'Cannot start run:' without --project, got: "${result.stderr}"`
    );
  });

  it("project with only completed/failed runs does not trigger the guard", () => {
    const projectId = insertProject("Done Project");
    insertRun({ projectId, status: "completed", runNumber: 1 });
    insertRun({ projectId, status: "failed", runNumber: 2 });
    insertRun({ projectId, status: "cancelled", runNumber: 3 });

    const result = runCli([
      "workflow", "run", "nonexistent-workflow", "new task",
      "--project", projectId,
    ]);

    assert.ok(
      !result.stderr.includes("already has an active run"),
      `Guard should NOT fire for completed/failed/cancelled runs, got: "${result.stderr}"`
    );
    assert.ok(
      !result.stderr.startsWith("Cannot start run:"),
      `Should not get 'Cannot start run:' for inactive runs, got: "${result.stderr}"`
    );
  });
});
