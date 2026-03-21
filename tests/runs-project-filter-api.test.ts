/**
 * US-002: Add project_id filter to GET /api/runs endpoint
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";
import { addProject, deleteProject } from "../dist/projects/index.js";
import { randomUUID } from "node:crypto";

const PORT = 14210;
let server: http.Server;

async function req(urlPath: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: "localhost", port: PORT, path: urlPath, method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          try {
            resolve({ status: res.statusCode ?? 0, data: JSON.parse(text) });
          } catch {
            resolve({ status: res.statusCode ?? 0, data: null });
          }
        });
      }
    );
    r.on("error", reject);
    r.end();
  });
}

const WORKFLOW_ID = "test-wf-runs-project-filter";
let projectId: string;
let otherProjectId: string;
let runInProject: string;
let runInOtherProject: string;
let runWithWorkflowAndProject: string;
let runNoProject: string;

function seedRun(id: string, workflowId: string, projId: string | null) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?)"
  ).run(id, 1, workflowId, "test task", "done", projId, now, now);
}

before(async () => {
  const db = getDb();

  // Set up projects
  const project = addProject({ name: "test-runs-proj-001", description: "" });
  projectId = project.id;

  const other = addProject({ name: "test-runs-proj-002", description: "" });
  otherProjectId = other.id;

  // Clean up any previous test runs
  db.prepare("DELETE FROM runs WHERE workflow_id = ?").run(WORKFLOW_ID);
  db.prepare("DELETE FROM runs WHERE workflow_id = ?").run("other-wf-runs-project-filter");

  // Seed runs
  runInProject = randomUUID();
  seedRun(runInProject, "other-wf-runs-project-filter", projectId);

  runInOtherProject = randomUUID();
  seedRun(runInOtherProject, "other-wf-runs-project-filter", otherProjectId);

  runWithWorkflowAndProject = randomUUID();
  seedRun(runWithWorkflowAndProject, WORKFLOW_ID, projectId);

  runNoProject = randomUUID();
  seedRun(runNoProject, WORKFLOW_ID, null);

  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  db.prepare("DELETE FROM runs WHERE id IN (?, ?, ?, ?)").run(
    runInProject, runInOtherProject, runWithWorkflowAndProject, runNoProject
  );
  deleteProject(projectId);
  deleteProject(otherProjectId);
});

describe("US-002: GET /api/runs project_id filter", () => {
  it("AC1: GET /api/runs?project=<id> returns only runs with matching project_id", async () => {
    const { status, data } = await req(`/api/runs?project=${projectId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    const ids = (data as Array<{ id: string }>).map((r) => r.id);
    assert.ok(ids.includes(runInProject), "should include run in project");
    assert.ok(ids.includes(runWithWorkflowAndProject), "should include run with workflow+project");
    assert.ok(!ids.includes(runInOtherProject), "should not include run from other project");
    assert.ok(!ids.includes(runNoProject), "should not include run with no project");
  });

  it("AC2: GET /api/runs?project=<nonexistent> returns an empty array", async () => {
    const { status, data } = await req("/api/runs?project=nonexistent-project-id-xyz");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    assert.equal((data as unknown[]).length, 0, "should be empty for nonexistent project");
  });

  it("AC3: GET /api/runs?workflow=<id>&project=<id> applies both filters", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&project=${projectId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    const ids = (data as Array<{ id: string }>).map((r) => r.id);
    assert.ok(ids.includes(runWithWorkflowAndProject), "should include run matching both workflow and project");
    assert.ok(!ids.includes(runInProject), "should not include run with only project (different workflow)");
    assert.ok(!ids.includes(runNoProject), "should not include run with no project");
    assert.ok(!ids.includes(runInOtherProject), "should not include run from other project");
  });

  it("AC4: GET /api/runs with no project param returns all runs (backward compatible)", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    const ids = (data as Array<{ id: string }>).map((r) => r.id);
    assert.ok(ids.includes(runWithWorkflowAndProject), "should include workflow+project run");
    assert.ok(ids.includes(runNoProject), "should include run with no project");
  });
});
