/**
 * US-001: DB migration — unique partial index on active dispatching per project+workflow
 *
 * Tests that the migrate() function in db.ts creates a unique index preventing
 * two backlog entries in the same project+workflow from being in 'dispatched'
 * status simultaneously.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/db.ts";
import crypto from "node:crypto";

function uid(): string {
  return crypto.randomUUID();
}

describe("US-001: DB migration — unique partial index on dispatched backlog entries", () => {
  test("index exists after migration", () => {
    const db = getDb();
    const idx = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_backlog_one_dispatched_per_project'"
    ).get() as { name: string } | undefined;
    assert.ok(idx, "index idx_backlog_one_dispatched_per_project should exist");
    assert.equal(idx!.name, "idx_backlog_one_dispatched_per_project");
  });

  test("migration is idempotent: running CREATE UNIQUE INDEX IF NOT EXISTS twice does not throw", () => {
    const db = getDb();
    assert.doesNotThrow(() => {
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_backlog_one_dispatched_per_project
        ON backlog (project_id, workflow_id)
        WHERE status = 'dispatched' AND project_id IS NOT NULL
      `);
    }, "second CREATE UNIQUE INDEX IF NOT EXISTS must not throw");
  });

  test("allows a single dispatched entry per project+workflow", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const projectId = `proj-${uid()}`;
    const workflowId = `wf-${uid()}`;
    const id1 = uid();

    db.exec(`
      INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
      VALUES ('${id1}', 'Entry 1', '${projectId}', '${workflowId}', 'dispatched', '${now}', '${now}')
    `);

    const row = db.prepare("SELECT id FROM backlog WHERE id = ?").get(id1) as { id: string } | undefined;
    assert.ok(row, "dispatched entry should be inserted");

    // Cleanup
    db.exec(`DELETE FROM backlog WHERE id = '${id1}'`);
  });

  test("rejects a second dispatched entry for same project+workflow (unique constraint violation)", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const projectId = `proj-${uid()}`;
    const workflowId = `wf-${uid()}`;
    const id1 = uid();
    const id2 = uid();

    db.exec(`
      INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
      VALUES ('${id1}', 'Entry 1', '${projectId}', '${workflowId}', 'dispatched', '${now}', '${now}')
    `);

    assert.throws(
      () => {
        db.exec(`
          INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
          VALUES ('${id2}', 'Entry 2', '${projectId}', '${workflowId}', 'dispatched', '${now}', '${now}')
        `);
      },
      /UNIQUE constraint failed/,
      "inserting a second dispatched entry for same project+workflow must throw UNIQUE constraint failed"
    );

    // Cleanup
    db.exec(`DELETE FROM backlog WHERE id = '${id1}'`);
  });

  test("allows two 'pending' entries for same project+workflow (index only covers dispatched)", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const projectId = `proj-${uid()}`;
    const workflowId = `wf-${uid()}`;
    const id1 = uid();
    const id2 = uid();

    assert.doesNotThrow(() => {
      db.exec(`
        INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
        VALUES ('${id1}', 'Entry 1', '${projectId}', '${workflowId}', 'pending', '${now}', '${now}')
      `);
      db.exec(`
        INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
        VALUES ('${id2}', 'Entry 2', '${projectId}', '${workflowId}', 'pending', '${now}', '${now}')
      `);
    }, "two 'pending' entries for same project+workflow must not throw");

    // Cleanup
    db.exec(`DELETE FROM backlog WHERE id IN ('${id1}', '${id2}')`);
  });

  test("allows two 'dispatched' entries when project_id is NULL (index only applies when project_id IS NOT NULL)", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const workflowId = `wf-${uid()}`;
    const id1 = uid();
    const id2 = uid();

    assert.doesNotThrow(() => {
      db.exec(`
        INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
        VALUES ('${id1}', 'Entry 1', NULL, '${workflowId}', 'dispatched', '${now}', '${now}')
      `);
      db.exec(`
        INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
        VALUES ('${id2}', 'Entry 2', NULL, '${workflowId}', 'dispatched', '${now}', '${now}')
      `);
    }, "two 'dispatched' entries with NULL project_id must not throw");

    // Cleanup
    db.exec(`DELETE FROM backlog WHERE id IN ('${id1}', '${id2}')`);
  });

  test("allows dispatched entries for different project+workflow combos", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const projectId1 = `proj-${uid()}`;
    const projectId2 = `proj-${uid()}`;
    const workflowId = `wf-${uid()}`;
    const id1 = uid();
    const id2 = uid();

    assert.doesNotThrow(() => {
      db.exec(`
        INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
        VALUES ('${id1}', 'Entry 1', '${projectId1}', '${workflowId}', 'dispatched', '${now}', '${now}')
      `);
      db.exec(`
        INSERT INTO backlog (id, title, project_id, workflow_id, status, created_at, updated_at)
        VALUES ('${id2}', 'Entry 2', '${projectId2}', '${workflowId}', 'dispatched', '${now}', '${now}')
      `);
    }, "dispatched entries for different projects must not throw");

    // Cleanup
    db.exec(`DELETE FROM backlog WHERE id IN ('${id1}', '${id2}')`);
  });
});
