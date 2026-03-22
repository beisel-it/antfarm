import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Tests import from dist/ - must build first
import { addBacklogEntry, updateBacklogEntry, queueBacklogEntry, getNextQueuedEntry, cancelQueuedEntry } from "../dist/backlog/index.js";

describe("queueBacklogEntry", () => {
  test("sets status to queued, assigns queue_order, sets workflow_id", () => {
    const entry = addBacklogEntry({ title: "Queue me", projectId: "proj-1" });
    const queued = queueBacklogEntry(entry.id, { workflowId: "wf-1" });

    assert.equal(queued.status, "queued");
    assert.equal(queued.workflow_id, "wf-1");
    assert.ok(queued.queue_order !== null, "queue_order should be set");
    assert.equal(queued.id, entry.id);
  });

  test("throws if entry does not exist", () => {
    assert.throws(
      () => queueBacklogEntry("non-existent-id", { workflowId: "wf-1" }),
      /not found/i
    );
  });

  test("throws if entry is already dispatched", () => {
    const entry = addBacklogEntry({ title: "Dispatched entry", projectId: "proj-dispatch" });
    updateBacklogEntry(entry.id, { status: "dispatched" });

    assert.throws(
      () => queueBacklogEntry(entry.id, { workflowId: "wf-1" }),
      /dispatched/i
    );
  });

  test("multiple entries get sequential queue_order values", () => {
    const e1 = addBacklogEntry({ title: "Entry 1", projectId: "proj-seq" });
    const e2 = addBacklogEntry({ title: "Entry 2", projectId: "proj-seq" });
    const e3 = addBacklogEntry({ title: "Entry 3", projectId: "proj-seq" });

    const q1 = queueBacklogEntry(e1.id, { workflowId: "wf-seq" });
    const q2 = queueBacklogEntry(e2.id, { workflowId: "wf-seq" });
    const q3 = queueBacklogEntry(e3.id, { workflowId: "wf-seq" });

    assert.ok(q1.queue_order! < q2.queue_order!, "q1 should have lower order than q2");
    assert.ok(q2.queue_order! < q3.queue_order!, "q2 should have lower order than q3");
  });

  test("queue_order is scoped to project+workflow (different projects don't interfere)", () => {
    const e1 = addBacklogEntry({ title: "Proj A entry", projectId: "proj-a" });
    const e2 = addBacklogEntry({ title: "Proj B entry", projectId: "proj-b" });

    const q1 = queueBacklogEntry(e1.id, { workflowId: "wf-scope" });
    const q2 = queueBacklogEntry(e2.id, { workflowId: "wf-scope" });

    // Both should get queue_order = 1 since they're in different projects
    assert.equal(q1.queue_order, 1);
    assert.equal(q2.queue_order, 1);
  });
});

describe("getNextQueuedEntry", () => {
  test("returns null when no queued entries exist", () => {
    const result = getNextQueuedEntry("proj-empty-xyz", "wf-empty-xyz");
    assert.equal(result, null);
  });

  test("returns the entry with the lowest queue_order", () => {
    const e1 = addBacklogEntry({ title: "First queued", projectId: "proj-next" });
    const e2 = addBacklogEntry({ title: "Second queued", projectId: "proj-next" });
    const e3 = addBacklogEntry({ title: "Third queued", projectId: "proj-next" });

    queueBacklogEntry(e1.id, { workflowId: "wf-next" });
    queueBacklogEntry(e2.id, { workflowId: "wf-next" });
    queueBacklogEntry(e3.id, { workflowId: "wf-next" });

    const next = getNextQueuedEntry("proj-next", "wf-next");
    assert.ok(next !== null, "should return an entry");
    assert.equal(next.id, e1.id, "should return the first queued entry");
  });

  test("only returns entries for matching project+workflow", () => {
    const e1 = addBacklogEntry({ title: "Match", projectId: "proj-match" });
    const e2 = addBacklogEntry({ title: "Other project", projectId: "proj-other-match" });

    queueBacklogEntry(e1.id, { workflowId: "wf-match" });
    queueBacklogEntry(e2.id, { workflowId: "wf-match" });

    const next = getNextQueuedEntry("proj-match", "wf-match");
    assert.ok(next !== null, "should return an entry");
    assert.equal(next.id, e1.id, "should return only proj-match entry");
    assert.equal(next.project_id, "proj-match");
  });

  test("returns null after all entries are dequeued", () => {
    const e1 = addBacklogEntry({ title: "Only entry", projectId: "proj-dequeue" });
    queueBacklogEntry(e1.id, { workflowId: "wf-dequeue" });

    cancelQueuedEntry(e1.id);

    const next = getNextQueuedEntry("proj-dequeue", "wf-dequeue");
    assert.equal(next, null);
  });
});

describe("cancelQueuedEntry", () => {
  test("resets status to pending and sets queue_order to null", () => {
    const entry = addBacklogEntry({ title: "Cancel me", projectId: "proj-cancel" });
    queueBacklogEntry(entry.id, { workflowId: "wf-cancel" });

    const cancelled = cancelQueuedEntry(entry.id);
    assert.ok(cancelled !== null, "should return the entry");
    assert.equal(cancelled!.status, "pending");
    assert.equal(cancelled!.queue_order, null);
  });

  test("returns null for non-existent entry", () => {
    const result = cancelQueuedEntry("non-existent-cancel-id");
    assert.equal(result, null);
  });
});
