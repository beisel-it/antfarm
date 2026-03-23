import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { completeStep } from "../dist/installer/step-ops.js";
import { deriveBranchName, runWorkflow } from "../dist/installer/run.js";
import { getDb } from "../dist/db.js";

beforeEach(() => {
  const db = getDb();
  db.prepare("DELETE FROM stories").run();
  db.prepare("DELETE FROM steps").run();
  db.prepare("DELETE FROM runs").run();
  db.prepare("DELETE FROM projects").run();
});

test("runWorkflow seeds repo from project and branch deterministically", async () => {
  const db = getDb();
  const projectId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO projects (id, name, git_repo_path, github_repo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(projectId, "Deterministic Repo Project", "/tmp/deterministic-repo", null, now, now);

  const taskTitle = "Add deterministic repo context";
  const run = await runWorkflow({
    workflowId: "feature-dev",
    taskTitle,
    projectId,
  });

  const stored = db.prepare("SELECT context FROM runs WHERE id = ?").get(run.id) as { context: string };
  const context = JSON.parse(stored.context) as Record<string, string>;

  assert.equal(context.repo, "/tmp/deterministic-repo");
  assert.equal(context.branch, deriveBranchName("feature-dev", taskTitle));
});

test("completeStep does not overwrite repo and branch once seeded", () => {
  const db = getDb();
  const runId = crypto.randomUUID();
  const stepId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    runId,
    1,
    "feature-dev",
    "Seeded run",
    "running",
    JSON.stringify({ repo: "/tmp/original-repo", branch: "feature/original-1234abcd" }),
    now,
    now
  );
  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, ?, ?, 0, '', 'STATUS: done', 'running', ?, ?)"
  ).run(stepId, runId, "plan", "feature-dev_planner", now, now);

  completeStep(stepId, [
    "STATUS: done",
    "REPO: /tmp/agent-overwrite",
    "BRANCH: feature/agent-overwrite-deadbeef",
  ].join("\n"));

  const stored = db.prepare("SELECT context FROM runs WHERE id = ?").get(runId) as { context: string };
  const context = JSON.parse(stored.context) as Record<string, string>;

  assert.equal(context.repo, "/tmp/original-repo");
  assert.equal(context.branch, "feature/original-1234abcd");
});
