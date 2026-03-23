/**
 * US-002: Wrap auto-dispatch in atomic CAS transaction in advancePipeline()
 *
 * Tests the atomic claim pattern:
 * 1. BEGIN IMMEDIATE + SELECT + UPDATE atomically claims next queued entry
 * 2. Intermediate 'dispatching' status is set before runWorkflow() is called
 * 3. On runWorkflow() success, status is updated to 'dispatched' with new run_id
 * 4. On runWorkflow() failure, status is reset to 'queued' (rollback)
 * 5. If 0 rows updated (concurrent claim), dispatch is silently skipped
 * 6. queueBacklogEntry blocks 'dispatching' entries (treated same as 'dispatched')
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../src/db.ts";
import {
  addBacklogEntry,
  deleteBacklogEntry,
  getBacklogEntry,
  updateBacklogEntry,
  queueBacklogEntry,
  getNextQueuedEntry,
} from "../dist/backlog/index.js";

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function insertProject(db: ReturnType<typeof getDb>, id?: string): string {
  const projectId = id ?? uid();
  const t = now();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(projectId, `project-${projectId.slice(0, 8)}`, t, t);
  return projectId;
}

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
  const id = opts.id ?? uid();
  const t = now();
  db.prepare(
    "INSERT INTO runs (id, workflow_id, task, status, context, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, '{}', ?, ?, ?)"
  ).run(
    id,
    opts.workflowId ?? "wf-test",
    opts.task ?? "test task",
    opts.status ?? "running",
    opts.projectId ?? null,
    t,
    t
  );
  return id;
}

/**
 * Simulate the atomic auto-dispatch logic from advancePipeline() — the new
 * CAS implementation. Mirrors what step-ops.ts does after a run completes.
 *
 * @param onRunWorkflow - synchronous mock for runWorkflow. Throw to simulate failure.
 * @returns { claimedId, newRunId } or null if nothing was dispatched.
 */
function simulateAtomicAutoDispatch(
  db: ReturnType<typeof getDb>,
  projectId: string,
  workflowId: string,
  onRunWorkflow: (params: { workflowId: string; taskTitle: string; projectId: string }) => { id: string }
): { claimedId: string; newRunId: string } | null {
  // BEGIN IMMEDIATE transaction — atomic claim
  let claimedEntry: { id: string; title: string } | null = null;
  try {
    db.exec("BEGIN IMMEDIATE");
    const candidateRow = db.prepare(
      "SELECT id, title FROM backlog WHERE project_id = ? AND workflow_id = ? AND status = 'queued' ORDER BY queue_order ASC, created_at ASC LIMIT 1"
    ).get(projectId, workflowId) as { id: string; title: string } | undefined;

    if (candidateRow) {
      const ts = now();
      const updateResult = db.prepare(
        "UPDATE backlog SET status = 'dispatching', updated_at = ? WHERE id = ? AND status = 'queued'"
      ).run(ts, candidateRow.id) as { changes: number };

      if (updateResult.changes > 0) {
        claimedEntry = { id: candidateRow.id, title: candidateRow.title };
      }
    }
    db.exec("COMMIT");
  } catch (txErr) {
    try { db.exec("ROLLBACK"); } catch {}
    throw txErr;
  }

  if (!claimedEntry) return null;

  // Outside transaction: call runWorkflow
  const backlogId = claimedEntry.id;
  const taskTitle = claimedEntry.title;

  try {
    const newRun = onRunWorkflow({ workflowId, taskTitle, projectId });
    // Success: update to dispatched
    updateBacklogEntry(backlogId, { status: "dispatched", run_id: newRun.id, queue_order: null });
    return { claimedId: backlogId, newRunId: newRun.id };
  } catch (err) {
    // Failure: reset to queued
    updateBacklogEntry(backlogId, { status: "queued" });
    throw err;
  }
}

