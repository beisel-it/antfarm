/**
 * Tests for US-001: backlog table migration and BacklogEntry type.
 * Runs against the built dist/ (node:sqlite via getDb/getBacklog).
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distDb = path.resolve(import.meta.dirname, "..", "dist", "db.js");

const { getDb, getBacklog } = await import(distDb) as {
  getDb: () => import("node:sqlite").DatabaseSync;
  getBacklog: () => Array<{
    id: string;
    title: string;
    description: string | null;
    workflow_id: string | null;
    status: string;
    priority: number;
    created_at: string;
    updated_at: string;
  }>;
};

describe("US-001: backlog table migration", () => {
  const prefix = `test-us001-${Date.now()}`;

  after(() => {
    const db = getDb();
    db.prepare("DELETE FROM backlog WHERE id LIKE ?").run(`${prefix}%`);
  });

  it("creates backlog table in the database", () => {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='backlog'"
    ).all() as Array<{ name: string }>;
    assert.equal(tables.length, 1, "backlog table should exist");
    assert.equal(tables[0].name, "backlog");
  });

  it("has correct columns: id, title, description, workflow_id, status, priority, created_at, updated_at", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;
    const colMap = new Map(columns.map(c => [c.name, c]));

    // id: TEXT PRIMARY KEY
    assert.ok(colMap.has("id"), "id column exists");
    assert.equal(colMap.get("id")!.type, "TEXT");
    assert.equal(colMap.get("id")!.pk, 1);

    // title: TEXT NOT NULL
    assert.ok(colMap.has("title"), "title column exists");
    assert.equal(colMap.get("title")!.type, "TEXT");
    assert.equal(colMap.get("title")!.notnull, 1);

    // description: TEXT nullable
    assert.ok(colMap.has("description"), "description column exists");
    assert.equal(colMap.get("description")!.type, "TEXT");
    assert.equal(colMap.get("description")!.notnull, 0);

    // workflow_id: TEXT nullable
    assert.ok(colMap.has("workflow_id"), "workflow_id column exists");
    assert.equal(colMap.get("workflow_id")!.type, "TEXT");
    assert.equal(colMap.get("workflow_id")!.notnull, 0);

    // status: TEXT DEFAULT 'pending'
    assert.ok(colMap.has("status"), "status column exists");
    assert.equal(colMap.get("status")!.type, "TEXT");
    assert.equal(colMap.get("status")!.dflt_value, "'pending'");

    // priority: INTEGER DEFAULT 0
    assert.ok(colMap.has("priority"), "priority column exists");
    assert.equal(colMap.get("priority")!.type, "INTEGER");
    assert.equal(colMap.get("priority")!.dflt_value, "0");

    // created_at: TEXT NOT NULL
    assert.ok(colMap.has("created_at"), "created_at column exists");
    assert.equal(colMap.get("created_at")!.type, "TEXT");
    assert.equal(colMap.get("created_at")!.notnull, 1);

    // updated_at: TEXT NOT NULL
    assert.ok(colMap.has("updated_at"), "updated_at column exists");
    assert.equal(colMap.get("updated_at")!.type, "TEXT");
    assert.equal(colMap.get("updated_at")!.notnull, 1);
  });

  it("uses default status 'pending' and priority 0", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `${prefix}-defaults`;
    db.prepare("INSERT INTO backlog (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, "Defaults Test", now, now);
    const row = db.prepare("SELECT status, priority FROM backlog WHERE id = ?").get(id) as any;
    assert.equal(row.status, "pending");
    assert.equal(row.priority, 0);
  });

  it("getBacklog() returns entries ordered by priority ASC then created_at ASC", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const ids = [`${prefix}-p10`, `${prefix}-p0`, `${prefix}-p5`];

    db.prepare("INSERT INTO backlog (id, title, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(ids[0], "Low", 10, now, now);
    db.prepare("INSERT INTO backlog (id, title, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(ids[1], "High", 0, now, now);
    db.prepare("INSERT INTO backlog (id, title, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(ids[2], "Mid", 5, now, now);

    const entries = getBacklog().filter(e => e.id.startsWith(prefix) && ids.includes(e.id));
    assert.equal(entries.length, 3);
    assert.equal(entries[0].title, "High");
    assert.equal(entries[1].title, "Mid");
    assert.equal(entries[2].title, "Low");
  });

  it("getBacklog() returns BacklogEntry shaped objects", () => {
    const entries = getBacklog();
    if (entries.length > 0) {
      const e = entries[0];
      assert.ok("id" in e, "has id");
      assert.ok("title" in e, "has title");
      assert.ok("description" in e, "has description");
      assert.ok("workflow_id" in e, "has workflow_id");
      assert.ok("status" in e, "has status");
      assert.ok("priority" in e, "has priority");
      assert.ok("created_at" in e, "has created_at");
      assert.ok("updated_at" in e, "has updated_at");
    }
  });

  it("backlog table has project_id column (nullable)", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    const colMap = new Map(columns.map(c => [c.name, c]));
    assert.ok(colMap.has("project_id"), "project_id column exists");
    assert.equal(colMap.get("project_id")!.notnull, 0, "project_id is nullable");
  });

  it("backlog table has workflow_id column (nullable)", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    const colMap = new Map(columns.map(c => [c.name, c]));
    assert.ok(colMap.has("workflow_id"), "workflow_id column exists");
    assert.equal(colMap.get("workflow_id")!.notnull, 0, "workflow_id is nullable");
  });
});
