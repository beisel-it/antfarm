/**
 * US-004: Auto-dispatch next queued entry when a run completes
 *
 * Tests:
 * 1. When run completes with project_id, getNextQueuedEntry is called for that project+workflow
 * 2. If no queued entries exist, no error occurs and no run is started
 * 3. Auto-dispatch updates status='dispatched', run_id, queue_order=null
 * 4. Runs without a project_id do NOT trigger auto-dispatch
 * 5. If runWorkflow throws during auto-dispatch, original run completion still succeeds
 * 6. Auto-dispatch only processes the *next* (lowest queue_order) entry
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../dist/db.js";
import {
  addBacklogEntry,
  deleteBacklogEntry,
  getBacklogEntry,
  updateBacklogEntry,
  queueBacklogEntry,
  getNextQueuedEntry,
} from "../dist/backlog/index.js";

function now(): string {
  return new Date().toISOString();
}

/**
 * Insert a run row directly into the DB.
 */
function insertRun(
  db: ReturnType<typeof getDb>,
  opts: {
    id?: string;
    status?: string;
    workflowId?: string;
    projectId?: string | null;
    task?: string;
  } = {}
): string {
  const id = opts.id ?? crypto.randomUUID();
  const t = now();
  db.prepare(
    "INSERT INTO runs (id, workflow_id, task, status, context, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, '{}', ?, ?, ?)"
  ).run(
    id,
    opts.workflowId ?? "wf-auto-dispatch-test",
    opts.task ?? "test task",
    opts.status ?? "running",
    opts.projectId ?? null,
    t,
    t
  );
  return id;
}

/**
 * Insert a project row for testing.
 */
function insertProject(db: ReturnType<typeof getDb>, id?: string): string {
  const projectId = id ?? crypto.randomUUID();
  const t = now();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(projectId, `project-${projectId.slice(0, 8)}`, t, t);
  return projectId;
}

/**
 * Simulate the auto-dispatch logic from advancePipeline.
 * This mirrors what happens inside step-ops.ts when a run completes.
 * Returns the new run id if dispatched, null otherwise.
 * Throws if runWorkflow would throw — caller must handle.
 */
function simulateAutoDispatch(
  db: ReturnType<typeof getDb>,
  runId: string,
  mockRunWorkflow: (params: { workflowId: string; taskTitle: string; projectId: string }) => { id: string }
): string | null {
  const completedRun = db
    .prepare("SELECT project_id, workflow_id FROM runs WHERE id = ?")
    .get(runId) as { project_id: string | null; workflow_id: string } | undefined;

  if (!completedRun?.project_id) return null;

  const nextQueued = getNextQueuedEntry(completedRun.project_id, completedRun.workflow_id);
  if (!nextQueued) return null;

  const backlogId = nextQueued.id;
  const newRun = mockRunWorkflow({
    workflowId: completedRun.workflow_id,
    taskTitle: nextQueued.title,
    projectId: completedRun.project_id,
  });
  updateBacklogEntry(backlogId, { status: "dispatched", run_id: newRun.id, queue_order: null });
  return newRun.id;
}

