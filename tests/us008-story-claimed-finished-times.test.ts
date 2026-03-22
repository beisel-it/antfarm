/**
 * US-008: Set claimed_at and finished_at on stories when status changes
 *
 * Tests verify:
 * 1. claimed_at is set when a story is claimed (status → running)
 * 2. finished_at is set when a story completes (status → done)
 * 3. finished_at is set when a story fails (status → failed via failStep)
 * 4. finished_at is set when a story is abandoned (status → failed via cleanupAbandonedSteps)
 * 5. finished_at remains NULL when story is reset to 'pending' on retry
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/db.ts';
import { claimStep, completeStep, failStep, cleanupAbandonedSteps } from '../dist/installer/step-ops.js';

let counter = 0;

function seed(db: ReturnType<typeof getDb>, opts: { maxRetries?: number; storyStatus?: string } = {}) {
  const idx = ++counter;
  const now = new Date().toISOString();
  const runId = `run-us008-${idx}`;
  const stepDbId = `step-us008-${idx}`;
  const agentId = `agent-us008-${idx}`;
  const storyRowId = `story-us008-${idx}`;
  const { maxRetries = 2, storyStatus = 'pending' } = opts;

  db.prepare(
    "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf-us008', 'test task', 'running', '{}', ?, ?)"
  ).run(runId, now, now);

  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, created_at, updated_at) VALUES (?, ?, 'loop-step', ?, 0, 'implement the story', '', 'pending', 'loop', '{\"over\":\"stories\"}', ?, ?)"
  ).run(stepDbId, runId, agentId, now, now);

  db.prepare(
    "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, ?, 'Test Story', 'desc', '[]', ?, 0, ?, ?, ?)"
  ).run(storyRowId, runId, `s-us008-${idx}`, storyStatus, maxRetries, now, now);

  return { runId, stepDbId, agentId, storyRowId };
}

describe('US-008: Story claimed_at/finished_at', () => {
  let db: ReturnType<typeof getDb>;

  // Each test gets its own env via the counter-based seed()

  test('claimed_at is set when story transitions to running', () => {
    db = getDb();
    const { agentId, storyRowId } = seed(db);

    const before = db.prepare("SELECT claimed_at FROM stories WHERE id = ?").get(storyRowId) as { claimed_at: string | null };
    assert.equal(before.claimed_at, null, 'claimed_at should be null before claim');

    const result = claimStep(agentId, 'session-claim');
    assert.ok(result.found, 'claimStep should find the pending loop step');

    const after = db.prepare("SELECT claimed_at FROM stories WHERE id = ?").get(storyRowId) as { claimed_at: string | null };
    assert.notEqual(after.claimed_at, null, 'claimed_at should be set after story is claimed');
  });

  test('finished_at is set when story transitions to done via completeStep', async () => {
    db = getDb();
    const { agentId, stepDbId, storyRowId } = seed(db);

    claimStep(agentId, 'session-done');

    const afterClaim = db.prepare("SELECT claimed_at, finished_at FROM stories WHERE id = ?").get(storyRowId) as { claimed_at: string | null; finished_at: string | null };
    assert.notEqual(afterClaim.claimed_at, null, 'claimed_at should be set after claim');
    assert.equal(afterClaim.finished_at, null, 'finished_at should be null before complete');

    await completeStep(stepDbId, 'output-done');

    const afterDone = db.prepare("SELECT finished_at FROM stories WHERE id = ?").get(storyRowId) as { finished_at: string | null };
    assert.notEqual(afterDone.finished_at, null, 'finished_at should be set after story completes');
  });

  test('finished_at is set when story fails via failStep (retries exhausted)', async () => {
    db = getDb();
    // max_retries=0 so the first fail exhausts retries immediately
    const { agentId, stepDbId, storyRowId } = seed(db, { maxRetries: 0 });

    claimStep(agentId, 'session-fail');

    const beforeFail = db.prepare("SELECT finished_at FROM stories WHERE id = ?").get(storyRowId) as { finished_at: string | null };
    assert.equal(beforeFail.finished_at, null);

    await failStep(stepDbId, 'story-error');

    const afterFail = db.prepare("SELECT finished_at, status FROM stories WHERE id = ?").get(storyRowId) as { finished_at: string | null; status: string };
    assert.equal(afterFail.status, 'failed', 'story status should be failed');
    assert.notEqual(afterFail.finished_at, null, 'finished_at should be set when story fails (retries exhausted)');
  });

  test('finished_at remains null when story is reset to pending on retry', async () => {
    db = getDb();
    // max_retries=2, so first fail retries (not exhausted)
    const { agentId, stepDbId, storyRowId } = seed(db, { maxRetries: 2 });

    claimStep(agentId, 'session-retry');
    await failStep(stepDbId, 'story-error');

    const afterRetry = db.prepare("SELECT finished_at, status FROM stories WHERE id = ?").get(storyRowId) as { finished_at: string | null; status: string };
    assert.equal(afterRetry.status, 'pending', 'story should be reset to pending on retry');
    assert.equal(afterRetry.finished_at, null, 'finished_at should remain null when story retries');
  });

  test('finished_at is set when story is abandoned via cleanupAbandonedSteps', () => {
    db = getDb();
    const idx = ++counter;
    // Use a very old updated_at so cleanupAbandonedSteps threshold is exceeded
    const oldTs = '2020-01-01T00:00:00.000Z';
    const now = new Date().toISOString();
    const runId = `run-us008-abandon-${idx}`;
    const stepDbId = `step-us008-abandon-${idx}`;
    const storyRowId = `story-us008-abandon-${idx}`;

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf-us008', 'test task', 'running', '{}', ?, ?)"
    ).run(runId, now, now);

    // max_retries=0 so cleanup exhausts retries immediately → story becomes failed
    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, 's-abandon', 'Abandon Story', 'desc', '[]', 'running', 0, 0, ?, ?)"
    ).run(storyRowId, runId, now, now);

    // Insert step in 'running' state with a very old updated_at so it looks abandoned
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, session_key, current_story_id, claimed_at, created_at, updated_at) VALUES (?, ?, 'loop-step-a', 'agent-a', 0, 'implement the story', '', 'running', 'loop', '{\"over\":\"stories\"}', 'stale-session', ?, datetime('now'), ?, ?)"
    ).run(stepDbId, runId, storyRowId, now, oldTs);

    const beforeCleanup = db.prepare("SELECT finished_at FROM stories WHERE id = ?").get(storyRowId) as { finished_at: string | null };
    assert.equal(beforeCleanup.finished_at, null, 'finished_at should be null before cleanup');

    cleanupAbandonedSteps();

    const afterCleanup = db.prepare("SELECT finished_at, status FROM stories WHERE id = ?").get(storyRowId) as { finished_at: string | null; status: string };
    assert.equal(afterCleanup.status, 'failed', 'story should be failed after cleanup');
    assert.notEqual(afterCleanup.finished_at, null, 'finished_at should be set when story is abandoned via cleanup');
  });
});
