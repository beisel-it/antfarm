import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { retryRunStep, retryRunStory } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Dashboard retry flow ensures crons before re-queueing", () => {
  it("ensures workflow crons before retrying a failed step", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const runId = "retry-step-run";
    const stepId = "retry-step-db-id";
    const ensureGate = deferred<void>();
    const ensureCalled = deferred<void>();
    const workflowIds: string[] = [];

    db.prepare("DELETE FROM steps WHERE id = ?").run(stepId);
    db.prepare("DELETE FROM runs WHERE id = ?").run(runId);
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?)"
    ).run(runId, 1, "feature-dev", "retry step", "failed", now, now);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, ?, ?, 0, '', '', ?, ?, 2, 2, ?, ?)"
    ).run(stepId, runId, "implement", "feature-dev_developer", "failed", "boom", now, now);

    const retryPromise = retryRunStep(runId, stepId, {
      ensureWorkflowCrons: async (workflow) => {
        workflowIds.push(workflow.id);
        const stepBefore = db.prepare("SELECT status FROM steps WHERE id = ?").get(stepId) as { status: string };
        const runBefore = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
        assert.equal(stepBefore.status, "failed");
        assert.equal(runBefore.status, "failed");
        ensureCalled.resolve();
        await ensureGate.promise;
      },
    });

    await ensureCalled.promise;

    const stepPending = db.prepare("SELECT status, retry_count, output FROM steps WHERE id = ?").get(stepId) as { status: string; retry_count: number; output: string | null };
    const runPending = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(stepPending.status, "failed");
    assert.equal(stepPending.retry_count, 2);
    assert.equal(stepPending.output, "boom");
    assert.equal(runPending.status, "failed");

    ensureGate.resolve();
    assert.equal(await retryPromise, true);
    assert.deepEqual(workflowIds, ["feature-dev"]);

    const stepAfter = db.prepare("SELECT status, retry_count, output FROM steps WHERE id = ?").get(stepId) as { status: string; retry_count: number; output: string | null };
    const runAfter = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(stepAfter.status, "pending");
    assert.equal(stepAfter.retry_count, 0);
    assert.equal(stepAfter.output, null);
    assert.equal(runAfter.status, "running");
  });

  it("ensures workflow crons before retrying a failed story", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const runId = "retry-story-run";
    const stepId = "retry-story-loop-step";
    const storyId = "retry-story-db-id";
    const ensureGate = deferred<void>();
    const ensureCalled = deferred<void>();
    const workflowIds: string[] = [];

    db.prepare("DELETE FROM stories WHERE id = ?").run(storyId);
    db.prepare("DELETE FROM steps WHERE id = ?").run(stepId);
    db.prepare("DELETE FROM runs WHERE id = ?").run(runId);
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?)"
    ).run(runId, 2, "feature-dev", "retry story", "failed", now, now);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count, max_retries, type, current_story_id, created_at, updated_at) VALUES (?, ?, ?, ?, 0, '', '', ?, 1, 2, 'loop', ?, ?, ?)"
    ).run(stepId, runId, "implement", "feature-dev_developer", "failed", storyId, now, now);
    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, ?, ?, '', '[]', ?, 2, 2, ?, ?)"
    ).run(storyId, runId, "US-001", "Retry story", "failed", now, now);

    const retryPromise = retryRunStory(runId, storyId, {
      ensureWorkflowCrons: async (workflow) => {
        workflowIds.push(workflow.id);
        const storyBefore = db.prepare("SELECT status, retry_count FROM stories WHERE id = ?").get(storyId) as { status: string; retry_count: number };
        const loopBefore = db.prepare("SELECT status, current_story_id FROM steps WHERE id = ?").get(stepId) as { status: string; current_story_id: string | null };
        const runBefore = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
        assert.equal(storyBefore.status, "failed");
        assert.equal(storyBefore.retry_count, 2);
        assert.equal(loopBefore.status, "failed");
        assert.equal(loopBefore.current_story_id, storyId);
        assert.equal(runBefore.status, "failed");
        ensureCalled.resolve();
        await ensureGate.promise;
      },
    });

    await ensureCalled.promise;

    const storyPending = db.prepare("SELECT status, retry_count FROM stories WHERE id = ?").get(storyId) as { status: string; retry_count: number };
    const loopPending = db.prepare("SELECT status, current_story_id FROM steps WHERE id = ?").get(stepId) as { status: string; current_story_id: string | null };
    const runPending = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(storyPending.status, "failed");
    assert.equal(storyPending.retry_count, 2);
    assert.equal(loopPending.status, "failed");
    assert.equal(loopPending.current_story_id, storyId);
    assert.equal(runPending.status, "failed");

    ensureGate.resolve();
    assert.equal(await retryPromise, true);
    assert.deepEqual(workflowIds, ["feature-dev"]);

    const storyAfter = db.prepare("SELECT status, retry_count FROM stories WHERE id = ?").get(storyId) as { status: string; retry_count: number };
    const loopAfter = db.prepare("SELECT status, current_story_id FROM steps WHERE id = ?").get(stepId) as { status: string; current_story_id: string | null };
    const runAfter = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(storyAfter.status, "pending");
    assert.equal(storyAfter.retry_count, 0);
    assert.equal(loopAfter.status, "pending");
    assert.equal(loopAfter.current_story_id, null);
    assert.equal(runAfter.status, "running");
  });
});
