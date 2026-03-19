/**
 * Tests for US-002: backlog CRUD operations.
 * Runs against the built dist/ and uses the real DB (cleans up after).
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const distBacklog = path.resolve(import.meta.dirname, "..", "dist", "backlog", "index.js");

const {
  addBacklogEntry,
  updateBacklogEntry,
  deleteBacklogEntry,
  listBacklogEntries,
  getBacklogEntry,
} = await import(distBacklog) as {
  addBacklogEntry: (fields: { title: string; description?: string; priority?: number }) => {
    id: string; title: string; description: string | null; status: string; priority: number;
    created_at: string; updated_at: string;
  };
  updateBacklogEntry: (id: string, fields: object) => { id: string; title: string; description: string | null; status: string; priority: number; created_at: string; updated_at: string } | null;
  deleteBacklogEntry: (id: string) => boolean;
  listBacklogEntries: () => Array<{ id: string; title: string; description: string | null; status: string; priority: number; created_at: string; updated_at: string }>;
  getBacklogEntry: (id: string) => { id: string; title: string; description: string | null; status: string; priority: number; created_at: string; updated_at: string } | null;
};

const prefix = `test-us002-${Date.now()}`;
const createdIds: string[] = [];

// Helper that auto-tracks created IDs for cleanup
function add(fields: { title: string; description?: string; priority?: number }) {
  const e = addBacklogEntry({ ...fields, title: `${prefix}-${fields.title}` });
  createdIds.push(e.id);
  return e;
}

describe("US-002: backlog CRUD ops", () => {
  after(() => {
    for (const id of createdIds) {
      try { deleteBacklogEntry(id); } catch {}
    }
  });

  describe("addBacklogEntry", () => {
    it("inserts a row and returns the new entry with all fields set", () => {
      const entry = add({ title: "My Task", description: "Some desc", priority: 5 });
      assert.ok(entry.id, "should have an id");
      assert.ok(entry.title.endsWith("My Task"));
      assert.equal(entry.description, "Some desc");
      assert.equal(entry.priority, 5);
      assert.equal(entry.status, "pending");
      assert.ok(entry.created_at, "should have created_at");
      assert.ok(entry.updated_at, "should have updated_at");
    });

    it("uses defaults for optional fields", () => {
      const entry = add({ title: "Minimal" });
      assert.equal(entry.priority, 0);
      assert.equal(entry.status, "pending");
      assert.equal(entry.description, null);
    });
  });

  describe("getBacklogEntry", () => {
    it("returns entry by id", () => {
      const added = add({ title: "Fetch me" });
      const fetched = getBacklogEntry(added.id);
      assert.ok(fetched);
      assert.equal(fetched.id, added.id);
    });

    it("returns null for non-existent id", () => {
      const result = getBacklogEntry("does-not-exist-us002");
      assert.equal(result, null);
    });
  });

  describe("updateBacklogEntry", () => {
    it("modifies title and returns updated entry", () => {
      const entry = add({ title: "Old title" });
      const updated = updateBacklogEntry(entry.id, { title: `${prefix}-New title` });
      assert.ok(updated);
      assert.equal(updated.title, `${prefix}-New title`);
      assert.equal(updated.id, entry.id);
    });

    it("modifies description", () => {
      const entry = add({ title: "Desc update" });
      const updated = updateBacklogEntry(entry.id, { description: "Updated desc" });
      assert.ok(updated);
      assert.equal(updated.description, "Updated desc");
    });

    it("modifies status", () => {
      const entry = add({ title: "Status test" });
      const updated = updateBacklogEntry(entry.id, { status: "in-progress" });
      assert.ok(updated);
      assert.equal(updated.status, "in-progress");
    });

    it("modifies priority", () => {
      const entry = add({ title: "Priority test" });
      const updated = updateBacklogEntry(entry.id, { priority: 10 });
      assert.ok(updated);
      assert.equal(updated.priority, 10);
    });

    it("returns null for non-existent id", () => {
      const result = updateBacklogEntry("ghost-id-us002", { title: "Nope" });
      assert.equal(result, null);
    });
  });

  describe("deleteBacklogEntry", () => {
    it("removes the row and returns true", () => {
      const entry = add({ title: "Delete me" });
      const result = deleteBacklogEntry(entry.id);
      assert.equal(result, true);
      assert.equal(getBacklogEntry(entry.id), null);
      // Remove from cleanup list since already deleted
      const idx = createdIds.indexOf(entry.id);
      if (idx !== -1) createdIds.splice(idx, 1);
    });

    it("returns false for non-existent id", () => {
      const result = deleteBacklogEntry("non-existent-id-us002");
      assert.equal(result, false);
    });
  });

  describe("listBacklogEntries", () => {
    it("returns entries ordered by priority DESC, created_at ASC", async () => {
      const e1 = add({ title: "List-Low", priority: 1 });
      await new Promise((r) => setTimeout(r, 10));
      const e2 = add({ title: "List-High", priority: 10 });
      await new Promise((r) => setTimeout(r, 10));
      const e3 = add({ title: "List-Mid", priority: 5 });

      const all = listBacklogEntries();
      const ids = [e1.id, e2.id, e3.id];
      const ours = all.filter((e) => ids.includes(e.id));

      assert.equal(ours.length, 3, "should find all 3 entries");
      // priority DESC: e2(10), e3(5), e1(1)
      assert.equal(ours[0].id, e2.id, "highest priority first");
      assert.equal(ours[1].id, e3.id, "mid priority second");
      assert.equal(ours[2].id, e1.id, "lowest priority last");
    });
  });
});
