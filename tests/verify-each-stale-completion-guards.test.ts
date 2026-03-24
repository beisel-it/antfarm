import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../src/db.ts";
import { claimStep, completeStep } from "../dist/installer/step-ops.js";

function seedVerifyEachRun() {
  const db = getDb();
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const implementId = crypto.randomUUID();
  const verifyId = crypto.randomUUID();
  const testId = crypto.randomUUID();
  const storyRowId = crypto.randomUUID();

  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, 'feature-dev', ?, 'running', '{}', ?, ?)"
  ).run(runId, 1, 'verify_each repro', now, now);

  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_developer', 1, 'Implement {{current_story}}', 'STATUS: done, CHANGES', 'pending', 'loop', ?, ?, ?)"
  ).run(implementId, runId, JSON.stringify({ over: 'stories', verifyEach: true, verifyStep: 'verify' }), now, now);

  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'verify', 'feature-dev_verifier', 2, 'Verify {{current_story}}', 'STATUS', 'waiting', ?, ?)"
  ).run(verifyId, runId, now, now);

  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'test', 'feature-dev_tester', 3, 'Test {{changes}}', 'STATUS', 'waiting', ?, ?)"
  ).run(testId, runId, now, now);

  db.prepare(
    "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, 'US-002', 'Catalog facets', 'desc', '[\"Tests pass\"]', 'pending', 0, 2, ?, ?)"
  ).run(storyRowId, runId, now, now);

  return { runId, implementId, verifyId, testId, storyRowId };
}

describe('verify_each stale completion guards', () => {
  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM stories').run();
    db.prepare('DELETE FROM steps').run();
    db.prepare('DELETE FROM runs').run();
  });

  it('ignores stale implement completion after verifier has reset the loop step to pending', () => {
    const db = getDb();
    const { runId, implementId, verifyId, testId } = seedVerifyEachRun();

    const claimedImplement = claimStep('feature-dev_developer', 'dev-session-1');
    assert.equal(claimedImplement.found, true);

    completeStep(implementId, 'STATUS: done\nCHANGES: implemented facets');

    let implement = db.prepare('SELECT status, current_story_id FROM steps WHERE id = ?').get(implementId) as { status: string; current_story_id: string | null };
    let verify = db.prepare('SELECT status FROM steps WHERE id = ?').get(verifyId) as { status: string };
    let test = db.prepare('SELECT status FROM steps WHERE id = ?').get(testId) as { status: string };
    assert.equal(implement.status, 'running');
    assert.equal(verify.status, 'pending');
    assert.equal(test.status, 'waiting');

    const claimedVerify = claimStep('feature-dev_verifier', 'verify-session-1');
    assert.equal(claimedVerify.found, true);

    completeStep(verifyId, 'STATUS: done');

    implement = db.prepare('SELECT status, current_story_id, finished_at FROM steps WHERE id = ?').get(implementId) as { status: string; current_story_id: string | null; finished_at: string | null };
    verify = db.prepare('SELECT status, finished_at FROM steps WHERE id = ?').get(verifyId) as { status: string; finished_at: string | null };
    test = db.prepare('SELECT status FROM steps WHERE id = ?').get(testId) as { status: string };
    assert.equal(implement.status, 'done');
    assert.equal(implement.current_story_id, null);
    assert.ok(implement.finished_at, 'implement loop should be fully done after the only story verifies');
    assert.equal(verify.status, 'done');
    assert.ok(verify.finished_at, 'verify step should be marked done after final story verification');
    assert.equal(test.status, 'pending');

    const replay = completeStep(implementId, 'STATUS: done\nCHANGES: stale duplicate');
    assert.deepEqual(replay, { advanced: false, runCompleted: false });

    implement = db.prepare('SELECT status, current_story_id FROM steps WHERE id = ?').get(implementId) as { status: string; current_story_id: string | null };
    verify = db.prepare('SELECT status FROM steps WHERE id = ?').get(verifyId) as { status: string };
    test = db.prepare('SELECT status FROM steps WHERE id = ?').get(testId) as { status: string };

    assert.equal(implement.status, 'done');
    assert.equal(implement.current_story_id, null);
    assert.equal(verify.status, 'done');
    assert.equal(test.status, 'pending');

    const story = db.prepare('SELECT status FROM stories WHERE run_id = ?').get(runId) as { status: string };
    assert.equal(story.status, 'done');
  });

  it('ignores stale verifier completion after the verify step has been reset to waiting', () => {
    const db = getDb();
    const { runId, implementId, verifyId, testId } = seedVerifyEachRun();

    db.prepare("INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 1, 'US-003', 'Another story', 'desc', '[\"Tests pass\"]', 'pending', 0, 2, ?, ?)")
      .run(crypto.randomUUID(), runId, new Date().toISOString(), new Date().toISOString());

    const claimedImplement = claimStep('feature-dev_developer', 'dev-session-1');
    assert.equal(claimedImplement.found, true);
    completeStep(implementId, 'STATUS: done\nCHANGES: implemented first story');

    const claimedVerify = claimStep('feature-dev_verifier', 'verify-session-1');
    assert.equal(claimedVerify.found, true);
    completeStep(verifyId, 'STATUS: done');

    let implement = db.prepare('SELECT status FROM steps WHERE id = ?').get(implementId) as { status: string };
    let verify = db.prepare('SELECT status FROM steps WHERE id = ?').get(verifyId) as { status: string };
    let test = db.prepare('SELECT status FROM steps WHERE id = ?').get(testId) as { status: string };
    assert.equal(implement.status, 'pending', 'next story should reactivate the loop step');
    assert.equal(verify.status, 'waiting', 'verify step should be parked until next story is ready');
    assert.equal(test.status, 'waiting', 'downstream step must not advance yet because more stories remain');

    const replay = completeStep(verifyId, 'STATUS: done');
    assert.deepEqual(replay, { advanced: false, runCompleted: false });

    implement = db.prepare('SELECT status FROM steps WHERE id = ?').get(implementId) as { status: string };
    verify = db.prepare('SELECT status FROM steps WHERE id = ?').get(verifyId) as { status: string };
    test = db.prepare('SELECT status FROM steps WHERE id = ?').get(testId) as { status: string };
    const stories = db.prepare('SELECT story_id, status FROM stories WHERE run_id = ? ORDER BY story_index ASC').all(runId) as { story_id: string; status: string }[];

    assert.equal(implement.status, 'pending');
    assert.equal(verify.status, 'waiting');
    assert.equal(test.status, 'waiting');
    assert.deepEqual(stories.map((story) => [story.story_id, story.status]), [
      ['US-002', 'done'],
      ['US-003', 'pending'],
    ]);
  });
});
