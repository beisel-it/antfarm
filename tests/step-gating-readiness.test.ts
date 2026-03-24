import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../src/db.ts";
import { advancePipeline, claimStep } from "../dist/installer/step-ops.js";

function now(): string {
  return new Date().toISOString();
}

describe("step gating readiness", () => {
  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM stories").run();
    db.prepare("DELETE FROM steps").run();
    db.prepare("DELETE FROM runs").run();
  });

  it("does not advance a waiting step to pending until its template inputs exist", () => {
    const db = getDb();
    const runId = crypto.randomUUID();
    const testStepId = crypto.randomUUID();
    const nowIso = now();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, 'feature-dev', 'gating test', 'running', ?, ?, ?)"
    ).run(runId, 1, JSON.stringify({ repo: "/tmp/repo", branch: "feat/gating" }), nowIso, nowIso);

    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'test', 'feature-dev_tester', 4, 'CHANGES: {{changes}}\nPR: {{pr}}', 'STATUS: done', 'waiting', ?, ?)"
    ).run(testStepId, runId, nowIso, nowIso);

    const firstAdvance = advancePipeline(runId);
    assert.deepEqual(firstAdvance, { advanced: false, runCompleted: false });

    let step = db.prepare("SELECT status FROM steps WHERE id = ?").get(testStepId) as { status: string };
    assert.equal(step.status, "waiting");

    db.prepare("UPDATE runs SET context = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify({ repo: "/tmp/repo", branch: "feat/gating", changes: "Implemented flow", pr: "https://example.test/pr/1" }),
      now(),
      runId,
    );

    const secondAdvance = advancePipeline(runId);
    assert.deepEqual(secondAdvance, { advanced: true, runCompleted: false });

    step = db.prepare("SELECT status FROM steps WHERE id = ?").get(testStepId) as { status: string };
    assert.equal(step.status, "pending");
  });

  it("does not let verifier claim a pending step before CHANGES exists", () => {
    const db = getDb();
    const runId = crypto.randomUUID();
    const implementStepId = crypto.randomUUID();
    const verifyStepId = crypto.randomUUID();
    const storyRowId = crypto.randomUUID();
    const nowIso = now();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, 'feature-dev', 'verify gating test', 'running', ?, ?, ?)"
    ).run(runId, 1, JSON.stringify({ task: 'verify gating test', repo: '/tmp/repo', branch: 'feat/gating', test_cmd: 'npm test' }), nowIso, nowIso);

    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, current_story_id, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_developer', 2, 'Implement {{current_story}}', 'STATUS: done, CHANGES, TESTS', 'running', 'loop', ?, ?, ?, ?)"
    ).run(implementStepId, runId, JSON.stringify({ over: 'stories', verifyEach: true, verifyStep: 'verify' }), storyRowId, nowIso, nowIso);

    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'verify', 'feature-dev_verifier', 3, 'Verify {{current_story}}\nCHANGES: {{changes}}\nTEST_CMD: {{test_cmd}}', 'STATUS: done', 'pending', ?, ?)"
    ).run(verifyStepId, runId, nowIso, nowIso);

    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, created_at, updated_at) VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'running', ?, ?)"
    ).run(storyRowId, runId, nowIso, nowIso);

    const blocked = claimStep('feature-dev_verifier', 'session-missing-changes');
    assert.equal(blocked.found, false);

    let verifyStep = db.prepare("SELECT status FROM steps WHERE id = ?").get(verifyStepId) as { status: string };
    assert.equal(verifyStep.status, 'waiting');

    db.prepare("UPDATE runs SET context = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify({
        task: 'verify gating test',
        repo: '/tmp/repo',
        branch: 'feat/gating',
        test_cmd: 'npm test',
        changes: 'Implemented Story 1',
        current_story: 'S-1: Story 1',
      }),
      now(),
      runId,
    );
    db.prepare("UPDATE steps SET status = 'pending', updated_at = ? WHERE id = ?").run(now(), verifyStepId);

    const claimed = claimStep('feature-dev_verifier', 'session-ready');
    assert.equal(claimed.found, true);
    assert.match(claimed.resolvedInput ?? '', /Implemented Story 1/);

    verifyStep = db.prepare("SELECT status FROM steps WHERE id = ?").get(verifyStepId) as { status: string };
    assert.equal(verifyStep.status, 'running');
  });
});
