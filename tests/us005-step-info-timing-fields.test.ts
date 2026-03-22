/**
 * US-005: Expose claimed_at and finished_at in StepInfo type and CLI status output
 *
 * Tests:
 * 1. StepInfo type has claimed_at and finished_at fields (compile-time check via assignment)
 * 2. getWorkflowStatus returns claimed_at and finished_at from DB rows
 * 3. Null claimed_at/finished_at values are returned as null (not undefined)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/db.ts";
import { getWorkflowStatus, type StepInfo } from "../dist/installer/status.js";

// Compile-time check: StepInfo must have claimed_at and finished_at
function _typeCheck(step: StepInfo) {
  const _claimed: string | null = step.claimed_at;
  const _finished: string | null = step.finished_at;
  void _claimed;
  void _finished;
}

function seedRun(db: ReturnType<typeof getDb>, runId: string) {
  db.prepare(
    `INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at)
     VALUES (?, 9001, 'wf-test', 'Test task US-005', 'running', '{}', datetime('now'), datetime('now'))`
  ).run(runId);
}

function seedStep(db: ReturnType<typeof getDb>, runId: string, stepId: string, opts: {
  claimed_at?: string | null;
  finished_at?: string | null;
  status?: string;
}) {
  db.prepare(
    `INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status,
       output, retry_count, max_retries, type, loop_config, claimed_at, finished_at, created_at, updated_at)
     VALUES (?, ?, ?, 'test-agent', 0, 'do the thing', 'result', ?,
       NULL, 0, 3, 'single', NULL, ?, ?, datetime('now'), datetime('now'))`
  ).run(stepId, runId, 'test-step', opts.status ?? 'pending', opts.claimed_at ?? null, opts.finished_at ?? null);
}

test("StepInfo returned by getWorkflowStatus includes claimed_at and finished_at", () => {
  const db = getDb();
  const runId = `run-us005-${Date.now()}`;
  const stepId = `step-${Date.now()}`;
  seedRun(db, runId);
  seedStep(db, runId, stepId, {
    claimed_at: "2026-03-22 10:00:00",
    finished_at: "2026-03-22 10:05:00",
    status: "done",
  });

  const result = getWorkflowStatus(runId);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("not ok");

  const step = result.steps[0];
  assert.ok(step, "step should exist");
  assert.equal(step.claimed_at, "2026-03-22 10:00:00");
  assert.equal(step.finished_at, "2026-03-22 10:05:00");
});

test("StepInfo with null claimed_at and finished_at returns null (not undefined)", () => {
  const db = getDb();
  const runId = `run-us005-null-${Date.now()}`;
  const stepId = `step-null-${Date.now()}`;
  seedRun(db, runId);
  seedStep(db, runId, stepId, {
    claimed_at: null,
    finished_at: null,
    status: "pending",
  });

  const result = getWorkflowStatus(runId);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("not ok");

  const step = result.steps[0];
  assert.ok(step, "step should exist");
  // SQLite returns null for NULL columns; must not be the string "null" or "undefined"
  assert.equal(step.claimed_at, null, "claimed_at should be null, not a string");
  assert.equal(step.finished_at, null, "finished_at should be null, not a string");
});

test("getWorkflowStatus returns partial timing when only claimed_at is set", () => {
  const db = getDb();
  const runId = `run-us005-partial-${Date.now()}`;
  const stepId = `step-partial-${Date.now()}`;
  seedRun(db, runId);
  seedStep(db, runId, stepId, {
    claimed_at: "2026-03-22 11:00:00",
    finished_at: null,
    status: "running",
  });

  const result = getWorkflowStatus(runId);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") throw new Error("not ok");

  const step = result.steps[0];
  assert.ok(step, "step should exist");
  assert.equal(step.claimed_at, "2026-03-22 11:00:00");
  assert.equal(step.finished_at, null);
});
