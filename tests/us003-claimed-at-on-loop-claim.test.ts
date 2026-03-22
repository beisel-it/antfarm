/**
 * US-003: Set claimed_at when a loop step claims a story
 *
 * Tests that:
 * 1. After claimStep() is called for a loop step with pending stories, the step row has a non-NULL claimed_at timestamp
 * 2. claimed_at is set to approximately the current UTC time
 * 3. finished_at remains NULL after claiming (not done yet)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../src/db.ts";
import { claimStep } from "../dist/installer/step-ops.js";

function seedLoopStepWithStory(
  db: ReturnType<typeof getDb>,
  runId: string,
  stepId: string,
  agentId: string
): void {
  const now = new Date().toISOString();

  db.exec(`
    INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
    VALUES ('${runId}', 'wf-loop-test', 'loop task', 'running', '{}', '${now}', '${now}')
  `);

  // Insert a loop step with loop_config = {"over":"stories"}
  // Use a plain input_template with no template vars to avoid missing-key failures.
  db.exec(`
    INSERT OR REPLACE INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, created_at, updated_at)
    VALUES
      ('${stepId}', '${runId}', 'loop-step-1', '${agentId}', 0, 'implement the story', '[]', 'pending', 'loop', '{"over":"stories"}', '${now}', '${now}')
  `);

  // Insert a pending story for the loop to claim
  const storyId = `story-${stepId}`;
  db.exec(`
    INSERT OR REPLACE INTO stories
      (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at)
    VALUES
      ('${storyId}', '${runId}', 0, 'US-T01', 'Test Story', 'A story for testing', '["criteria 1"]', 'pending', 0, 2, '${now}', '${now}')
  `);
}

describe("US-003: Set claimed_at when a loop step claims a story", () => {
  test("claimStep() sets claimed_at to a non-NULL value when claiming a loop story", () => {
    const db = getDb(); // triggers migrate() internally

    const runId = "us003-loop-run-1";
    const stepId = "us003-loop-step-1";
    const agentId = "test-agent-us003-a";

    seedLoopStepWithStory(db, runId, stepId, agentId);

    const before = Date.now();
    const result = claimStep(agentId, "test-session-us003");
    const after = Date.now();

    assert.ok(result.found, "claimStep should find the pending loop step");

    const row = db.prepare(
      "SELECT status, claimed_at, finished_at FROM steps WHERE id = ?"
    ).get(stepId) as { status: string; claimed_at: string | null; finished_at: string | null };

    assert.equal(row.status, "running", "loop step status should be 'running' after claiming a story");
    assert.ok(row.claimed_at !== null, "claimed_at should be set (non-NULL) when loop step claims a story");

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

  test("finished_at remains NULL after loop step claims a story (not done yet)", () => {
    const db = getDb();

    const runId = "us003-loop-run-2";
    const stepId = "us003-loop-step-2";
    const agentId = "test-agent-us003-b";

    seedLoopStepWithStory(db, runId, stepId, agentId);

    const result = claimStep(agentId, "test-session-us003-b");
    assert.ok(result.found, "claimStep should find the pending loop step");

    const row = db.prepare(
      "SELECT claimed_at, finished_at FROM steps WHERE id = ?"
    ).get(stepId) as { claimed_at: string | null; finished_at: string | null };

    assert.ok(row.claimed_at !== null, "claimed_at should be set after loop claim");
    assert.equal(row.finished_at, null, "finished_at should remain NULL after claiming (step not done yet)");
  });

  test("loop step without pending stories does NOT set claimed_at (returns not found)", () => {
    const db = getDb();

    const runId = "us003-loop-run-3";
    const stepId = "us003-loop-step-3";
    const agentId = "test-agent-us003-c";
    const now = new Date().toISOString();

    // Set up a run + loop step with NO stories
    db.exec(`
      INSERT OR REPLACE INTO runs (id, workflow_id, task, status, context, created_at, updated_at)
      VALUES ('${runId}', 'wf-loop-test', 'loop task no stories', 'running', '{}', '${now}', '${now}')
    `);
    db.exec(`
      INSERT OR REPLACE INTO steps
        (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, created_at, updated_at)
      VALUES
        ('${stepId}', '${runId}', 'loop-step-3', '${agentId}', 0, 'hello', '[]', 'pending', 'loop', '{"over":"stories"}', '${now}', '${now}')
    `);

    // No stories inserted — loop step should fail immediately (no stories for loop)
    const result = claimStep(agentId, "test-session-us003-c");

    // When there are no stories, claimStep fails the loop step
    assert.equal(result.found, false, "claimStep should return not found when no stories exist");

    // The step should be failed, not running — claimed_at should remain NULL (no claim happened)
    const row = db.prepare(
      "SELECT status, claimed_at FROM steps WHERE id = ?"
    ).get(stepId) as { status: string; claimed_at: string | null };

    assert.equal(row.status, "failed", "loop step should be failed when no stories exist");
    assert.equal(row.claimed_at, null, "claimed_at should remain NULL when loop step cannot claim any story");
  });
});
