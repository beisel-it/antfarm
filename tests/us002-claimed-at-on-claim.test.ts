/**
 * US-002: Set claimed_at when a step is claimed
 *
 * Tests that:
 * 1. After claimStep() is called for a single step, the step row has a non-NULL claimed_at timestamp
 * 2. claimed_at is set to approximately the current UTC time
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/db.ts";
import { claimStep } from "../dist/installer/step-ops.js";

function seedRunAndStep(db: ReturnType<typeof getDb>, runId: string, stepId: string, agentId: string): void {
  const now = new Date().toISOString();
  db.exec(`
    INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
    VALUES ('${runId}', 'wf-test', 'test task', 'running', '{}', '${now}', '${now}')
  `);
  db.exec(`
    INSERT OR REPLACE INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at)
    VALUES
      ('${stepId}', '${runId}', 'step-1', '${agentId}', 0, 'hello', '[]', 'pending', '${now}', '${now}')
  `);
}

describe("US-002: Set claimed_at when a step is claimed", () => {
  test("claimStep() sets claimed_at to a non-NULL value on the step row", () => {
    const db = getDb(); // getDb() calls migrate() internally

    const runId = "us002-claim-run-1";
    const stepId = "us002-claim-step-1";
    const agentId = "test-agent-us002";

    seedRunAndStep(db, runId, stepId, agentId);

    const before = Date.now();
    const result = claimStep(agentId, "test-session-key");
    const after = Date.now();

    assert.ok(result.found, "claimStep should find the pending step");
    assert.equal(result.stepId, stepId, "claimStep should return the correct stepId");

    const row = db.prepare(
      "SELECT status, claimed_at FROM steps WHERE id = ?"
    ).get(stepId) as { status: string; claimed_at: string | null };

    assert.equal(row.status, "running", "step status should be 'running' after claim");
    assert.ok(row.claimed_at !== null, "claimed_at should be set (non-NULL) after claimStep");

    // claimed_at should parse as a valid date and be within a reasonable window
    const claimedMs = new Date(row.claimed_at + "Z").getTime(); // SQLite datetime('now') is UTC, no Z suffix
    assert.ok(!isNaN(claimedMs), `claimed_at '${row.claimed_at}' should be a valid date`);

    // Allow up to 5 seconds of clock skew / execution time
    const slackMs = 5000;
    assert.ok(
      claimedMs >= before - slackMs,
      `claimed_at (${row.claimed_at}) should not be before the test started`
    );
    assert.ok(
      claimedMs <= after + slackMs,
      `claimed_at (${row.claimed_at}) should not be far in the future`
    );
  });

  test("finished_at remains NULL immediately after claimStep()", () => {
    const db = getDb();

    const runId = "us002-claim-run-2";
    const stepId = "us002-claim-step-2";
    const agentId = "test-agent-us002-b";

    seedRunAndStep(db, runId, stepId, agentId);

    const result = claimStep(agentId, "test-session-key-2");
    assert.ok(result.found, "claimStep should find the pending step");

    const row = db.prepare(
      "SELECT claimed_at, finished_at FROM steps WHERE id = ?"
    ).get(stepId) as { claimed_at: string | null; finished_at: string | null };

    assert.ok(row.claimed_at !== null, "claimed_at should be set after claim");
    assert.equal(row.finished_at, null, "finished_at should remain NULL right after claim");
  });

  test("step that was not claimed has NULL claimed_at", () => {
    const db = getDb();

    const runId = "us002-unclaimed-run";
    const stepId = "us002-unclaimed-step";

    const now = new Date().toISOString();
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('${runId}', 'wf-test', 'test task', 'running', '{}', '${now}', '${now}')
    `);
    db.exec(`
      INSERT OR REPLACE INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at)
      VALUES
        ('${stepId}', '${runId}', 'step-1', 'nobody', 0, 'hello', '[]', 'pending', '${now}', '${now}')
    `);

    const row = db.prepare(
      "SELECT claimed_at FROM steps WHERE id = ?"
    ).get(stepId) as { claimed_at: string | null };

    assert.equal(row.claimed_at, null, "claimed_at should be NULL for a step that has not been claimed");
  });
});