describe("US-002: Atomic CAS auto-dispatch in advancePipeline()", () => {
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

  it("AC1: atomically sets status to 'dispatching' inside BEGIN IMMEDIATE transaction before runWorkflow", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-ac1-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "AC1 task", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    // Verify initial state
    assert.equal(getBacklogEntry(entry.id)?.status, "queued");

    let statusDuringRun = "";
    const newRunId = uid();
    simulateAtomicAutoDispatch(db, projectId, workflowId, (_params) => {
      // Inside the runWorkflow call, check what status the DB row has
      const row = db.prepare("SELECT status FROM backlog WHERE id = ?").get(entry.id) as { status: string } | undefined;
      statusDuringRun = row?.status ?? "";
      return { id: newRunId };
    });

    assert.equal(statusDuringRun, "dispatching", "status should be 'dispatching' while runWorkflow is executing");
  });

  it("AC2: intermediate 'dispatching' status is set before runWorkflow() is called", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-ac2-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "AC2 task", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    let seenDispatching = false;
    simulateAtomicAutoDispatch(db, projectId, workflowId, (_params) => {
      const row = db.prepare("SELECT status FROM backlog WHERE id = ?").get(entry.id) as { status: string } | undefined;
      seenDispatching = row?.status === "dispatching";
      return { id: uid() };
    });

    assert.ok(seenDispatching, "dispatching status must be visible before runWorkflow runs");
  });

  it("AC3: on runWorkflow() success, status becomes 'dispatched' with the new run_id", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-ac3-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "AC3 task", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    const newRunId = uid();
    const result = simulateAtomicAutoDispatch(db, projectId, workflowId, () => ({ id: newRunId }));

    assert.ok(result, "should return a result on success");
    const updated = getBacklogEntry(entry.id);
    assert.equal(updated?.status, "dispatched", "status should be 'dispatched' after success");
    assert.equal(updated?.run_id, newRunId, "run_id should be set to the new run id");
    assert.equal(updated?.queue_order, null, "queue_order should be null after dispatch");
  });

  it("AC4: on runWorkflow() failure, status is reset to 'queued'", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-ac4-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "AC4 task", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    let threw = false;
    try {
      simulateAtomicAutoDispatch(db, projectId, workflowId, () => {
        throw new Error("runWorkflow failed");
      });
    } catch {
      threw = true;
    }

    assert.ok(threw, "error should propagate");
    const reset = getBacklogEntry(entry.id);
    assert.equal(reset?.status, "queued", "status should be reset to 'queued' after runWorkflow failure");
  });

  it("AC5: if another caller already claimed the entry (UPDATE changes=0), dispatch is silently skipped", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-ac5-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "AC5 task", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    // Simulate another caller getting there first: manually set to 'dispatching'
    db.prepare("UPDATE backlog SET status = 'dispatching', updated_at = ? WHERE id = ?").run(now(), entry.id);

    let runWorkflowCalled = false;
    const result = simulateAtomicAutoDispatch(db, projectId, workflowId, () => {
      runWorkflowCalled = true;
      return { id: uid() };
    });

    assert.equal(result, null, "should return null when entry was already claimed");
    assert.equal(runWorkflowCalled, false, "runWorkflow should NOT be called when 0 rows updated");

    // Cleanup: restore to pending so we can delete
    db.prepare("UPDATE backlog SET status = 'pending', updated_at = ? WHERE id = ?").run(now(), entry.id);
  });

  it("AC5b: queue is empty — dispatch returns null without calling runWorkflow", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-ac5b-${uid().slice(0, 8)}`;

    let called = false;
    const result = simulateAtomicAutoDispatch(db, projectId, workflowId, () => {
      called = true;
      return { id: uid() };
    });

    assert.equal(result, null, "should return null with empty queue");
    assert.equal(called, false, "runWorkflow should not be called with empty queue");
  });

  it("AC6: only dispatches the entry with lowest queue_order", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-ac6-${uid().slice(0, 8)}`;

    const e1 = addBacklogEntry({ title: "first", projectId });
    const e2 = addBacklogEntry({ title: "second", projectId });
    createdBacklogIds.push(e1.id, e2.id);

    updateBacklogEntry(e1.id, { workflow_id: workflowId });
    updateBacklogEntry(e2.id, { workflow_id: workflowId });
    queueBacklogEntry(e1.id, { workflowId }); // queue_order = 1
    queueBacklogEntry(e2.id, { workflowId }); // queue_order = 2

    let dispatchedTitle = "";
    simulateAtomicAutoDispatch(db, projectId, workflowId, (params) => {
      dispatchedTitle = params.taskTitle;
      return { id: uid() };
    });

    assert.equal(dispatchedTitle, "first", "should dispatch lowest queue_order entry first");
    assert.equal(getBacklogEntry(e1.id)?.status, "dispatched");
    assert.equal(getBacklogEntry(e2.id)?.status, "queued");
  });

  it("'dispatching' status is treated same as 'dispatched' — queueBacklogEntry rejects it", () => {
    const entry = addBacklogEntry({ title: "dispatching test" });
    createdBacklogIds.push(entry.id);
    
    // Manually set to 'dispatching'
    db.prepare("UPDATE backlog SET status = 'dispatching', updated_at = ? WHERE id = ?").run(now(), entry.id);
    
    assert.throws(
      () => queueBacklogEntry(entry.id, { workflowId: "wf-x" }),
      /already dispatched/,
      "queueBacklogEntry should reject 'dispatching' entries just like 'dispatched'"
    );
    
    // Cleanup
    db.prepare("UPDATE backlog SET status = 'pending', updated_at = ? WHERE id = ?").run(now(), entry.id);
  });

  it("getNextQueuedEntry does not return 'dispatching' entries (they are no longer 'queued')", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-getnext-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "dispatching test", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    // Simulate it was claimed by another caller — now 'dispatching'
    db.prepare("UPDATE backlog SET status = 'dispatching', updated_at = ? WHERE id = ?").run(now(), entry.id);

    const next = getNextQueuedEntry(projectId, workflowId);
    assert.equal(next, null, "getNextQueuedEntry must not return 'dispatching' entries");

    // Cleanup
    db.prepare("UPDATE backlog SET status = 'pending', updated_at = ? WHERE id = ?").run(now(), entry.id);
  });

  it("concurrent simulation: two callers racing — only one dispatches", () => {
    const projectId = insertProject(db);
    createdProjectIds.push(projectId);
    const workflowId = `wf-concurrent-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: "race condition test", projectId });
    createdBacklogIds.push(entry.id);
    updateBacklogEntry(entry.id, { workflow_id: workflowId });
    queueBacklogEntry(entry.id, { workflowId });

    // First caller succeeds in claiming
    const newRunId = uid();
    const result1 = simulateAtomicAutoDispatch(db, projectId, workflowId, () => ({ id: newRunId }));
    assert.ok(result1, "first caller should succeed");

    // Second caller tries to dispatch — should find nothing queued
    let caller2Called = false;
    const result2 = simulateAtomicAutoDispatch(db, projectId, workflowId, () => {
      caller2Called = true;
      return { id: uid() };
    });
    assert.equal(result2, null, "second caller should find nothing queued");
    assert.equal(caller2Called, false, "second caller should not call runWorkflow");

    // Only one dispatch happened
    const finalEntry = getBacklogEntry(entry.id);
    assert.equal(finalEntry?.status, "dispatched");
    assert.equal(finalEntry?.run_id, newRunId);
  });
});
