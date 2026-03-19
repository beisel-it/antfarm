/**
 * Tests for US-005: `antfarm backlog update` CLI command.
 * Runs against the built dist/ CLI.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const distBacklog = path.resolve(import.meta.dirname, "..", "dist", "backlog", "index.js");
const cliPath = path.resolve(import.meta.dirname, "..", "dist", "cli", "cli.js");

const { addBacklogEntry, deleteBacklogEntry, getBacklogEntry } = await import(distBacklog) as {
  addBacklogEntry: (fields: { title: string; description?: string; priority?: number }) => {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    created_at: string;
    updated_at: string;
  };
  deleteBacklogEntry: (id: string) => boolean;
  getBacklogEntry: (id: string) => {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    created_at: string;
    updated_at: string;
  } | null;
};

const createdIds: string[] = [];

function runCli(...args: string[]): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf-8",
    timeout: 10000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

describe("US-005: antfarm backlog update CLI", () => {
  let testEntry: { id: string; title: string; status: string; priority: number };

  before(() => {
    testEntry = addBacklogEntry({ title: `US005-base-${Date.now()}`, priority: 0 });
    createdIds.push(testEntry.id);
  });

  after(() => {
    for (const id of createdIds) {
      try { deleteBacklogEntry(id); } catch {}
    }
  });

  it("updates the title with --title flag", () => {
    const newTitle = `US005-updated-${Date.now()}`;
    const result = runCli("backlog", "update", testEntry.id, "--title", newTitle);

    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("Updated backlog entry:"), `stdout: ${result.stdout}`);
    assert.ok(result.stdout.includes(testEntry.id), `stdout should include id. Got: ${result.stdout}`);

    const entry = getBacklogEntry(testEntry.id);
    assert.ok(entry, "Entry should still exist");
    assert.equal(entry!.title, newTitle, "Title should be updated");
  });

  it("updates the status with --status flag", () => {
    const result = runCli("backlog", "update", testEntry.id, "--status", "dispatched");

    assert.equal(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("Updated backlog entry:"), `stdout: ${result.stdout}`);

    const entry = getBacklogEntry(testEntry.id);
    assert.ok(entry, "Entry should exist");
    assert.equal(entry!.status, "dispatched", "Status should be 'dispatched'");
  });

  it("updates priority with --priority flag", () => {
    const result = runCli("backlog", "update", testEntry.id, "--priority", "99");

    assert.equal(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);
    const entry = getBacklogEntry(testEntry.id);
    assert.ok(entry, "Entry should exist");
    assert.equal(entry!.priority, 99, "Priority should be 99");
  });

  it("supports prefix-match on id (first 8 chars)", () => {
    const prefix = testEntry.id.slice(0, 8);
    const newTitle = `US005-prefix-${Date.now()}`;
    const result = runCli("backlog", "update", prefix, "--title", newTitle);

    assert.equal(result.status, 0, `Expected exit 0 with prefix match. stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("Updated backlog entry:"), `stdout: ${result.stdout}`);

    const entry = getBacklogEntry(testEntry.id);
    assert.ok(entry, "Entry should exist");
    assert.equal(entry!.title, newTitle, "Title should be updated via prefix match");
  });

  it("updates description with --description flag", () => {
    const result = runCli("backlog", "update", testEntry.id, "--description", "A new description");

    assert.equal(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);
    const entry = getBacklogEntry(testEntry.id);
    assert.ok(entry, "Entry should exist");
    assert.equal(entry!.description, "A new description", "Description should be updated");
  });

  it("exits with code 1 and prints error to stderr for non-existent id", () => {
    const result = runCli("backlog", "update", "nonexistent-id-xyz", "--title", "New title");

    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.ok(result.stderr.length > 0, "Should print error to stderr");
    assert.ok(
      result.stderr.includes("not found") || result.stderr.includes("nonexistent"),
      `stderr should mention not found. Got: ${result.stderr}`
    );
  });

  it("exits with code 1 when no update flags are provided", () => {
    const result = runCli("backlog", "update", testEntry.id);

    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.ok(result.stderr.length > 0, "Should print error to stderr");
    assert.ok(
      result.stderr.includes("No update flags") || result.stderr.includes("--title"),
      `stderr should mention missing flags. Got: ${result.stderr}`
    );
  });

  it("exits with code 1 when id argument is missing", () => {
    const result = runCli("backlog", "update");

    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.ok(result.stderr.length > 0, "Should print error to stderr");
  });

  it("help text includes antfarm backlog update", () => {
    const helpResult = runCli();
    const combined = helpResult.stdout + helpResult.stderr;
    assert.ok(
      combined.includes("backlog update"),
      `Usage should include 'backlog update'. Got: ${combined.slice(0, 800)}`
    );
  });

  it("output format is 'Updated backlog entry: <uuid>'", () => {
    const newTitle = `US005-format-${Date.now()}`;
    const result = runCli("backlog", "update", testEntry.id, "--title", newTitle);

    assert.equal(result.status, 0);
    const line = result.stdout.trim();
    assert.match(
      line,
      /^Updated backlog entry: [0-9a-f-]{36}$/,
      `Output format mismatch: ${line}`
    );
  });
});
