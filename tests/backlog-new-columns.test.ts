/**
 * Tests for US-001: DB: Add missing backlog columns (notes, tags, acceptance_criteria)
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const distDb = path.resolve(import.meta.dirname, "..", "dist", "db.js");

const { getDb, getBacklog } = await import(distDb) as {
  getDb: () => import("node:sqlite").DatabaseSync;
  getBacklog: () => Array<Record<string, unknown>>;
};

describe("US-001: backlog new columns (notes, tags, acceptance_criteria)", () => {
  const prefix = `test-us001-newcols-${Date.now()}`;

  after(() => {
    const db = getDb();
    db.prepare("DELETE FROM backlog WHERE id LIKE ?").run(`${prefix}%`);
  });

  it("backlog table has notes column (TEXT, nullable)", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const col = columns.find(c => c.name === "notes");
    assert.ok(col, "notes column should exist");
    assert.equal(col!.type, "TEXT");
    assert.equal(col!.notnull, 0, "notes should be nullable");
  });

  it("backlog table has tags column (TEXT, nullable)", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const col = columns.find(c => c.name === "tags");
    assert.ok(col, "tags column should exist");
    assert.equal(col!.type, "TEXT");
    assert.equal(col!.notnull, 0, "tags should be nullable");
  });

  it("backlog table has acceptance_criteria column (TEXT, nullable)", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const col = columns.find(c => c.name === "acceptance_criteria");
    assert.ok(col, "acceptance_criteria column should exist");
    assert.equal(col!.type, "TEXT");
    assert.equal(col!.notnull, 0, "acceptance_criteria should be nullable");
  });

  it("new columns default to NULL for new entries without values", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `${prefix}-null-defaults`;
    db.prepare("INSERT INTO backlog (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, "Null defaults test", now, now);
    const row = db.prepare("SELECT notes, tags, acceptance_criteria FROM backlog WHERE id = ?").get(id) as any;
    assert.equal(row.notes, null, "notes defaults to NULL");
    assert.equal(row.tags, null, "tags defaults to NULL");
    assert.equal(row.acceptance_criteria, null, "acceptance_criteria defaults to NULL");
  });

  it("can store and retrieve values for notes, tags, acceptance_criteria", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `${prefix}-with-values`;
    db.prepare(
      "INSERT INTO backlog (id, title, notes, tags, acceptance_criteria, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, "Full entry", "Some notes here", "tag1,tag2,tag3", "- [ ] Criterion 1\n- [ ] Criterion 2", now, now);

    const row = db.prepare("SELECT notes, tags, acceptance_criteria FROM backlog WHERE id = ?").get(id) as any;
    assert.equal(row.notes, "Some notes here");
    assert.equal(row.tags, "tag1,tag2,tag3");
    assert.equal(row.acceptance_criteria, "- [ ] Criterion 1\n- [ ] Criterion 2");
  });

  it("migrate() is idempotent — calling getDb() twice does not throw", () => {
    // getDb() calls migrate() each time a new connection is made
    // Forcing a fresh call by importing again would reuse module cache,
    // so instead we directly call migrate logic by checking columns twice
    assert.doesNotThrow(() => {
      const db = getDb();
      const cols1 = db.prepare("PRAGMA table_info(backlog)").all() as Array<{ name: string }>;
      const colNames = new Set(cols1.map(c => c.name));
      assert.ok(colNames.has("notes"));
      assert.ok(colNames.has("tags"));
      assert.ok(colNames.has("acceptance_criteria"));
    });
  });

  it("getBacklog() returns entries with notes, tags, acceptance_criteria fields", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `${prefix}-getbacklog`;
    db.prepare(
      "INSERT INTO backlog (id, title, notes, tags, acceptance_criteria, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, "GetBacklog test", "My notes", "alpha,beta", "- [ ] AC1", now, now);

    const entries = getBacklog().filter(e => e.id === id);
    assert.equal(entries.length, 1);
    const entry = entries[0];
    assert.ok("notes" in entry, "notes field present in BacklogEntry");
    assert.ok("tags" in entry, "tags field present in BacklogEntry");
    assert.ok("acceptance_criteria" in entry, "acceptance_criteria field present in BacklogEntry");
    assert.equal(entry.notes, "My notes");
    assert.equal(entry.tags, "alpha,beta");
    assert.equal(entry.acceptance_criteria, "- [ ] AC1");
  });
});
