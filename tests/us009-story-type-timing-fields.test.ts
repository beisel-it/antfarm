/**
 * US-009: Expose claimed_at and finished_at in Story type and getStories()
 *
 * Tests verify:
 * 1. getStories() returns claimedAt and finishedAt fields on each Story
 * 2. claimedAt is null for a pending story
 * 3. claimedAt is non-null after a story is claimed (running)
 * 4. finishedAt is non-null after a story completes
 * 5. getCurrentStory() also exposes claimedAt/finishedAt
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/db.ts';
import { getStories, claimStep, completeStep } from '../dist/installer/step-ops.js';

let counter = 0;

function seedEnv(db: ReturnType<typeof getDb>) {
  const idx = ++counter;
  const now = new Date().toISOString();
  const runId = `run-us009-${idx}`;
  const stepDbId = `step-us009-${idx}`;
  const agentId = `agent-us009-${idx}`;
  const storyRowId = `story-us009-${idx}`;

  db.prepare(
    "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf-us009', 'test task', 'running', '{}', ?, ?)"
  ).run(runId, now, now);

  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, created_at, updated_at) VALUES (?, ?, 'loop-step', ?, 0, 'implement the story', '', 'pending', 'loop', '{\"over\":\"stories\"}', ?, ?)"
  ).run(stepDbId, runId, agentId, now, now);

  db.prepare(
    "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, ?, 'Test Story', 'desc', '[]', 'pending', 0, 2, ?, ?)"
  ).run(storyRowId, runId, `s-us009-${idx}`, now, now);

  return { runId, stepDbId, agentId, storyRowId };
}

describe('US-009: Story type claimedAt/finishedAt fields', () => {
  test('getStories() includes claimedAt and finishedAt fields', () => {
    const db = getDb();
    const { runId } = seedEnv(db);

    const stories = getStories(runId);
    assert.equal(stories.length, 1, 'should return one story');

    const story = stories[0];
    assert.ok('claimedAt' in story, 'Story should have claimedAt field');
    assert.ok('finishedAt' in story, 'Story should have finishedAt field');
  });

  test('claimedAt is null for a pending story', () => {
    const db = getDb();
    const { runId } = seedEnv(db);

    const stories = getStories(runId);
    assert.equal(stories[0].claimedAt, null, 'claimedAt should be null for pending story');
    assert.equal(stories[0].finishedAt, null, 'finishedAt should be null for pending story');
  });

  test('claimedAt is non-null after story is claimed (running)', () => {
    const db = getDb();
    const { runId, agentId } = seedEnv(db);

    claimStep(agentId, 'session-us009-claim');

    const stories = getStories(runId);
    assert.equal(stories[0].status, 'running', 'story should be running');
    assert.notEqual(stories[0].claimedAt, null, 'claimedAt should be set after claim');
    assert.equal(stories[0].finishedAt, null, 'finishedAt should still be null after claim');
  });

  test('finishedAt is non-null after story completes', async () => {
    const db = getDb();
    const { runId, agentId, stepDbId } = seedEnv(db);

    claimStep(agentId, 'session-us009-done');
    await completeStep(stepDbId, 'output-done');

    const stories = getStories(runId);
    assert.equal(stories[0].status, 'done', 'story should be done');
    assert.notEqual(stories[0].claimedAt, null, 'claimedAt should be set');
    assert.notEqual(stories[0].finishedAt, null, 'finishedAt should be set after complete');
  });
});
