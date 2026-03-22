/**
 * US-008: Integration test: full queue-to-auto-dispatch lifecycle
 *
 * End-to-end integration test that validates the full queue lifecycle:
 * 1. Create a project and two backlog entries
 * 2. Dispatch entry1 → entry1 is 'dispatched', run_id set
 * 3. Queue entry2 → entry2 status='queued', queue_order=1
 * 4. Simulate run completion for entry1's run (via auto-dispatch hook)
 * 5. Verify entry2 is now 'dispatched' with a new run_id
 * 6. Verify no more queued entries remain for that project+workflow
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../dist/db.js";
import {
  addBacklogEntry,
  getBacklogEntry,
  updateBacklogEntry,
  queueBacklogEntry,
  getNextQueuedEntry,
} from "../dist/backlog/index.js";

function now(): string {
  return new Date().toISOString();
}

/**
 * Insert a project row for testing.
 */
function insertProject(db: ReturnType<typeof getDb>, name?: string): string {
  const projectId = crypto.randomUUID();
  const t = now();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(projectId, name ?? `project-${projectId.slice(0, 8)}`, t, t);
  return projectId;
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
    opts.workflowId ?? "wf-lifecycle-test",
    opts.task ?? "test task",
    opts.status ?? "running",
    opts.projectId ?? null,
    t,
    t
  );
  return id;
}

