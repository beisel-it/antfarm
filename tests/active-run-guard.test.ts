import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getActiveRunForProject } from "../dist/installer/run.js";
import { getDb } from "../dist/db.js";

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
    opts.workflowId ?? "test-workflow",
    opts.task ?? "Test task",
    opts.status,
    "{}",
    opts.projectId,
    now,
    now
  );
  return id;
}

before(() => {
  const db = getDb();
  db.prepare("DELETE FROM steps").run();
  db.prepare("DELETE FROM runs").run();
});

beforeEach(() => {
  const db = getDb();
  db.prepare("DELETE FROM steps").run();
  db.prepare("DELETE FROM runs").run();
});

test("getActiveRunForProject returns run when project has a running run", () => {
  const projectId = crypto.randomUUID();
  const runId = insertRun({ projectId, status: "running", workflowId: "wf-1", task: "My task", runNumber: 42 });

  const result = getActiveRunForProject(projectId);

  assert.ok(result !== null, "should return a run");
  assert.equal(result.id, runId);
  assert.equal(result.workflow_id, "wf-1");
  assert.equal(result.task, "My task");
  assert.equal(result.run_number, 42);
});

test("getActiveRunForProject returns null when no running run exists for the project", () => {
  const projectId = crypto.randomUUID();
  insertRun({ projectId, status: "completed" });

  const result = getActiveRunForProject(projectId);

  assert.equal(result, null);
});

test("getActiveRunForProject returns null when project has no runs at all", () => {
  const projectId = crypto.randomUUID();

  const result = getActiveRunForProject(projectId);

  assert.equal(result, null);
});

test("getActiveRunForProject returns null for empty string projectId", () => {
  const result = getActiveRunForProject("");

  assert.equal(result, null);
});

test("getActiveRunForProject returns null when projectId is not found", () => {
  const result = getActiveRunForProject("non-existent-project-id");

  assert.equal(result, null);
});

test("getActiveRunForProject only returns running status, not failed or completed", () => {
  const projectId = crypto.randomUUID();
  insertRun({ projectId, status: "failed" });
  insertRun({ projectId, status: "completed" });

  const result = getActiveRunForProject(projectId);

  assert.equal(result, null);
});

test("getActiveRunForProject does not return running runs for other projects", () => {
  const projectId1 = crypto.randomUUID();
  const projectId2 = crypto.randomUUID();
  insertRun({ projectId: projectId1, status: "running" });

  const result = getActiveRunForProject(projectId2);

  assert.equal(result, null);
});

test("getActiveRunForProject returns only one run when multiple running runs exist for same project", () => {
  const projectId = crypto.randomUUID();
  insertRun({ projectId, status: "running", runNumber: 1 });
  insertRun({ projectId, status: "running", runNumber: 2 });

  const result = getActiveRunForProject(projectId);

  assert.ok(result !== null, "should return a run");
  assert.ok(result.id, "should have an id");
});

test("getActiveRunForProject handles run with null run_number", () => {
  const db = getDb();
  const id = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, null, "wf-null", "Task with null run number", "running", "{}", projectId, now, now);

  const result = getActiveRunForProject(projectId);

  assert.ok(result !== null);
  assert.equal(result.id, id);
  assert.equal(result.run_number, null);
});
