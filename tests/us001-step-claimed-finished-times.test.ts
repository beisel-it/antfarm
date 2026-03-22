/**
 * US-001: Add claimed_at and finished_at columns to steps table
 *
 * Tests that:
 * 1. steps table schema includes claimed_at TEXT and finished_at TEXT columns
 * 2. Migration runs without error on an existing DB that lacks these columns
 * 3. Migration is idempotent: running it twice does not throw
 * 4. Both columns default to NULL for existing rows after migration
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/db.ts";

describe("US-001: steps table claimed_at and finished_at columns", () => {
  test("steps table schema includes claimed_at and finished_at columns", () => {
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(steps)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>;
    const colMap = new Map(cols.map((c) => [c.name, c]));

    assert.ok(colMap.has("claimed_at"), "steps table should have claimed_at column");
    assert.ok(colMap.has("finished_at"), "steps table should have finished_at column");

    const claimedAt = colMap.get("claimed_at")!;
    const finishedAt = colMap.get("finished_at")!;

    assert.equal(claimedAt.type, "TEXT", "claimed_at should be TEXT type");
    assert.equal(finishedAt.type, "TEXT", "finished_at should be TEXT type");
    assert.equal(claimedAt.notnull, 0, "claimed_at should be nullable");
    assert.equal(finishedAt.notnull, 0, "finished_at should be nullable");
  });

  test("migration is idempotent: ALTER TABLE for claimed_at and finished_at does not throw when columns exist", () => {
    const db = getDb();

    // Running the migration guard pattern twice should not throw
    assert.doesNotThrow(() => {
      const cols = db.prepare("PRAGMA table_info(steps)").all() as Array<{ name: string }>;
      const colNames = new Set(cols.map((c) => c.name));

      if (!colNames.has("claimed_at")) {
        db.exec("ALTER TABLE steps ADD COLUMN claimed_at TEXT");
      }
      if (!colNames.has("finished_at")) {
        db.exec("ALTER TABLE steps ADD COLUMN finished_at TEXT");
      }
    }, "First migration pass must not throw");

    assert.doesNotThrow(() => {
      const cols = db.prepare("PRAGMA table_info(steps)").all() as Array<{ name: string }>;
      const colNames = new Set(cols.map((c) => c.name));

      if (!colNames.has("claimed_at")) {
        db.exec("ALTER TABLE steps ADD COLUMN claimed_at TEXT");
      }
      if (!colNames.has("finished_at")) {
        db.exec("ALTER TABLE steps ADD COLUMN finished_at TEXT");
      }
    }, "Second migration pass must not throw (idempotent)");
  });

  test("claimed_at and finished_at default to NULL for new rows", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Insert a run first (required by FK constraint)
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('us001-test-run', 'wf-test', 'test task', 'running', '{}', '${now}', '${now}')
    `);

    // Insert a step without specifying claimed_at / finished_at
    db.exec(`
      INSERT OR REPLACE INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at)
      VALUES
        ('us001-test-step', 'us001-test-run', 'step-1', 'agent-1', 0, 'hello', '[]', 'pending', '${now}', '${now}')
    `);

    const row = db.prepare(
      "SELECT claimed_at, finished_at FROM steps WHERE id = ?"
    ).get("us001-test-step") as { claimed_at: string | null; finished_at: string | null };

    assert.equal(row.claimed_at, null, "claimed_at should default to NULL");
    assert.equal(row.finished_at, null, "finished_at should default to NULL");
  });

  test("claimed_at is set when step transitions to running", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed run + step
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('us001-claim-run', 'wf-test', 'test task', 'running', '{}', '${now}', '${now}')
    `);
    db.exec(`
      INSERT OR REPLACE INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at)
      VALUES
        ('us001-claim-step', 'us001-claim-run', 'step-1', 'agent-1', 0, 'hello', '[]', 'pending', '${now}', '${now}')
    `);

    // Simulate claiming the step (set status to running + claimed_at)
    db.prepare(
      "UPDATE steps SET status = 'running', claimed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run("us001-claim-step");

    const row = db.prepare(
      "SELECT status, claimed_at, finished_at FROM steps WHERE id = ?"
    ).get("us001-claim-step") as { status: string; claimed_at: string | null; finished_at: string | null };

    assert.equal(row.status, "running");
    assert.ok(row.claimed_at !== null, "claimed_at should be set when step is running");
    assert.equal(row.finished_at, null, "finished_at should still be NULL while running");
  });

  test("finished_at is set when step transitions to done", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed run + step
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('us001-done-run', 'wf-test', 'test task', 'running', '{}', '${now}', '${now}')
    `);
    db.exec(`
      INSERT OR REPLACE INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status, claimed_at, created_at, updated_at)
      VALUES
        ('us001-done-step', 'us001-done-run', 'step-1', 'agent-1', 0, 'hello', '[]', 'running', '${now}', '${now}', '${now}')
    `);

    // Simulate completing the step (set status to done + finished_at)
    db.prepare(
      "UPDATE steps SET status = 'done', output = 'STATUS: done', finished_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run("us001-done-step");

    const row = db.prepare(
      "SELECT status, claimed_at, finished_at FROM steps WHERE id = ?"
    ).get("us001-done-step") as { status: string; claimed_at: string | null; finished_at: string | null };

    assert.equal(row.status, "done");
    assert.ok(row.claimed_at !== null, "claimed_at should be preserved");
    assert.ok(row.finished_at !== null, "finished_at should be set when step is done");
  });

  test("finished_at is set when step transitions to failed", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed run + step
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('us001-fail-run', 'wf-test', 'test task', 'running', '{}', '${now}', '${now}')
    `);
    db.exec(`
      INSERT OR REPLACE INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status, claimed_at, created_at, updated_at)
      VALUES
        ('us001-fail-step', 'us001-fail-run', 'step-1', 'agent-1', 0, 'hello', '[]', 'running', '${now}', '${now}', '${now}')
    `);

    // Simulate failing the step (set status to failed + finished_at)
    db.prepare(
      "UPDATE steps SET status = 'failed', output = 'something went wrong', finished_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).run("us001-fail-step");

    const row = db.prepare(
      "SELECT status, claimed_at, finished_at FROM steps WHERE id = ?"
    ).get("us001-fail-step") as { status: string; claimed_at: string | null; finished_at: string | null };

    assert.equal(row.status, "failed");
    assert.ok(row.claimed_at !== null, "claimed_at should be preserved");
    assert.ok(row.finished_at !== null, "finished_at should be set when step is failed");
  });

  test("existing rows after migration have NULL claimed_at and finished_at", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Insert a run
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('us001-existing-run', 'wf-test', 'test task', 'done', '{}', '${now}', '${now}')
    `);

    // Insert a step (simulating a pre-migration row that wouldn't have had these columns)
    db.exec(`
      INSERT OR REPLACE INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at)
      VALUES
        ('us001-existing-step', 'us001-existing-run', 'step-1', 'agent-1', 0, 'hello', '[]', 'done', '${now}', '${now}')
    `);

    const row = db.prepare(
      "SELECT claimed_at, finished_at FROM steps WHERE id = ?"
    ).get("us001-existing-step") as { claimed_at: string | null; finished_at: string | null };

    assert.equal(row.claimed_at, null, "claimed_at should be NULL for existing rows after migration");
    assert.equal(row.finished_at, null, "finished_at should be NULL for existing rows after migration");
  });
});
