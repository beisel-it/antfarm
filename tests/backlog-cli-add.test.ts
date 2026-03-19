/**
 * Tests for US-003: `antfarm backlog add` CLI command.
 * Runs against the built dist/ CLI.
 */
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";

const distBacklog = path.resolve(import.meta.dirname, "..", "dist", "backlog", "index.js");
const cliPath = path.resolve(import.meta.dirname, "..", "dist", "cli", "cli.js");

const { deleteBacklogEntry, getBacklogEntry, listBacklogEntries } = await import(distBacklog) as {
  deleteBacklogEntry: (id: string) => boolean;
  getBacklogEntry: (id: string) => { id: string; title: string; description: string | null; status: string; priority: number; created_at: string; updated_at: string } | null;
  listBacklogEntries: () => Array<{ id: string; title: string; description: string | null; status: string; priority: number; created_at: string; updated_at: string }>;
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

// Extract backlog entry ID from "Added backlog entry: <id> "<title>""
function extractId(output: string): string | null {
  const match = output.match(/Added backlog entry: ([0-9a-f-]{36})/);
  return match ? match[1] : null;
}

describe("US-003: antfarm backlog add CLI", () => {
  after(() => {
    for (const id of createdIds) {
      try { deleteBacklogEntry(id); } catch {}
    }
  });

  it("creates an entry with title only and prints id and title", () => {
    const title = `US003-test-${Date.now()}`;
    const result = runCli("backlog", "add", title);

    assert.equal(result.status, 0, `Expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("Added backlog entry:"), "stdout should include confirmation");
    assert.ok(result.stdout.includes(`"${title}"`), "stdout should include quoted title");

    const id = extractId(result.stdout);
    assert.ok(id, "Should extract entry id from output");
    createdIds.push(id!);

    const entry = getBacklogEntry(id!);
    assert.ok(entry, "Entry should exist in DB");
    assert.equal(entry!.title, title);
    assert.equal(entry!.status, "pending");
  });

  it("creates entry with --description and --priority flags", () => {
    const title = `US003-flags-${Date.now()}`;
    const result = runCli("backlog", "add", title, "--description", "my description", "--priority", "5");

    assert.equal(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);
    const id = extractId(result.stdout);
    assert.ok(id, "Should extract id from output");
    createdIds.push(id!);

    const entry = getBacklogEntry(id!);
    assert.ok(entry, "Entry should exist in DB");
    assert.equal(entry!.title, title);
    assert.equal(entry!.description, "my description");
    assert.equal(entry!.priority, 5);
  });

  it("exits with code 1 and prints error to stderr when title is missing", () => {
    const result = runCli("backlog", "add");

    assert.equal(result.status, 1, `Expected exit 1, got ${result.status}`);
    assert.ok(result.stderr.length > 0, "Should print error to stderr");
    assert.ok(
      result.stderr.includes("Missing title") || result.stderr.includes("title"),
      `stderr should mention title: ${result.stderr}`
    );
  });

  it("help text includes antfarm backlog add", () => {
    const result = runCli("--help");
    // --help doesn't exist so usage is printed on error, but let's try the normal path
    // antfarm with no args or bad args prints usage
    const helpResult = runCli();
    const combined = result.stdout + result.stderr + helpResult.stdout + helpResult.stderr;
    assert.ok(
      combined.includes("backlog add"),
      `Usage should include 'backlog add'. Got: ${combined.slice(0, 500)}`
    );
  });

  it("output format is 'Added backlog entry: <uuid> \"<title>\"'", () => {
    const title = `US003-format-${Date.now()}`;
    const result = runCli("backlog", "add", title);

    assert.equal(result.status, 0);
    const line = result.stdout.trim();
    // Should match: Added backlog entry: <uuid> "<title>"
    assert.match(line, /^Added backlog entry: [0-9a-f-]{36} ".+"$/, 
      `Output format mismatch: ${line}`);
    
    const id = extractId(result.stdout);
    createdIds.push(id!);
  });
});
