import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../src/db.ts";
import { completeStep } from "../dist/installer/step-ops.js";

function seedRunningStep(expects: string): { runId: string; stepId: string } {
  const db = getDb();
  const runId = crypto.randomUUID();
  const stepId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(runId, 1, "feature-dev", "planner validation", "running", "{}", now, now);

  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(stepId, runId, "plan", "feature-dev_planner", 0, "", expects, "running", now, now);

  return { runId, stepId };
}

describe("step output validation", () => {
  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM stories").run();
    db.prepare("DELETE FROM steps").run();
    db.prepare("DELETE FROM runs").run();
  });

  it("rejects planner completion when STORIES_JSON is missing", () => {
    const { stepId } = seedRunningStep("STATUS: done, STORIES_JSON");

    assert.throws(
      () => completeStep(stepId, "STATUS: done"),
      /missing required keys: stories_json/i
    );
  });

  it("rejects planner completion when STORIES_JSON is not parseable JSON", () => {
    const { stepId } = seedRunningStep("STATUS: done, STORIES_JSON");

    assert.throws(
      () => completeStep(stepId, "STATUS: done\nSTORIES_JSON: [not valid json]"),
      /stories_json is not parseable json/i
    );
  });

  it("accepts planner completion with valid STORIES_JSON array", () => {
    const db = getDb();
    const { runId, stepId } = seedRunningStep("STATUS: done, STORIES_JSON");

    completeStep(stepId, [
      "STATUS: done",
      "STORIES_JSON: [",
      '  {"id":"S-1","title":"Add guard","description":"Tighten validation","acceptanceCriteria":["Typecheck passes"]}',
      "]",
    ].join("\n"));

    const stories = db.prepare("SELECT story_id, title FROM stories WHERE run_id = ?").all(runId) as { story_id: string; title: string }[];
    assert.equal(stories.length, 1);
    assert.equal(stories[0]?.story_id, "S-1");
    assert.equal(stories[0]?.title, "Add guard");
  });

  it("does not insert duplicate stories when planner completion is replayed", () => {
    const db = getDb();
    const { runId, stepId } = seedRunningStep("STATUS: done, STORIES_JSON");
    const output = [
      "STATUS: done",
      "STORIES_JSON: [",
      '  {"id":"S-1","title":"Add guard","description":"Tighten validation","acceptanceCriteria":["Typecheck passes"]}',
      '  ,{"id":"S-2","title":"Add tests","description":"Cover the path","acceptanceCriteria":["Tests pass"]}',
      "]",
    ].join("\n");

    completeStep(stepId, output);
    completeStep(stepId, output);

    const stories = db.prepare(
      "SELECT story_id, title, status FROM stories WHERE run_id = ? ORDER BY story_index ASC"
    ).all(runId) as { story_id: string; title: string; status: string }[];
    assert.deepEqual(
      stories.map((story) => story.story_id),
      ["S-1", "S-2"],
    );

    const step = db.prepare("SELECT status FROM steps WHERE id = ?").get(stepId) as { status: string };
    assert.equal(step.status, "done");
  });
});
