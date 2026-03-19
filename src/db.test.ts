import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDb, getDbPath, getBacklog, BacklogEntry } from "./db.js";

describe("Database Migration", () => {
  const testDbPath = path.join(os.tmpdir(), `antfarm-test-${Date.now()}.db`);
  let testDb: DatabaseSync | null = null;

  before(() => {
    // Create a test database to verify migrations
    testDb = new DatabaseSync(testDbPath);
    testDb.exec("PRAGMA journal_mode=WAL");
    testDb.exec("PRAGMA foreign_keys=ON");
  });

  after(() => {
    // Clean up test database
    if (testDb) {
      try {
        testDb.close();
      } catch {}
    }
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(`${testDbPath}-shm`);
      fs.unlinkSync(`${testDbPath}-wal`);
    } catch {}
  });

  describe("backlog_items table", () => {
    it("creates backlog_items table with correct schema", () => {
      // Use the real getDb() to ensure migration runs
      const db = getDb();
      
      // Check table exists
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='backlog_items'"
      ).all() as Array<{ name: string }>;
      
      assert.equal(tables.length, 1, "backlog_items table should exist");
      assert.equal(tables[0].name, "backlog_items");
    });

    it("has all required columns with correct types", () => {
      const db = getDb();
      
      const columns = db.prepare("PRAGMA table_info(backlog_items)").all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>;
      
      const columnMap = new Map(columns.map(c => [c.name, c]));
      
      // Verify all required columns exist
      assert.ok(columnMap.has("id"), "Should have id column");
      assert.ok(columnMap.has("title"), "Should have title column");
      assert.ok(columnMap.has("description"), "Should have description column");
      assert.ok(columnMap.has("workflow_id"), "Should have workflow_id column");
      assert.ok(columnMap.has("priority"), "Should have priority column");
      assert.ok(columnMap.has("status"), "Should have status column");
      assert.ok(columnMap.has("created_at"), "Should have created_at column");
      assert.ok(columnMap.has("updated_at"), "Should have updated_at column");
      
      // Verify id is primary key
      const idCol = columnMap.get("id")!;
      assert.equal(idCol.type, "TEXT", "id should be TEXT type");
      assert.equal(idCol.pk, 1, "id should be primary key");
      
      // Verify title is NOT NULL
      const titleCol = columnMap.get("title")!;
      assert.equal(titleCol.type, "TEXT", "title should be TEXT type");
      assert.equal(titleCol.notnull, 1, "title should be NOT NULL");
      
      // Verify priority is INTEGER
      const priorityCol = columnMap.get("priority")!;
      assert.equal(priorityCol.type, "INTEGER", "priority should be INTEGER type");
      
      // Verify status has default 'pending'
      const statusCol = columnMap.get("status")!;
      assert.equal(statusCol.type, "TEXT", "status should be TEXT type");
      assert.equal(statusCol.dflt_value, "'pending'", "status should default to 'pending'");
      
      // Verify created_at is NOT NULL
      const createdCol = columnMap.get("created_at")!;
      assert.equal(createdCol.type, "TEXT", "created_at should be TEXT type");
      assert.equal(createdCol.notnull, 1, "created_at should be NOT NULL");
      
      // Verify updated_at is NOT NULL
      const updatedCol = columnMap.get("updated_at")!;
      assert.equal(updatedCol.type, "TEXT", "updated_at should be TEXT type");
      assert.equal(updatedCol.notnull, 1, "updated_at should be NOT NULL");
    });

    it("can insert and query backlog items", () => {
      const db = getDb();
      const now = new Date().toISOString();
      const testId = `test-backlog-${Date.now()}`;
      
      // Insert a test item
      db.prepare(`
        INSERT INTO backlog_items (id, title, description, workflow_id, priority, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(testId, "Test Item", "Test Description", "test-workflow", 1, "pending", now, now);
      
      // Query it back
      const item = db.prepare("SELECT * FROM backlog_items WHERE id = ?").get(testId) as any;
      
      assert.equal(item.id, testId);
      assert.equal(item.title, "Test Item");
      assert.equal(item.description, "Test Description");
      assert.equal(item.workflow_id, "test-workflow");
      assert.equal(item.priority, 1);
      assert.equal(item.status, "pending");
      assert.equal(item.created_at, now);
      assert.equal(item.updated_at, now);
      
      // Clean up
      db.prepare("DELETE FROM backlog_items WHERE id = ?").run(testId);
    });

    it("uses default status 'pending' when not specified", () => {
      const db = getDb();
      const now = new Date().toISOString();
      const testId = `test-default-status-${Date.now()}`;
      
      // Insert without specifying status
      db.prepare(`
        INSERT INTO backlog_items (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(testId, "Test Default Status", now, now);
      
      // Query it back
      const item = db.prepare("SELECT status FROM backlog_items WHERE id = ?").get(testId) as any;
      
      assert.equal(item.status, "pending", "status should default to 'pending'");
      
      // Clean up
      db.prepare("DELETE FROM backlog_items WHERE id = ?").run(testId);
    });

    it("supports priority ordering", () => {
      const db = getDb();
      const now = new Date().toISOString();
      const testIds = [
        `test-priority-1-${Date.now()}`,
        `test-priority-2-${Date.now()}`,
        `test-priority-3-${Date.now()}`,
      ];
      
      // Insert items with different priorities
      db.prepare(`
        INSERT INTO backlog_items (id, title, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(testIds[0], "Low Priority", 10, now, now);
      
      db.prepare(`
        INSERT INTO backlog_items (id, title, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(testIds[1], "High Priority", 1, now, now);
      
      db.prepare(`
        INSERT INTO backlog_items (id, title, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(testIds[2], "Medium Priority", 5, now, now);
      
      // Query ordered by priority
      const items = db.prepare(`
        SELECT id, title, priority FROM backlog_items 
        WHERE id IN (?, ?, ?) 
        ORDER BY priority ASC
      `).all(testIds[0], testIds[1], testIds[2]) as Array<{ id: string; title: string; priority: number }>;
      
      assert.equal(items.length, 3);
      assert.equal(items[0].title, "High Priority", "First item should be highest priority (lowest number)");
      assert.equal(items[0].priority, 1);
      assert.equal(items[1].title, "Medium Priority");
      assert.equal(items[1].priority, 5);
      assert.equal(items[2].title, "Low Priority");
      assert.equal(items[2].priority, 10);
      
      // Clean up
      testIds.forEach(id => db.prepare("DELETE FROM backlog_items WHERE id = ?").run(id));
    });
  });

  describe("backlog table", () => {
    it("creates backlog table with correct schema", () => {
      const db = getDb();
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='backlog'"
      ).all() as Array<{ name: string }>;
      assert.equal(tables.length, 1, "backlog table should exist");
      assert.equal(tables[0].name, "backlog");
    });

    it("has all required columns with correct types and constraints", () => {
      const db = getDb();
      const columns = db.prepare("PRAGMA table_info(backlog)").all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>;
      const columnMap = new Map(columns.map(c => [c.name, c]));

      // id: TEXT PRIMARY KEY
      const idCol = columnMap.get("id")!;
      assert.ok(idCol, "should have id column");
      assert.equal(idCol.type, "TEXT");
      assert.equal(idCol.pk, 1, "id should be primary key");

      // title: TEXT NOT NULL
      const titleCol = columnMap.get("title")!;
      assert.ok(titleCol, "should have title column");
      assert.equal(titleCol.type, "TEXT");
      assert.equal(titleCol.notnull, 1, "title should be NOT NULL");

      // description: TEXT (nullable)
      const descCol = columnMap.get("description")!;
      assert.ok(descCol, "should have description column");
      assert.equal(descCol.type, "TEXT");
      assert.equal(descCol.notnull, 0, "description should be nullable");

      // workflow_id: TEXT (nullable)
      const workflowCol = columnMap.get("workflow_id")!;
      assert.ok(workflowCol, "should have workflow_id column");
      assert.equal(workflowCol.type, "TEXT");
      assert.equal(workflowCol.notnull, 0, "workflow_id should be nullable");

      // status: TEXT DEFAULT 'pending'
      const statusCol = columnMap.get("status")!;
      assert.ok(statusCol, "should have status column");
      assert.equal(statusCol.type, "TEXT");
      assert.equal(statusCol.dflt_value, "'pending'", "status should default to 'pending'");

      // priority: INTEGER DEFAULT 0
      const priorityCol = columnMap.get("priority")!;
      assert.ok(priorityCol, "should have priority column");
      assert.equal(priorityCol.type, "INTEGER");
      assert.equal(priorityCol.dflt_value, "0", "priority should default to 0");

      // created_at: TEXT NOT NULL
      const createdCol = columnMap.get("created_at")!;
      assert.ok(createdCol, "should have created_at column");
      assert.equal(createdCol.type, "TEXT");
      assert.equal(createdCol.notnull, 1, "created_at should be NOT NULL");

      // updated_at: TEXT NOT NULL
      const updatedCol = columnMap.get("updated_at")!;
      assert.ok(updatedCol, "should have updated_at column");
      assert.equal(updatedCol.type, "TEXT");
      assert.equal(updatedCol.notnull, 1, "updated_at should be NOT NULL");
    });

    it("getBacklog() returns BacklogEntry array sorted by priority then created_at", () => {
      const db = getDb();
      const now = new Date().toISOString();
      const prefix = `test-backlog-${Date.now()}`;
      const ids = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`];

      db.prepare("INSERT INTO backlog (id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(ids[0], "Low Priority", "desc", "pending", 10, now, now);
      db.prepare("INSERT INTO backlog (id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(ids[1], "High Priority", null, "pending", 0, now, now);
      db.prepare("INSERT INTO backlog (id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(ids[2], "Mid Priority", null, "pending", 5, now, now);

      const entries = getBacklog().filter(e => e.id.startsWith(prefix));
      assert.equal(entries.length, 3);
      assert.equal(entries[0].title, "High Priority");
      assert.equal(entries[0].priority, 0);
      assert.equal(entries[1].title, "Mid Priority");
      assert.equal(entries[2].title, "Low Priority");

      // Verify BacklogEntry shape
      const entry: BacklogEntry = entries[0];
      assert.ok(typeof entry.id === "string");
      assert.ok(typeof entry.title === "string");
      assert.ok(typeof entry.priority === "number");
      assert.ok(typeof entry.status === "string");
      assert.ok("workflow_id" in entry);
      assert.ok(typeof entry.created_at === "string");
      assert.ok(typeof entry.updated_at === "string");

      ids.forEach(id => db.prepare("DELETE FROM backlog WHERE id = ?").run(id));
    });

    it("uses default status 'pending' and priority 0 when not specified", () => {
      const db = getDb();
      const now = new Date().toISOString();
      const testId = `test-backlog-defaults-${Date.now()}`;

      db.prepare("INSERT INTO backlog (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(testId, "Default Test", now, now);

      const item = db.prepare("SELECT status, priority FROM backlog WHERE id = ?").get(testId) as any;
      assert.equal(item.status, "pending");
      assert.equal(item.priority, 0);

      db.prepare("DELETE FROM backlog WHERE id = ?").run(testId);
    });
  });
});