/**
 * Simulate the auto-dispatch logic from advancePipeline.
 * This mirrors what happens inside step-ops.ts when a run completes.
 * Returns the new run id if dispatched, null otherwise.
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

describe("US-008: Full queue-to-auto-dispatch lifecycle integration test", () => {
  const db = getDb();
  const createdBacklogIds: string[] = [];
  const createdRunIds: string[] = [];
  const createdProjectIds: string[] = [];

  after(() => {
    // Cleanup
    for (const id of createdBacklogIds) {
      try { db.prepare("DELETE FROM backlog WHERE id = ?").run(id); } catch {}
    }
    for (const id of createdRunIds) {
      try { db.prepare("DELETE FROM runs WHERE id = ?").run(id); } catch {}
    }
    for (const id of createdProjectIds) {
      try { db.prepare("DELETE FROM projects WHERE id = ?").run(id); } catch {}
    }
  });

  it("full lifecycle: queue item auto-dispatches after active run completes", () => {
    // Step 1: Create project and workflow id
    const projectId = insertProject(db, "Lifecycle Test Project");
    createdProjectIds.push(projectId);
    const workflowId = `wf-lifecycle-${crypto.randomUUID().slice(0, 8)}`;

    // Step 2: Create two backlog entries
    const entry1 = addBacklogEntry({
      title: "Active task",
      projectId,
    });
    const entry2 = addBacklogEntry({
      title: "Queued task",
      projectId,
    });
    createdBacklogIds.push(entry1.id, entry2.id);

    // Step 3: Dispatch entry1 — simulate it being dispatched (mock runWorkflow)
    const run1Id = insertRun(db, {
      workflowId,
      projectId,
      status: "running",
      task: "Active task",
    });
    createdRunIds.push(run1Id);

    // Mark entry1 as dispatched with run1Id
    updateBacklogEntry(entry1.id, {
      status: "dispatched",
      run_id: run1Id,
      workflow_id: workflowId,
    });

    const dispatched1 = getBacklogEntry(entry1.id);
    assert.equal(dispatched1?.status, "dispatched", "entry1 should be dispatched");
    assert.equal(dispatched1?.run_id, run1Id, "entry1 should have run1Id");

    // Step 4: Queue entry2 (cannot dispatch because a run is in flight)
    queueBacklogEntry(entry2.id, { workflowId });

    const queued2 = getBacklogEntry(entry2.id);
    assert.equal(queued2?.status, "queued", "entry2 should be queued");
    assert.equal(queued2?.queue_order, 1, "entry2 queue_order should be 1");
    assert.equal(queued2?.workflow_id, workflowId, "entry2 should have workflowId set");

    // Step 5: Verify the queue has one entry
    const nextInQueue = getNextQueuedEntry(projectId, workflowId);
    assert.notEqual(nextInQueue, null, "queue should have entry2");
    assert.equal(nextInQueue?.id, entry2.id, "next queued entry should be entry2");

    // Step 6: Simulate run1 completing — triggers auto-dispatch
    // Mark run1 as done
    db.prepare("UPDATE runs SET status = 'done', updated_at = ? WHERE id = ?").run(now(), run1Id);

    // Auto-dispatch logic fires — mock runWorkflow to create a new run
    const run2Id = crypto.randomUUID();
    createdRunIds.push(run2Id);

    // Simulate inserting the new run (what runWorkflow would do)
    insertRun(db, {
      id: run2Id,
      workflowId,
      projectId,
      status: "running",
      task: "Queued task",
    });

    const newRunId = simulateAutoDispatch(db, run1Id, () => ({ id: run2Id }));

    assert.equal(newRunId, run2Id, "simulateAutoDispatch should return new run id");

    // Step 7: Verify entry2 is now dispatched with new run_id
    const dispatched2 = getBacklogEntry(entry2.id);
    assert.equal(dispatched2?.status, "dispatched", "entry2 should now be dispatched");
    assert.equal(dispatched2?.run_id, run2Id, "entry2 should point to the new run");
    assert.equal(dispatched2?.queue_order, null, "entry2 queue_order should be null after dispatch");

    // Step 8: Verify queue is empty (no more queued entries for this project+workflow)
    const emptyQueue = getNextQueuedEntry(projectId, workflowId);
    assert.equal(emptyQueue, null, "queue should be empty after auto-dispatch");
  });

  it("queue maintains FIFO order when multiple items are queued", () => {
    const projectId = insertProject(db, "FIFO Order Project");
    createdProjectIds.push(projectId);
    const workflowId = `wf-fifo-${crypto.randomUUID().slice(0, 8)}`;

    // Create active run and three queued entries
    const activeRunId = insertRun(db, { workflowId, projectId, status: "running" });
    createdRunIds.push(activeRunId);

    const first = addBacklogEntry({ title: "First queued", projectId });
    const second = addBacklogEntry({ title: "Second queued", projectId });
    const third = addBacklogEntry({ title: "Third queued", projectId });
    createdBacklogIds.push(first.id, second.id, third.id);

    // Queue all three
    queueBacklogEntry(first.id, { workflowId });
    queueBacklogEntry(second.id, { workflowId });
    queueBacklogEntry(third.id, { workflowId });

    // Verify queue orders
    const q1 = getBacklogEntry(first.id);
    const q2 = getBacklogEntry(second.id);
    const q3 = getBacklogEntry(third.id);
    assert.equal(q1?.queue_order, 1, "first entry should have queue_order=1");
    assert.equal(q2?.queue_order, 2, "second entry should have queue_order=2");
    assert.equal(q3?.queue_order, 3, "third entry should have queue_order=3");

    // Simulate first run completion — dispatches 'first'
    db.prepare("UPDATE runs SET status = 'done', updated_at = ? WHERE id = ?").run(now(), activeRunId);
    const run2Id = crypto.randomUUID();
    createdRunIds.push(run2Id);
    insertRun(db, { id: run2Id, workflowId, projectId, status: "running" });

    const dispatched1Id = simulateAutoDispatch(db, activeRunId, () => ({ id: run2Id }));
    assert.equal(dispatched1Id, run2Id);

    const dispatchedFirst = getBacklogEntry(first.id);
    assert.equal(dispatchedFirst?.status, "dispatched", "first entry should be dispatched");

    // Queue should still have second and third
    const nextAfterFirst = getNextQueuedEntry(projectId, workflowId);
    assert.equal(nextAfterFirst?.id, second.id, "second entry should be next in queue");

    // Simulate second run completion — dispatches 'second'
    db.prepare("UPDATE runs SET status = 'done', updated_at = ? WHERE id = ?").run(now(), run2Id);
    const run3Id = crypto.randomUUID();
    createdRunIds.push(run3Id);
    insertRun(db, { id: run3Id, workflowId, projectId, status: "running" });

    const dispatched2Id = simulateAutoDispatch(db, run2Id, () => ({ id: run3Id }));
    assert.equal(dispatched2Id, run3Id);

    const dispatchedSecond = getBacklogEntry(second.id);
    assert.equal(dispatchedSecond?.status, "dispatched", "second entry should be dispatched");

    // Queue should only have third
    const nextAfterSecond = getNextQueuedEntry(projectId, workflowId);
    assert.equal(nextAfterSecond?.id, third.id, "third entry should be next in queue");

    // Simulate third run completion — dispatches 'third'
    db.prepare("UPDATE runs SET status = 'done', updated_at = ? WHERE id = ?").run(now(), run3Id);
    const run4Id = crypto.randomUUID();
    createdRunIds.push(run4Id);
    insertRun(db, { id: run4Id, workflowId, projectId, status: "running" });

    const dispatched3Id = simulateAutoDispatch(db, run3Id, () => ({ id: run4Id }));
    assert.equal(dispatched3Id, run4Id);

    const dispatchedThird = getBacklogEntry(third.id);
    assert.equal(dispatchedThird?.status, "dispatched", "third entry should be dispatched");

    // Queue is now empty
    const emptyQueue = getNextQueuedEntry(projectId, workflowId);
    assert.equal(emptyQueue, null, "queue should be empty after all entries dispatched");
  });

  it("queue is project+workflow scoped — completing a run in one project does not affect another", () => {
    const projectA = insertProject(db, "Project Alpha");
    const projectB = insertProject(db, "Project Beta");
    createdProjectIds.push(projectA, projectB);
    const workflowId = `wf-scope-${crypto.randomUUID().slice(0, 8)}`;

    // Dispatch a run for project A
    const runA = insertRun(db, { workflowId, projectId: projectA, status: "running" });
    createdRunIds.push(runA);

    // Queue an entry for project B (different project, same workflow)
    const entryB = addBacklogEntry({ title: "Project B queued task", projectId: projectB });
    createdBacklogIds.push(entryB.id);
    queueBacklogEntry(entryB.id, { workflowId });

    const queuedB = getBacklogEntry(entryB.id);
    assert.equal(queuedB?.status, "queued", "entryB should be queued");

    // Simulate run A completing — should NOT dispatch entryB (different project)
    db.prepare("UPDATE runs SET status = 'done', updated_at = ? WHERE id = ?").run(now(), runA);

    let dispatchCalled = false;
    const result = simulateAutoDispatch(db, runA, () => {
      dispatchCalled = true;
      return { id: crypto.randomUUID() };
    });

    assert.equal(result, null, "should not dispatch for a different project");
    assert.equal(dispatchCalled, false, "runWorkflow should not be called for mismatched project");

    // entryB should still be queued
    const stillQueued = getBacklogEntry(entryB.id);
    assert.equal(stillQueued?.status, "queued", "entryB should still be queued");
  });

  it("completing a run for a project with no queued entries does nothing", () => {
    const projectId = insertProject(db, "Empty Queue Project");
    createdProjectIds.push(projectId);
    const workflowId = `wf-noqueue-${crypto.randomUUID().slice(0, 8)}`;

    // Create a run that completes
    const runId = insertRun(db, { workflowId, projectId, status: "done" });
    createdRunIds.push(runId);

    // Ensure no queued entries
    const emptyBefore = getNextQueuedEntry(projectId, workflowId);
    assert.equal(emptyBefore, null, "no queued entries before completion");

    // Simulate auto-dispatch with no queued entries
    let dispatchCalled = false;
    const result = simulateAutoDispatch(db, runId, () => {
      dispatchCalled = true;
      return { id: crypto.randomUUID() };
    });

    assert.equal(result, null, "should return null when queue is empty");
    assert.equal(dispatchCalled, false, "runWorkflow should not be called when queue is empty");

    // Queue still empty
    const emptyAfter = getNextQueuedEntry(projectId, workflowId);
    assert.equal(emptyAfter, null, "queue should remain empty");
  });
});
