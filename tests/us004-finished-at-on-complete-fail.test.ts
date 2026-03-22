/**
 * US-004: Set finished_at when a step completes or fails
 *
 * Tests that:
 * 1. After completeStep() marks a step done, finished_at is non-NULL
 * 2. After failStep() exhausts retries and marks a step failed, finished_at is non-NULL
 * 3. finished_at remains NULL on retry resets (status='pending')
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/db.ts";
import { completeStep, failStep } from "../dist/installer/step-ops.js";

/**
 * Seed a minimal run with a single running step.
 * The step has no special type (single step), max_retries=1 by default.
 */
function seedRunWithRunningStep(
  db: ReturnType<typeof getDb>,
  runId: string,
  stepDbId: string,
  stepStepId: string,
  agentId: string,
  maxRetries = 1
): void {
  const now = new Date().toISOString();
  db.exec(`
    INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
    VALUES ('${runId}', 'wf-us004', 'test task', 'running', '{}', '${now}', '${now}')
  `);
  db.exec(`
    INSERT OR REPLACE INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status,
       retry_count, max_retries, claimed_at, created_at, updated_at)
    VALUES
      ('${stepDbId}', '${runId}', '${stepStepId}', '${agentId}', 0,
       'do the work', '', 'running',
       0, ${maxRetries}, '${now}', '${now}', '${now}')
  `);
}

describe("US-004: Set finished_at when a step completes or fails", () => {
  test("completeStep() sets finished_at to a non-NULL value", () => {
    const db = getDb(); // triggers migrate() internally

    const runId = "us004-complete-run-1";
    const stepDbId = "us004-complete-step-1";
    const stepStepId = "step-us004-complete-1";
    const agentId = "agent-us004-a";

    seedRunWithRunningStep(db, runId, stepDbId, stepStepId, agentId);

    const before = Date.now();
    completeStep(stepDbId, "STATUS: done\nCHANGES: all good");
    const after = Date.now();

    const row = db.prepare(
      "SELECT status, finished_at FROM steps WHERE id = ?"
    ).get(stepDbId) as { status: string; finished_at: string | null };

    assert.equal(row.status, "done", "step status should be 'done' after completeStep");
    assert.ok(row.finished_at !== null, "finished_at should be non-NULL after completeStep");

    const finishedMs = new Date(row.finished_at + "Z").getTime();
    assert.ok(!isNaN(finishedMs), `finished_at '${row.finished_at}' should be a valid date`);

    const slackMs = 5000;
    assert.ok(
      finishedMs >= before - slackMs,
      `finished_at (${row.finished_at}) should not be before the test started`
    );
    assert.ok(
      finishedMs <= after + slackMs,
      `finished_at (${row.finished_at}) should not be far in the future`
    );
  });

  test("failStep() sets finished_at when retries are exhausted (terminal failure)", async () => {
    const db = getDb();

    const runId = "us004-fail-run-1";
    const stepDbId = "us004-fail-step-1";
    const stepStepId = "step-us004-fail-1";
    const agentId = "agent-us004-b";

    // max_retries = 0 so the first failure is terminal
    seedRunWithRunningStep(db, runId, stepDbId, stepStepId, agentId, 0);

    const before = Date.now();
    const result = await failStep(stepDbId, "something went wrong");
    const after = Date.now();

    assert.equal(result.retrying, false, "should not be retrying when retries exhausted");
    assert.equal(result.runFailed, true, "run should be marked failed");

    const row = db.prepare(
      "SELECT status, finished_at FROM steps WHERE id = ?"
    ).get(stepDbId) as { status: string; finished_at: string | null };

    assert.equal(row.status, "failed", "step status should be 'failed' after exhausting retries");
    assert.ok(row.finished_at !== null, "finished_at should be non-NULL after terminal failure");

    const finishedMs = new Date(row.finished_at + "Z").getTime();
    assert.ok(!isNaN(finishedMs), `finished_at '${row.finished_at}' should be a valid date`);

    const slackMs = 5000;
    assert.ok(
      finishedMs >= before - slackMs,
      `finished_at (${row.finished_at}) should not be before the test started`
    );
    assert.ok(
      finishedMs <= after + slackMs,
      `finished_at (${row.finished_at}) should not be far in the future`
    );
  });

  test("failStep() does NOT set finished_at on a retry reset (status returns to pending)", async () => {
    const db = getDb();

    const runId = "us004-retry-run-1";
    const stepDbId = "us004-retry-step-1";
    const stepStepId = "step-us004-retry-1";
    const agentId = "agent-us004-c";

    // max_retries = 2 so first failure triggers a retry
    seedRunWithRunningStep(db, runId, stepDbId, stepStepId, agentId, 2);

    const result = await failStep(stepDbId, "transient error, will retry");

    assert.equal(result.retrying, true, "should be retrying (not at max_retries yet)");
    assert.equal(result.runFailed, false, "run should not be failed while retrying");

    const row = db.prepare(
      "SELECT status, finished_at FROM steps WHERE id = ?"
    ).get(stepDbId) as { status: string; finished_at: string | null };

    assert.equal(row.status, "pending", "step status should be 'pending' on retry reset");
    assert.equal(row.finished_at, null, "finished_at should remain NULL on retry reset (not a terminal state)");
  });

  test("claimed_at is preserved and finished_at is set correctly after complete", () => {
    const db = getDb();

    const runId = "us004-preserve-run-1";
    const stepDbId = "us004-preserve-step-1";
    const stepStepId = "step-us004-preserve-1";
    const agentId = "agent-us004-d";

    seedRunWithRunningStep(db, runId, stepDbId, stepStepId, agentId);

    completeStep(stepDbId, "STATUS: done\nCHANGES: implemented feature");

    const row = db.prepare(
      "SELECT status, claimed_at, finished_at FROM steps WHERE id = ?"
    ).get(stepDbId) as { status: string; claimed_at: string | null; finished_at: string | null };

    assert.equal(row.status, "done");
    assert.ok(row.claimed_at !== null, "claimed_at should be preserved after completion");
    assert.ok(row.finished_at !== null, "finished_at should be set after completion");
  });
});
