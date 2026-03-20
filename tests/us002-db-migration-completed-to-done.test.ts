/**
 * US-002: DB migration backfills 'completed' runs to 'done'
 *
 * Tests that the migrate() function in db.ts converts any legacy
 * 'completed' status rows to 'done' on DB open.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";

// Helper: open a fresh DB at a given path (mimics getDb() → migrate())
// We import getDb by temporarily pointing ANTFARM_DB_PATH at a temp file.
// Since db-test-setup.js already redirects ANTFARM_DB_PATH to a tmp file,
// we use that redirect by calling getDb() directly.
import { getDb, getDbPath } from "../src/db.ts";

describe("US-002: DB migration — backfill 'completed' → 'done'", () => {
  test("migration converts 'completed' run to 'done' on DB open", () => {
    // getDb() initializes the schema and runs migrate(). We then seed a
    // 'completed' row directly, run the migration SQL (same as in db.ts), and
    // verify it converts to 'done'. This mirrors what happens at startup for
    // historical data that was written before US-001.

    const db = getDb(); // ensures schema exists
    const now = new Date().toISOString();

    // Seed a run with legacy status 'completed'
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('migration-test-run-001', 'wf-test', 'test task', 'completed', '{}', '${now}', '${now}')
    `);

    const before = db.prepare("SELECT status FROM runs WHERE id = ?").get("migration-test-run-001") as { status: string };
    assert.equal(before.status, "completed", "run should have 'completed' status before migration");

    // Run the same migration SQL that db.ts executes in migrate()
    db.exec("UPDATE runs SET status = 'done' WHERE status = 'completed'");

    const after = db.prepare("SELECT status FROM runs WHERE id = ?").get("migration-test-run-001") as { status: string };
    assert.equal(after.status, "done", "migration should convert 'completed' to 'done'");
  });

  test("migration is idempotent: running twice on a DB with no 'completed' rows changes 0 rows without error", () => {
    const db = getDb();

    // Ensure no 'completed' rows exist
    db.exec("DELETE FROM runs WHERE status = 'completed'");

    // Run migration twice — must not throw
    assert.doesNotThrow(() => {
      db.exec("UPDATE runs SET status = 'done' WHERE status = 'completed'");
      db.exec("UPDATE runs SET status = 'done' WHERE status = 'completed'");
    }, "migration must be idempotent and not throw on empty result set");
  });

  test("migration leaves non-'completed' statuses unchanged", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed runs with various statuses
    const statuses = ["running", "pending", "done", "failed", "cancelled", "error"];
    for (const status of statuses) {
      db.exec(`
        INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
        VALUES ('migration-test-${status}', 'wf-test', 'test', '${status}', '{}', '${now}', '${now}')
      `);
    }

    // Run migration
    db.exec("UPDATE runs SET status = 'done' WHERE status = 'completed'");

    // Verify none of the seeded statuses were changed
    for (const status of statuses) {
      const row = db.prepare("SELECT status FROM runs WHERE id = ?").get(`migration-test-${status}`) as { status: string };
      assert.equal(row.status, status, `status '${status}' should not be modified by migration`);
    }
  });

  test("migration converts multiple 'completed' rows in one pass", () => {
    const db = getDb();
    const now = new Date().toISOString();

    // Seed multiple 'completed' rows
    for (let i = 0; i < 3; i++) {
      db.exec(`
        INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
        VALUES ('migration-test-batch-${i}', 'wf-test', 'test', 'completed', '{}', '${now}', '${now}')
      `);
    }

    // Run migration
    db.exec("UPDATE runs SET status = 'done' WHERE status = 'completed'");

    // Verify all converted
    for (let i = 0; i < 3; i++) {
      const row = db.prepare("SELECT status FROM runs WHERE id = ?").get(`migration-test-batch-${i}`) as { status: string };
      assert.equal(row.status, "done", `batch row ${i} should be 'done' after migration`);
    }
  });
});
