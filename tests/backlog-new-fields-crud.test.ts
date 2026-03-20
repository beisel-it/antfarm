/**
 * Tests for US-002: notes, tags, acceptance_criteria round-trip in backlog CRUD ops.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const distBacklog = path.resolve(import.meta.dirname, "..", "dist", "backlog", "index.js");

const {
  addBacklogEntry,
  updateBacklogEntry,
  deleteBacklogEntry,
  getBacklogEntry,
  listBacklogEntries,
  listBacklogEntriesForProject,
} = await import(distBacklog) as {
  addBacklogEntry: (fields: {
    title: string;
    description?: string;
    priority?: number;
    projectId?: string;
    workflowId?: string;
    notes?: string;
    tags?: string;
    acceptanceCriteria?: string;
  }) => {
    id: string;
    title: string;
    notes: string | null;
    tags: string | null;
    acceptance_criteria: string | null;
    [key: string]: unknown;
  };
  updateBacklogEntry: (id: string, fields: {
    notes?: string | null;
    tags?: string | null;
    acceptance_criteria?: string | null;
    [key: string]: unknown;
  }) => {
    id: string;
    notes: string | null;
    tags: string | null;
    acceptance_criteria: string | null;
    [key: string]: unknown;
  } | null;
  deleteBacklogEntry: (id: string) => boolean;
  getBacklogEntry: (id: string) => {
    id: string;
    notes: string | null;
    tags: string | null;
    acceptance_criteria: string | null;
    [key: string]: unknown;
  } | null;
  listBacklogEntries: (filters?: { workflow_id?: string }) => Array<{
    id: string;
    notes: string | null;
    tags: string | null;
    acceptance_criteria: string | null;
    [key: string]: unknown;
  }>;
  listBacklogEntriesForProject: (projectId: string) => Array<{
    id: string;
    notes: string | null;
    tags: string | null;
    acceptance_criteria: string | null;
    [key: string]: unknown;
  }>;
};

const prefix = `test-us002-new-fields-${Date.now()}`;
const createdIds: string[] = [];

function add(fields: {
  title: string;
  notes?: string;
  tags?: string;
  acceptanceCriteria?: string;
  projectId?: string;
}) {
  const e = addBacklogEntry({
    title: `${prefix}-${fields.title}`,
    notes: fields.notes,
    tags: fields.tags,
    acceptanceCriteria: fields.acceptanceCriteria,
    projectId: fields.projectId,
  });
  createdIds.push(e.id);
  return e;
}

describe("US-002: notes/tags/acceptanceCriteria round-trip in backlog ops", () => {
  after(() => {
    for (const id of createdIds) {
      try { deleteBacklogEntry(id); } catch {}
    }
  });

  describe("addBacklogEntry with new fields", () => {
    it("persists notes when provided", () => {
      const entry = add({ title: "with-notes", notes: "These are my notes" });
      assert.equal(entry.notes, "These are my notes");
    });

    it("persists tags when provided", () => {
      const entry = add({ title: "with-tags", tags: "backend,api,crud" });
      assert.equal(entry.tags, "backend,api,crud");
    });

    it("persists acceptanceCriteria when provided", () => {
      const entry = add({
        title: "with-ac",
        acceptanceCriteria: "Given X, when Y, then Z",
      });
      assert.equal(entry.acceptance_criteria, "Given X, when Y, then Z");
    });

    it("persists all three fields at once", () => {
      const entry = add({
        title: "all-three",
        notes: "Some notes",
        tags: "tag1,tag2",
        acceptanceCriteria: "AC goes here",
      });
      assert.equal(entry.notes, "Some notes");
      assert.equal(entry.tags, "tag1,tag2");
      assert.equal(entry.acceptance_criteria, "AC goes here");
    });

    it("defaults notes, tags, acceptance_criteria to null when not provided", () => {
      const entry = add({ title: "no-new-fields" });
      assert.equal(entry.notes, null);
      assert.equal(entry.tags, null);
      assert.equal(entry.acceptance_criteria, null);
    });
  });

  describe("getBacklogEntry returns new fields", () => {
    it("returns notes, tags, acceptance_criteria in the fetched entry", () => {
      const created = add({
        title: "fetch-check",
        notes: "Fetched notes",
        tags: "alpha,beta",
        acceptanceCriteria: "Acceptance text",
      });

      const fetched = getBacklogEntry(created.id);
      assert.ok(fetched, "should fetch the entry");
      assert.equal(fetched.notes, "Fetched notes");
      assert.equal(fetched.tags, "alpha,beta");
      assert.equal(fetched.acceptance_criteria, "Acceptance text");
    });
  });

  describe("updateBacklogEntry with new fields", () => {
    it("updates notes", () => {
      const entry = add({ title: "update-notes" });
      const updated = updateBacklogEntry(entry.id, { notes: "Updated notes" });
      assert.ok(updated);
      assert.equal(updated.notes, "Updated notes");
    });

    it("updates tags", () => {
      const entry = add({ title: "update-tags" });
      const updated = updateBacklogEntry(entry.id, { tags: "new-tag,another-tag" });
      assert.ok(updated);
      assert.equal(updated.tags, "new-tag,another-tag");
    });

    it("updates acceptance_criteria", () => {
      const entry = add({ title: "update-ac" });
      const updated = updateBacklogEntry(entry.id, { acceptance_criteria: "New AC" });
      assert.ok(updated);
      assert.equal(updated.acceptance_criteria, "New AC");
    });

    it("updates all three new fields at once", () => {
      const entry = add({
        title: "update-all-three",
        notes: "Old notes",
        tags: "old-tag",
        acceptanceCriteria: "Old AC",
      });
      const updated = updateBacklogEntry(entry.id, {
        notes: "New notes",
        tags: "new-tag",
        acceptance_criteria: "New AC",
      });
      assert.ok(updated);
      assert.equal(updated.notes, "New notes");
      assert.equal(updated.tags, "new-tag");
      assert.equal(updated.acceptance_criteria, "New AC");
    });

    it("can clear notes by setting to null", () => {
      const entry = add({ title: "clear-notes", notes: "Will be cleared" });
      const updated = updateBacklogEntry(entry.id, { notes: null });
      assert.ok(updated);
      assert.equal(updated.notes, null);
    });
  });

  describe("listBacklogEntries includes new fields", () => {
    it("returns notes, tags, acceptance_criteria in listed entries", () => {
      const entry = add({
        title: "list-check",
        notes: "Listed notes",
        tags: "list-tag",
        acceptanceCriteria: "List AC",
      });

      const all = listBacklogEntries();
      const found = all.find((e) => e.id === entry.id);
      assert.ok(found, "should find the entry in list");
      assert.equal(found.notes, "Listed notes");
      assert.equal(found.tags, "list-tag");
      assert.equal(found.acceptance_criteria, "List AC");
    });
  });

  describe("listBacklogEntriesForProject includes new fields", () => {
    it("returns notes, tags, acceptance_criteria in project-filtered entries", () => {
      const projectId = `proj-${Date.now()}`;
      const entry = add({
        title: "project-list-check",
        projectId,
        notes: "Project notes",
        tags: "proj-tag",
        acceptanceCriteria: "Project AC",
      });

      const projectEntries = listBacklogEntriesForProject(projectId);
      assert.equal(projectEntries.length, 1, "should find exactly 1 entry for project");
      const found = projectEntries[0];
      assert.equal(found.id, entry.id);
      assert.equal(found.notes, "Project notes");
      assert.equal(found.tags, "proj-tag");
      assert.equal(found.acceptance_criteria, "Project AC");
    });
  });
});
