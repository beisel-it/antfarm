/**
 * Tests for US-001: queue_order column and 'queued' status support in backlog schema.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const distDb = path.resolve(import.meta.dirname, "..", "dist", "db.js");
const distOps = path.resolve(import.meta.dirname, "..", "dist", "backlog", "ops.js");

const { getDb } = await import(distDb) as {
  getDb: () => import("node:sqlite").DatabaseSync;
};

const { addBacklogEntry, getBacklogEntry, listBacklogEntries } = await import(distOps) as {
  addBacklogEntry: (fields: {
    title: string;
    description?: string;
    priority?: number;
    projectId?: string;
    workflowId?: string;
  }) => { id: string; queue_order: number | null; status: string; [key: string]: unknown };
  getBacklogEntry: (id: string) => { id: string; queue_order: number | null; status: string; [key: string]: unknown } | null;
  listBacklogEntries: (filters?: { workflow_id?: string; project_id?: string }) => Array<{ id: string; queue_order: number | null; status: string; [key: string]: unknown }>;
};

describe("US-001: queue_order column and queued status", () => {
  const prefix = `test-us001-queue-${Date.now()}`;

  after(() => {
    const db = getDb();
    db.prepare("DELETE FROM backlog WHERE id LIKE ?").run(`${prefix}%`);
  });

  it("backlog table has queue_order column after migration", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>;
    const colMap = new Map(columns.map(c => [c.name, c]));
    assert.ok(colMap.has("queue_order"), "queue_order column should exist");
    assert.equal(colMap.get("queue_order")!.type, "INTEGER", "queue_order should be INTEGER type");
    assert.equal(colMap.get("queue_order")!.notnull, 0, "queue_order should be nullable");
  });

  it("new entries have queue_order = null by default", () => {
    const entry = addBacklogEntry({ title: `${prefix}-default-queue-order` });
    assert.strictEqual(entry.queue_order, null, "new entry should have queue_order = null");
  });

  it("getBacklogEntry returns queue_order field", () => {
    const created = addBacklogEntry({ title: `${prefix}-get-queue-order` });
    const fetched = getBacklogEntry(created.id);
    assert.ok(fetched !== null, "entry should exist");
    assert.ok("queue_order" in fetched, "queue_order field should be present");
    assert.strictEqual(fetched.queue_order, null, "queue_order should be null");
  });

  it("listBacklogEntries returns entries with queue_order field", () => {
    const created = addBacklogEntry({ title: `${prefix}-list-queue-order` });
    const entries = listBacklogEntries();
    const found = entries.find(e => e.id === created.id);
    assert.ok(found !== undefined, "should find the created entry in list");
    assert.ok("queue_order" in found, "queue_order field should be present in listed entries");
  });

  it("existing entries have queue_order = null after migration (no data loss)", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `${prefix}-legacy-entry`;
    // Insert without queue_order (simulating old row)
    db.prepare("INSERT INTO backlog (id, title, status, priority, created_at, updated_at) VALUES (?, ?, 'pending', 0, ?, ?)").run(id, "Legacy Entry", now, now);
    const row = db.prepare("SELECT queue_order FROM backlog WHERE id = ?").get(id) as { queue_order: number | null };
    assert.strictEqual(row.queue_order, null, "legacy entries should have queue_order = null");
  });

  it("backlog table accepts 'queued' as a status value", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `${prefix}-queued-status`;
    db.prepare("INSERT INTO backlog (id, title, status, priority, created_at, updated_at) VALUES (?, ?, 'queued', 0, ?, ?)").run(id, "Queued Item", now, now);
    const row = db.prepare("SELECT status FROM backlog WHERE id = ?").get(id) as { status: string };
    assert.equal(row.status, "queued", "should accept 'queued' as status value");
  });

  it("queue_order can be set to a non-null integer value", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `${prefix}-queue-order-value`;
    db.prepare("INSERT INTO backlog (id, title, status, priority, queue_order, created_at, updated_at) VALUES (?, ?, 'queued', 0, ?, ?, ?)").run(id, "Ordered Item", 1, now, now);
    const row = db.prepare("SELECT queue_order FROM backlog WHERE id = ?").get(id) as { queue_order: number | null };
    assert.equal(row.queue_order, 1, "queue_order should be stored and retrievable as integer");
  });

  it("BacklogEntry interface has queue_order field (TypeScript compile check via addBacklogEntry return)", () => {
    const entry = addBacklogEntry({ title: `${prefix}-interface-check` });
    // If TypeScript compiled successfully with queue_order in interface,
    // and the runtime returns it, the interface is correct.
    assert.ok(Object.prototype.hasOwnProperty.call(entry, "queue_order"), "BacklogEntry should have queue_order property");
  });
});
