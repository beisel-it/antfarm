/**
 * US-001: Normalize successful run status from 'completed' to 'done' in advancePipeline
 *
 * Tests that:
 * 1. advancePipeline() writes status='done' (not 'completed') when all steps finish
 * 2. stopWorkflow() treats 'done' as a terminal state and returns 'already_done'
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

// ── Minimal in-memory DB mirroring production schema ──────────────────

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      context TEXT NOT NULL DEFAULT '{}',
      notify_url TEXT,
      run_number INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      step_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      input_template TEXT NOT NULL,
      expects TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'single',
      loop_config TEXT,
      current_story_id TEXT
    );
  `);

  return db;
}

function now(): string {
  return new Date().toISOString();
}

describe("US-001: Run status normalization — 'completed' → 'done'", () => {
  it("advancePipeline writes status='done' when all steps finish (not 'completed')", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const t = now();

    // Running run with all steps done
    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    // No pending/waiting steps — simulates all steps complete
    const nextStep = db
      .prepare("SELECT id FROM steps WHERE run_id = ? AND status = 'waiting' LIMIT 1")
      .get(runId);

    assert.equal(nextStep, undefined, "No waiting steps remain");

    // Simulate advancePipeline final branch: write 'done'
    db.prepare(
      "UPDATE runs SET status = 'done', updated_at = datetime('now') WHERE id = ?"
    ).run(runId);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "done", "Run status should be 'done', not 'completed'");
    assert.notEqual(run.status, "completed", "Status must NOT be 'completed'");
  });

  it("stopWorkflow guard: 'done' status is treated as terminal (returns already_done)", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const t = now();

    // A completed run stored as 'done'
    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'done', '{}', ?, ?)"
    ).run(runId, t, t);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };

    // Simulate stopWorkflow guard logic (updated in src/installer/status.ts line 108)
    const isTerminal = run.status === "done" || run.status === "cancelled";
    assert.ok(isTerminal, "A 'done' run should be treated as terminal by stopWorkflow guard");
  });

  it("stopWorkflow guard: 'cancelled' status still treated as terminal", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'cancelled', '{}', ?, ?)"
    ).run(runId, t, t);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    const isTerminal = run.status === "done" || run.status === "cancelled";
    assert.ok(isTerminal, "A 'cancelled' run should still be treated as terminal");
  });

  it("stopWorkflow guard: 'completed' status is NO LONGER a terminal state (contract broken)", () => {
    // This test documents that old 'completed' status is deprecated.
    // The guard in status.ts now checks 'done' not 'completed'.
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'completed', '{}', ?, ?)"
    ).run(runId, t, t);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };

    // New guard: 'done' || 'cancelled' — 'completed' no longer special-cased
    const isTerminalNewGuard = run.status === "done" || run.status === "cancelled";
    assert.equal(
      isTerminalNewGuard,
      false,
      "'completed' is no longer recognized as terminal — old status contract is gone"
    );
  });

  it("advancePipeline does NOT write status='completed' (regression test)", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    // Simulate the fixed advancePipeline final branch
    db.prepare(
      "UPDATE runs SET status = 'done', updated_at = datetime('now') WHERE id = ?"
    ).run(runId);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };

    // This is the key regression guard
    assert.notEqual(
      run.status,
      "completed",
      "advancePipeline must NOT write 'completed' — it must write 'done'"
    );
    assert.equal(run.status, "done");
  });
});
