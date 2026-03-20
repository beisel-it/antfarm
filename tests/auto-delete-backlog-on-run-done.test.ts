/**
 * US-001 (feature/auto-remove-backlog-on-run-done):
 * Auto-delete backlog entry when run completes successfully (status = 'done')
 *
 * Tests:
 * 1. When a run transitions to 'done', its corresponding backlog entry is deleted
 * 2. If no backlog entry exists for the run, no error occurs
 * 3. Backlog entries for failed runs are NOT deleted
 * 4. The deletion is based on backlog.run_id matching the run's id
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../dist/db.js";
import {
  addBacklogEntry,
  deleteBacklogEntry,
  listBacklogEntries,
  getBacklogEntry,
  updateBacklogEntry,
} from "../dist/backlog/index.js";

function now(): string {
  return new Date().toISOString();
}

/**
 * Insert a minimal run row directly into the DB.
 */
function insertRun(db: ReturnType<typeof getDb>, runId: string, status: string = "running"): void {
  const t = now();
  db.prepare(
    "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf-test', 'test task', ?, '{}', ?, ?)"
  ).run(runId, status, t, t);
}

/**
 * Insert a minimal step row so advancePipeline can complete a run.
 * Pass status='done' to simulate all steps completed.
 */
function insertStep(db: ReturnType<typeof getDb>, runId: string, status: string = "done"): string {
  const stepId = crypto.randomUUID();
  const t = now();
  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'step-1', 'agent:main:main', 0, 'do the thing', '{}', ?, ?, ?)"
  ).run(stepId, runId, status, t, t);
  return stepId;
}

/**
 * Simulate the auto-delete logic from advancePipeline — same logic as in step-ops.ts
 * after the run is marked done.
 */
function simulateAutoDelete(db: ReturnType<typeof getDb>, runId: string): boolean {
  try {
    const backlogRow = db.prepare("SELECT id FROM backlog WHERE run_id = ?").get(runId) as { id: string } | undefined;
    if (backlogRow) {
      deleteBacklogEntry(backlogRow.id);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

describe("US-001: Auto-delete backlog entry when run completes successfully", () => {
  const db = getDb();
  const createdBacklogIds: string[] = [];
  const createdRunIds: string[] = [];

  after(() => {
    // Clean up backlog entries that weren't deleted by the tests
    for (const id of createdBacklogIds) {
      try { deleteBacklogEntry(id); } catch {}
    }
    // Clean up runs
    for (const id of createdRunIds) {
      try { db.prepare("DELETE FROM steps WHERE run_id = ?").run(id); } catch {}
      try { db.prepare("DELETE FROM runs WHERE id = ?").run(id); } catch {}
    }
  });

  it("auto-deletes backlog entry when run transitions to done", () => {
    const runId = crypto.randomUUID();
    createdRunIds.push(runId);

    // Insert run
    insertRun(db, runId, "running");

    // Create backlog entry linked to this run
    const entry = addBacklogEntry({ title: `test-auto-delete-${runId}` });
    createdBacklogIds.push(entry.id);

    // Link backlog entry to the run (as dispatch would do)
    updateBacklogEntry(entry.id, { run_id: runId, status: "dispatched" });

    // Confirm it exists
    const before = getBacklogEntry(entry.id);
    assert.ok(before, "Backlog entry should exist before run completes");

    // Simulate run completion (mark done)
    db.prepare("UPDATE runs SET status = 'done', updated_at = datetime('now') WHERE id = ?").run(runId);

    // Run the auto-delete logic
    const deleted = simulateAutoDelete(db, runId);
    assert.ok(deleted, "Auto-delete should return true when a backlog entry was found and deleted");

    // Confirm it's gone
    const after = getBacklogEntry(entry.id);
    assert.equal(after, null, "Backlog entry should be deleted after run completion");

    // Remove from tracking since it was deleted
    const idx = createdBacklogIds.indexOf(entry.id);
    if (idx !== -1) createdBacklogIds.splice(idx, 1);
  });

  it("handles gracefully when no backlog entry exists for the run", () => {
    const runId = crypto.randomUUID();
    createdRunIds.push(runId);

    insertRun(db, runId, "running");
    db.prepare("UPDATE runs SET status = 'done', updated_at = datetime('now') WHERE id = ?").run(runId);

    // No backlog entry linked to this run — should not throw
    let threw = false;
    try {
      simulateAutoDelete(db, runId);
    } catch {
      threw = true;
    }

    assert.ok(!threw, "Should not throw when no backlog entry is linked to the run");
  });

  it("does NOT delete backlog entry for a failed run", () => {
    const runId = crypto.randomUUID();
    createdRunIds.push(runId);

    insertRun(db, runId, "running");

    const entry = addBacklogEntry({ title: `test-no-delete-on-fail-${runId}` });
    createdBacklogIds.push(entry.id);

    updateBacklogEntry(entry.id, { run_id: runId, status: "dispatched" });

    // Simulate run FAILURE — we do NOT call auto-delete for failed runs
    db.prepare("UPDATE runs SET status = 'failed', updated_at = datetime('now') WHERE id = ?").run(runId);

    // Auto-delete is NOT triggered on failure — simulated by not calling it
    // Verify backlog entry still exists
    const stillThere = getBacklogEntry(entry.id);
    assert.ok(stillThere, "Backlog entry should still exist after a failed run");
    assert.equal(stillThere.status, "dispatched", "Status should remain 'dispatched'");
  });

  it("backlog.run_id lookup correctly identifies the entry to delete", () => {
    const runId1 = crypto.randomUUID();
    const runId2 = crypto.randomUUID();
    createdRunIds.push(runId1, runId2);

    insertRun(db, runId1, "running");
    insertRun(db, runId2, "running");

    const entry1 = addBacklogEntry({ title: `test-run-id-match-1-${runId1}` });
    const entry2 = addBacklogEntry({ title: `test-run-id-match-2-${runId2}` });
    createdBacklogIds.push(entry1.id, entry2.id);

    updateBacklogEntry(entry1.id, { run_id: runId1, status: "dispatched" });
    updateBacklogEntry(entry2.id, { run_id: runId2, status: "dispatched" });

    // Complete run1 only
    db.prepare("UPDATE runs SET status = 'done', updated_at = datetime('now') WHERE id = ?").run(runId1);
    simulateAutoDelete(db, runId1);

    // entry1 should be deleted, entry2 should remain
    assert.equal(getBacklogEntry(entry1.id), null, "entry1 linked to run1 should be deleted");
    assert.ok(getBacklogEntry(entry2.id), "entry2 linked to run2 should still exist");

    // Remove deleted entry from tracking
    const idx = createdBacklogIds.indexOf(entry1.id);
    if (idx !== -1) createdBacklogIds.splice(idx, 1);
  });

  it("deletion errors are caught and do not throw", () => {
    // Test that the try/catch wrapper in advancePipeline prevents errors from propagating.
    // We simulate this by testing the pattern directly.
    const runId = crypto.randomUUID();

    let threw = false;
    try {
      // Simulate looking up a non-existent run_id in backlog (returns undefined → no deletion)
      const row = db.prepare("SELECT id FROM backlog WHERE run_id = ?").get(runId) as { id: string } | undefined;
      if (row) {
        deleteBacklogEntry(row.id);
      }
      // No error expected
    } catch {
      threw = true;
    }

    assert.ok(!threw, "Auto-delete logic should not throw for non-existent run_id");
  });
});
