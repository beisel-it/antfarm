/**
 * Tests for US-006: `antfarm backlog delete` CLI command.
 * Runs against the built dist/ CLI.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const distBacklog = path.resolve(import.meta.dirname, "..", "dist", "backlog", "index.js");
const cliPath = path.resolve(import.meta.dirname, "..", "dist", "cli", "cli.js");

const { addBacklogEntry, getBacklogEntry } = await import(distBacklog) as {
  addBacklogEntry: (fields: { title: string; description?: string; priority?: number }) => {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    created_at: string;
    updated_at: string;
  };
  getBacklogEntry: (id: string) => {
    id: string;
    title: string;
  } | null;
};

const createdIds: string[] = [];

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

describe("US-006: antfarm backlog delete CLI", () => {
  let testEntry: { id: string };

  before(() => {
    testEntry = addBacklogEntry({ title: "Entry to delete" });
    createdIds.push(testEntry.id);
  });

  after(() => {
    // Clean up any remaining test entries (in case delete didn't run)
    for (const id of createdIds) {
      try {
        const { deleteBacklogEntry } = require(distBacklog);
        deleteBacklogEntry(id);
      } catch {
        // ignore
      }
    }
  });

  it("deletes an existing entry by full id and prints confirmation", () => {
    const entry = addBacklogEntry({ title: "Delete me full id" });
    const result = runCli("backlog", "delete", entry.id);
    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    assert.match(result.stdout, /Deleted backlog entry:/);
    assert.match(result.stdout, new RegExp(entry.id));
    // Verify actually deleted
    const found = getBacklogEntry(entry.id);
    assert.equal(found, null, "Entry should be deleted from DB");
  });

  it("deletes an existing entry by id prefix and prints confirmation", () => {
    const entry = addBacklogEntry({ title: "Delete me prefix" });
    const prefix = entry.id.slice(0, 8);
    const result = runCli("backlog", "delete", prefix);
    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    assert.match(result.stdout, /Deleted backlog entry:/);
    // Verify actually deleted
    const found = getBacklogEntry(entry.id);
    assert.equal(found, null, "Entry should be deleted from DB");
  });

  it("exits with code 1 and prints error to stderr when id not found", () => {
    const result = runCli("backlog", "delete", "nonexistent-id-xyz");
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /not found/i);
  });

  it("exits with code 1 and prints error to stderr when no id provided", () => {
    const result = runCli("backlog", "delete");
    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.match(result.stderr, /Missing id argument/i);
  });

  it("help text includes backlog delete", () => {
    const result = runCli();
    const combined = result.stdout + result.stderr;
    assert.ok(
      combined.includes("backlog delete"),
      `Usage should include 'backlog delete'. Got: ${combined.slice(0, 800)}`
    );
  });
});
