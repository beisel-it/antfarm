/**
 * Integration tests for project-backlog and project-runs relationships.
 * GET /api/projects/:id/backlog and GET /api/projects/:id/runs endpoints.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { addBacklogEntry, deleteBacklogEntry } from "../dist/backlog/index.js";
import { addProject, deleteProject } from "../dist/projects/index.js";
import { getDb } from "../dist/db.js";

let server: http.Server;
const PORT = 14096;
const BASE = `http://localhost:${PORT}`;

async function req(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: "localhost",
      port: PORT,
      path,
      method,
      headers: bodyStr
        ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) }
        : {},
    };
    const r = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: null });
        }
      });
    });
    r.on("error", reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

const createdProjectIds: string[] = [];
const createdBacklogIds: string[] = [];

before(async () => {
  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  for (const id of createdBacklogIds) {
    try { db.prepare("DELETE FROM backlog WHERE id = ?").run(id); } catch {}
  }
  for (const id of createdProjectIds) {
    try { db.prepare("DELETE FROM projects WHERE id = ?").run(id); } catch {}
  }
});

describe("GET /api/projects/:id/backlog", () => {
  it("returns [] for a new project with no backlog entries", async () => {
    const project = addProject({ name: "rel-test-empty-backlog" });
    createdProjectIds.push(project.id);

    const { status, data } = await req("GET", `/api/projects/${project.id}/backlog`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return an array");
    assert.equal((data as unknown[]).length, 0);
  });

  it("returns 404 for an unknown project id", async () => {
    const { status, data } = await req("GET", "/api/projects/nonexistent-project-rel-xyz/backlog");
    assert.equal(status, 404);
    assert.equal((data as Record<string, unknown>).error, "not found");
  });

  it("returns backlog entry after creating one with projectId", async () => {
    const project = addProject({ name: "rel-test-has-backlog" });
    createdProjectIds.push(project.id);

    const entry = addBacklogEntry({
      title: "rel-test backlog item",
      projectId: project.id,
    });
    createdBacklogIds.push(entry.id);

    const { status, data } = await req("GET", `/api/projects/${project.id}/backlog`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    const items = data as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.equal(items[0].id, entry.id);
    assert.equal(items[0].project_id, project.id);
  });
});

describe("GET /api/projects/:id/runs", () => {
  it("returns [] for a new project with no runs", async () => {
    const project = addProject({ name: "rel-test-empty-runs" });
    createdProjectIds.push(project.id);

    const { status, data } = await req("GET", `/api/projects/${project.id}/runs`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return an array");
    assert.equal((data as unknown[]).length, 0);
  });

  it("returns 404 for an unknown project id", async () => {
    const { status, data } = await req("GET", "/api/projects/nonexistent-project-rel-xyz/runs");
    assert.equal(status, 404);
    assert.equal((data as Record<string, unknown>).error, "not found");
  });
});

describe("POST /api/backlog with projectId and workflowId", () => {
  it("creates a backlog entry with projectId via API", async () => {
    const project = addProject({ name: "rel-test-api-backlog" });
    createdProjectIds.push(project.id);

    const { status, data } = await req("POST", "/api/backlog", {
      title: "rel-api-test item",
      projectId: project.id,
      workflowId: "feature-dev",
    });
    assert.equal(status, 201);
    const entry = data as Record<string, unknown>;
    assert.ok(entry.id, "should have id");
    assert.equal(entry.project_id, project.id);
    assert.equal(entry.workflow_id, "feature-dev");
    createdBacklogIds.push(entry.id as string);

    // Verify it appears in project backlog
    const { data: backlogData } = await req("GET", `/api/projects/${project.id}/backlog`);
    const items = backlogData as Array<Record<string, unknown>>;
    const found = items.find((e) => e.id === entry.id);
    assert.ok(found, "entry should appear in project backlog");
  });
});

describe("Dispatch uses entry.workflow_id when set", () => {
  it("dispatch endpoint returns 400 (entry.workflow_id takes effect, nonexistent workflow)", async () => {
    const project = addProject({ name: "rel-test-dispatch-wf" });
    createdProjectIds.push(project.id);

    const entry = addBacklogEntry({
      title: "rel-test dispatch with stored workflow",
      projectId: project.id,
      workflowId: "nonexistent-stored-workflow-xyz",
    });
    createdBacklogIds.push(entry.id);

    const { status, data } = await req("POST", `/api/backlog/${entry.id}/dispatch`);
    // Should fail because stored workflow_id doesn't exist, not because of missing body workflowId
    assert.equal(status, 400);
    assert.ok((data as Record<string, unknown>).error, "should have error message");
  });
});