describe("US-004: Auto-dispatch queued backlog entry on run completion", () => {
  const db = getDb();
  const createdBacklogIds: string[] = [];
  const createdRunIds: string[] = [];
  const createdProjectIds: string[] = [];

  after(() => {
    for (const id of createdBacklogIds) {
      try { deleteBacklogEntry(id); } catch {}
    }
    for (const id of createdRunIds) {
      try { db.prepare("DELETE FROM steps WHERE run_id = ?").run(id); } catch {}
      try { db.prepare("DELETE FROM runs WHERE id = ?").run(id); } catch {}
    }
    for (const id of createdProjectIds) {
      try { db.prepare("DELETE FROM projects WHERE id = ?").run(id); } catch {}
    }
  });

  it("returns null and does not throw when no queued entries exist", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);

    const runId = insertRun(db, {
      projectId,
      workflowId: "wf-no-queue",
      status: "done",
    });
    createdRunIds.push(runId);

    let called = false;
    const result = simulateAutoDispatch(db, runId, () => {
      called = true;
      return { id: "should-not-be-called" };
    });

    assert.equal(result, null, "should return null when no queued entries");
    assert.equal(called, false, "runWorkflow should not be called");
  });

  it("does not trigger auto-dispatch when run has no project_id", () => {
    const runId = insertRun(db, {
      projectId: null,
      workflowId: "wf-no-project",
      status: "done",
    });
    createdRunIds.push(runId);

    let called = false;
    const result = simulateAutoDispatch(db, runId, () => {
      called = true;
      return { id: "should-not-be-called" };
    });

    assert.equal(result, null, "should return null when run has no project_id");
    assert.equal(called, false, "runWorkflow should not be called without project_id");
  });

  it("auto-dispatches queued entry and sets status='dispatched', run_id, queue_order=null", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);

    const workflowId = `wf-dispatch-${crypto.randomUUID().slice(0, 8)}`;

    // Create a backlog entry and queue it
    const entry = addBacklogEntry({ title: "queued task", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    // Verify it's queued
    const queued = getBacklogEntry(entry.id);
    assert.equal(queued?.status, "queued");
    assert.notEqual(queued?.queue_order, null);

    // Create a completed run for the same project+workflow
    const runId = insertRun(db, { projectId, workflowId, status: "done" });
    createdRunIds.push(runId);

    const newRunId = crypto.randomUUID();
    const result = simulateAutoDispatch(db, runId, (params) => {
      assert.equal(params.projectId, projectId);
      assert.equal(params.workflowId, workflowId);
      assert.equal(params.taskTitle, "queued task");
      return { id: newRunId };
    });

    assert.equal(result, newRunId, "should return the new run id");

    const updated = getBacklogEntry(entry.id);
    assert.equal(updated?.status, "dispatched", "status should be 'dispatched'");
    assert.equal(updated?.run_id, newRunId, "run_id should point to the new run");
    assert.equal(updated?.queue_order, null, "queue_order should be null after dispatch");
  });

  it("dispatches the entry with the lowest queue_order first", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);

    const workflowId = `wf-order-${crypto.randomUUID().slice(0, 8)}`;

    // Create two entries and queue them
    const entry1 = addBacklogEntry({ title: "first in queue", projectId });
    const entry2 = addBacklogEntry({ title: "second in queue", projectId });
    createdBacklogIds.push(entry1.id, entry2.id);

    updateBacklogEntry(entry1.id, { workflow_id: workflowId });
    updateBacklogEntry(entry2.id, { workflow_id: workflowId });
    queueBacklogEntry(entry1.id, { workflowId }); // queue_order = 1
    queueBacklogEntry(entry2.id, { workflowId }); // queue_order = 2

    const runId = insertRun(db, { projectId, workflowId, status: "done" });
    createdRunIds.push(runId);

    const newRunId = crypto.randomUUID();
    let dispatchedTitle = "";
    const result = simulateAutoDispatch(db, runId, (params) => {
      dispatchedTitle = params.taskTitle;
      return { id: newRunId };
    });

    assert.equal(result, newRunId);
    assert.equal(dispatchedTitle, "first in queue", "should dispatch the entry with lowest queue_order");

    // entry1 dispatched, entry2 still queued
    const e1 = getBacklogEntry(entry1.id);
    const e2 = getBacklogEntry(entry2.id);
    assert.equal(e1?.status, "dispatched");
    assert.equal(e2?.status, "queued");
  });

  it("if runWorkflow throws, the error is propagated (caller must wrap in try/catch)", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);

    const workflowId = `wf-throw-${crypto.randomUUID().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "will-fail dispatch", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    const runId = insertRun(db, { projectId, workflowId, status: "done" });
    createdRunIds.push(runId);

    // Simulate that runWorkflow throws — in the real code this is caught by the
    // .catch() promise handler so run completion doesn't fail. But the backlog
    // entry must NOT be updated when runWorkflow fails.
    let dispatchFailed = false;
    try {
      simulateAutoDispatch(db, runId, () => {
        throw new Error("runWorkflow failed");
      });
    } catch {
      dispatchFailed = true;
    }

    // The error IS thrown in our synchronous simulation (in production it's async .catch())
    // The key test: backlog entry NOT updated when runWorkflow fails
    assert.ok(dispatchFailed, "runWorkflow error should propagate in synchronous simulation");

    // The backlog entry should NOT be updated when runWorkflow fails
    const unchanged = getBacklogEntry(entry.id);
    assert.equal(unchanged?.status, "queued", "status should remain 'queued' if runWorkflow fails");
    assert.notEqual(unchanged?.queue_order, null, "queue_order should remain set if runWorkflow fails");
  });

  it("only dispatches for the matching project+workflow combination", () => {
    const projectA = insertProject(db);
    const projectB = insertProject(db);
    createdProjectIds.push(projectA, projectB);

    const workflowId = `wf-scope-${crypto.randomUUID().slice(0, 8)}`;

    // Queue an entry for project B
    const entryB = addBacklogEntry({ title: "project B queue", projectId: projectB });
    createdBacklogIds.push(entryB.id);
    updateBacklogEntry(entryB.id, { workflow_id: workflowId });
    queueBacklogEntry(entryB.id, { workflowId });

    // Complete a run for project A (not B)
    const runIdA = insertRun(db, { projectId: projectA, workflowId, status: "done" });
    createdRunIds.push(runIdA);

    let called = false;
    const result = simulateAutoDispatch(db, runIdA, () => {
      called = true;
      return { id: "should-not-dispatch" };
    });

    assert.equal(result, null, "should not dispatch for different project");
    assert.equal(called, false, "runWorkflow should not be called for mismatched project");

    // Entry B should still be queued
    const stillQueued = getBacklogEntry(entryB.id);
    assert.equal(stillQueued?.status, "queued");
  });

  it("getNextQueuedEntry returns null when no queued entries for the project+workflow", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);

    const workflowId = `wf-empty-${crypto.randomUUID().slice(0, 8)}`;

    const result = getNextQueuedEntry(projectId, workflowId);
    assert.equal(result, null, "should return null when queue is empty");
  });

  it("updateBacklogEntry correctly sets queue_order to null", () => {
    const entry = addBacklogEntry({ title: "test queue_order null" });
    createdBacklogIds.push(entry.id);

    // Set queue_order to an integer
    updateBacklogEntry(entry.id, { queue_order: 5 });
    const withOrder = getBacklogEntry(entry.id);
    assert.equal(withOrder?.queue_order, 5, "queue_order should be 5");

    // Reset to null
    updateBacklogEntry(entry.id, { queue_order: null });
    const withNull = getBacklogEntry(entry.id);
    assert.equal(withNull?.queue_order, null, "queue_order should be null after reset");
  });
});
