import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../src/db.ts";

describe("story dedupe schema", () => {
  it("enforces unique story_id per run", () => {
    const db = getDb();
    const runId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare("DELETE FROM stories").run();
    db.prepare("DELETE FROM steps").run();
    db.prepare("DELETE FROM runs").run();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(runId, 1, "feature-dev", "schema test", "running", "{}", now, now);

    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, ?, 'Story 1', 'desc', '[]', 'pending', 0, 2, ?, ?)"
    ).run(crypto.randomUUID(), runId, "S-1", now, now);

    assert.throws(() => {
      db.prepare(
        "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 1, ?, 'Story 1 duplicate', 'desc', '[]', 'pending', 0, 2, ?, ?)"
      ).run(crypto.randomUUID(), runId, "S-1", now, now);
    });
  });
});
