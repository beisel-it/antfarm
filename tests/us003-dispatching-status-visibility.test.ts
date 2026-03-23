/**
 * US-003: Add 'dispatching' status to backlog queries and list views
 *
 * Acceptance Criteria:
 * 1. getNextQueuedEntry() does NOT return entries with status='dispatching'
 * 2. listBacklogEntries() DOES return entries with status='dispatching'
 * 3. CLI `antfarm backlog list` shows 'dispatching' status without crashing
 * 4. queueBacklogEntry blocks 'dispatching' entries (covered by US-002, re-verified here)
 * 5. BacklogEntry type documents the 'dispatching' transient status
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDb } from "../src/db.ts";
import {
  addBacklogEntry,
  deleteBacklogEntry,
  getBacklogEntry,
  updateBacklogEntry,
  listBacklogEntries,
  getNextQueuedEntry,
  queueBacklogEntry,
} from "../dist/backlog/index.js";

const cliPath = path.resolve(import.meta.dirname, "..", "dist", "cli", "cli.js");

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function insertProject(db: ReturnType<typeof getDb>, id?: string): string {
  const projectId = id ?? uid();
  const t = now();
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
  ).run(projectId, `project-${projectId.slice(0, 8)}`, t, t);
  return projectId;
}

function runCli(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf-8",
    timeout: 10000,
    env: { ...process.env, HOME: "/tmp/antfarm-test-home" },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

const createdIds: string[] = [];
const db = getDb();

describe("US-003: 'dispatching' status in backlog queries and list views", () => {

  after(() => {
    for (const id of createdIds) {
      try { deleteBacklogEntry(id); } catch {}
    }
  });

  // AC1: getNextQueuedEntry() must NOT return 'dispatching' entries
  it("AC1: getNextQueuedEntry() does not return entries with status='dispatching'", () => {
    const projectId = insertProject(db);
    const workflowId = "feature-dev";

    // Add an entry and queue it
    const entry = addBacklogEntry({ title: `US003-ac1-${uid()}`, projectId, workflowId });
    createdIds.push(entry.id);
    queueBacklogEntry(entry.id, { workflowId });

    // Manually set to 'dispatching' (simulating the CAS transition)
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry.id);

    const result = getNextQueuedEntry(projectId, workflowId);
    // Should NOT return our dispatching entry
    assert.ok(
      result?.id !== entry.id,
      `getNextQueuedEntry() should not return 'dispatching' entry ${entry.id}, got: ${result?.id}`
    );
  });

  it("AC1: getNextQueuedEntry() returns next 'queued' entry even when one is 'dispatching'", () => {
    const projectId = insertProject(db);
    const workflowId = "feature-dev";

    // Add entry1 and set it to 'dispatching'
    const entry1 = addBacklogEntry({ title: `US003-ac1b-first-${uid()}`, projectId, workflowId });
    createdIds.push(entry1.id);
    queueBacklogEntry(entry1.id, { workflowId });
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry1.id);

    // Add entry2 in 'queued' state
    const entry2 = addBacklogEntry({ title: `US003-ac1b-second-${uid()}`, projectId, workflowId });
    createdIds.push(entry2.id);
    queueBacklogEntry(entry2.id, { workflowId });

    const result = getNextQueuedEntry(projectId, workflowId);
    assert.equal(result?.id, entry2.id, `Should return queued entry2, got: ${result?.id}`);
  });

  // AC2: listBacklogEntries() MUST return 'dispatching' entries
  it("AC2: listBacklogEntries() returns entries with status='dispatching'", () => {
    const projectId = insertProject(db);
    const workflowId = "feature-dev";

    const entry = addBacklogEntry({ title: `US003-ac2-${uid()}`, projectId, workflowId });
    createdIds.push(entry.id);
    queueBacklogEntry(entry.id, { workflowId });
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry.id);

    const entries = listBacklogEntries();
    const found = entries.find(e => e.id === entry.id);
    assert.ok(found, `listBacklogEntries() should include 'dispatching' entry ${entry.id}`);
    assert.equal(found?.status, "dispatching", `Expected status 'dispatching', got: ${found?.status}`);
  });

  it("AC2: listBacklogEntries() with project filter returns 'dispatching' entries", () => {
    const projectId = insertProject(db);
    const workflowId = "feature-dev";

    const entry = addBacklogEntry({ title: `US003-ac2b-${uid()}`, projectId, workflowId });
    createdIds.push(entry.id);
    queueBacklogEntry(entry.id, { workflowId });
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry.id);

    const entries = listBacklogEntries({ project_id: projectId });
    const found = entries.find(e => e.id === entry.id);
    assert.ok(found, `listBacklogEntries({project_id}) should include 'dispatching' entry`);
    assert.equal(found?.status, "dispatching");
  });

  it("AC2: listBacklogEntries() with workflow filter returns 'dispatching' entries", () => {
    const projectId = insertProject(db);
    const workflowId = `us003-wf-${uid().slice(0, 8)}`;

    const entry = addBacklogEntry({ title: `US003-ac2c-${uid()}`, projectId, workflowId });
    createdIds.push(entry.id);
    // Manually set to dispatching without going through queue (to avoid workflow validation)
    db.prepare("UPDATE backlog SET status = 'dispatching', workflow_id = ? WHERE id = ?").run(workflowId, entry.id);

    const entries = listBacklogEntries({ workflow_id: workflowId });
    const found = entries.find(e => e.id === entry.id);
    assert.ok(found, `listBacklogEntries({workflow_id}) should include 'dispatching' entry`);
    assert.equal(found?.status, "dispatching");
  });

  // AC3: queueBacklogEntry blocks 'dispatching' (guard recheck from US-002)
  it("AC3: queueBacklogEntry() throws for 'dispatching' entries", () => {
    const projectId = insertProject(db);
    const workflowId = "feature-dev";

    const entry = addBacklogEntry({ title: `US003-ac3-${uid()}`, projectId, workflowId });
    createdIds.push(entry.id);
    queueBacklogEntry(entry.id, { workflowId });
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry.id);

    assert.throws(
      () => queueBacklogEntry(entry.id, { workflowId }),
      /already dispatched/,
      "queueBacklogEntry should throw for 'dispatching' entries"
    );
  });

  // AC4: getBacklogEntry() returns 'dispatching' entries (they are valid active entries)
  it("AC4: getBacklogEntry() returns entry with status='dispatching'", () => {
    const entry = addBacklogEntry({ title: `US003-ac4-${uid()}` });
    createdIds.push(entry.id);
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry.id);

    const fetched = getBacklogEntry(entry.id);
    assert.ok(fetched, "getBacklogEntry should return the entry");
    assert.equal(fetched?.status, "dispatching");
  });

  // AC5: CLI `antfarm backlog list` shows 'dispatching' status without crashing
  it("AC5: CLI backlog list shows 'dispatching' status without crashing", () => {
    const entry = addBacklogEntry({ title: `US003-ac5-cli-${uid()}` });
    createdIds.push(entry.id);
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry.id);

    const result = runCli("backlog", "list");
    assert.equal(result.status, 0, `CLI should exit 0. stderr: ${result.stderr}`);

    const idPrefix = entry.id.slice(0, 8);
    const lines = result.stdout.trim().split("\n");
    const line = lines.find(l => l.includes(idPrefix));
    assert.ok(line, `CLI output should contain entry ${idPrefix}:\n${result.stdout}`);
    assert.ok(
      line!.includes("[dispatching]"),
      `Line should show [dispatching] status: "${line}"`
    );
  });

  it("AC5: CLI backlog list --json includes 'dispatching' entries", () => {
    const entry = addBacklogEntry({ title: `US003-ac5-json-${uid()}` });
    createdIds.push(entry.id);
    db.prepare("UPDATE backlog SET status = 'dispatching' WHERE id = ?").run(entry.id);

    const result = runCli("backlog", "list", "--json");
    assert.equal(result.status, 0, `CLI --json should exit 0. stderr: ${result.stderr}`);

    const arr = JSON.parse(result.stdout.trim()) as Array<{ id: string; status: string }>;
    const found = arr.find(e => e.id === entry.id);
    assert.ok(found, `JSON output should include 'dispatching' entry ${entry.id}`);
    assert.equal(found?.status, "dispatching");
  });

  // Verify updateBacklogEntry can set/update 'dispatching' status
  it("updateBacklogEntry() can set status to 'dispatching'", () => {
    const entry = addBacklogEntry({ title: `US003-update-${uid()}` });
    createdIds.push(entry.id);

    const updated = updateBacklogEntry(entry.id, { status: "dispatching" });
    assert.ok(updated, "updateBacklogEntry should return updated entry");
    assert.equal(updated?.status, "dispatching");
  });
});
