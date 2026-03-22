import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/db.ts";

describe("US-007: stories table claimed_at and finished_at schema", () => {
  test("stories table has claimed_at column", () => {
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(stories)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>;
    const col = cols.find((c) => c.name === "claimed_at");
    assert.ok(col, "claimed_at column should exist on stories table");
    assert.equal(col.type, "TEXT");
    assert.equal(col.notnull, 0, "claimed_at should be nullable");
  });

  test("stories table has finished_at column", () => {
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(stories)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null }>;
    const col = cols.find((c) => c.name === "finished_at");
    assert.ok(col, "finished_at column should exist on stories table");
    assert.equal(col.type, "TEXT");
    assert.equal(col.notnull, 0, "finished_at should be nullable");
  });

  test("newly inserted story has claimed_at and finished_at as NULL", () => {
    const db = getDb();
    const id = `test-story-${Date.now()}`;
    const runId = `test-run-${Date.now()}`;

    // Insert a run first (required by FK)
    db.prepare(`
      INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES (?, 'wf-test', 'test task', 'running', '{}', datetime('now'), datetime('now'))
    `).run(runId);

    // Insert a story
    db.prepare(`
      INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, created_at, updated_at)
      VALUES (?, ?, 0, 's-001', 'Test Story', 'A test story', '[]', 'pending', datetime('now'), datetime('now'))
    `).run(id, runId);

    const row = db.prepare("SELECT claimed_at, finished_at FROM stories WHERE id = ?").get(id) as { claimed_at: string | null; finished_at: string | null };
    assert.equal(row.claimed_at, null, "claimed_at should default to NULL");
    assert.equal(row.finished_at, null, "finished_at should default to NULL");
  });

  test("migration is idempotent: calling getDb() multiple times does not error", () => {
    // getDb() calls migrate() internally; calling it multiple times should be safe
    assert.doesNotThrow(() => {
      getDb();
      getDb();
      getDb();
    });
  });
});
