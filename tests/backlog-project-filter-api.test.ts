/**
 * US-001: Add project_id filter to GET /api/backlog endpoint
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { addBacklogEntry, deleteBacklogEntry, listBacklogEntries } from "../dist/backlog/index.js";
import { addProject, deleteProject } from "../dist/projects/index.js";

const PORT = 14088;
let server: http.Server;

async function req(path: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "localhost",
      port: PORT,
      path,
      method: "GET",
    };
    const r = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve({ status: res.statusCode ?? 0, data });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: null });
        }
      });
    });
    r.on("error", reject);
    r.end();
  });
}

let projectId: string;
let otherProjectId: string;
let workflowId: string;
let entryInProject: string;
let entryInOtherProject: string;
let entryWithWorkflowAndProject: string;
let entryNoProject: string;

before(async () => {
  server = startDashboard(PORT, {
    runWorkflow: async ({ workflowId, taskTitle }) => ({
      id: `run-${Date.now()}`,
      runNumber: 1,
      workflowId,
      task: taskTitle,
      status: "running",
    }),
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));

  // Set up test data
  const project = addProject({ name: "test-proj-filter-001", description: "" });
  projectId = project.id;

  const other = addProject({ name: "test-proj-filter-002", description: "" });
  otherProjectId = other.id;

  workflowId = "test-workflow-filter-001";

  const e1 = addBacklogEntry({ title: "test-pf-in-project", projectId });
  entryInProject = e1.id;

  const e2 = addBacklogEntry({ title: "test-pf-in-other-project", projectId: otherProjectId });
  entryInOtherProject = e2.id;

  const e3 = addBacklogEntry({ title: "test-pf-workflow-and-project", projectId, workflowId });
  entryWithWorkflowAndProject = e3.id;

  const e4 = addBacklogEntry({ title: "test-pf-no-project" });
  entryNoProject = e4.id;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Cleanup
  for (const id of [entryInProject, entryInOtherProject, entryWithWorkflowAndProject, entryNoProject]) {
    deleteBacklogEntry(id);
  }
  deleteProject(projectId);
  deleteProject(otherProjectId);
});

describe("US-001: GET /api/backlog project_id filter", () => {
  it("AC1: GET /api/backlog?project=<id> returns only matching entries", async () => {
    const { status, data } = await req(`/api/backlog?project=${projectId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    const ids = (data as Array<{ id: string }>).map((e) => e.id);
    assert.ok(ids.includes(entryInProject), "should include entry in project");
    assert.ok(ids.includes(entryWithWorkflowAndProject), "should include entry with workflow+project");
    assert.ok(!ids.includes(entryInOtherProject), "should not include entry from other project");
    assert.ok(!ids.includes(entryNoProject), "should not include entry with no project");
  });

  it("AC2: GET /api/backlog?project=<nonexistent> returns empty array (not 404)", async () => {
    const { status, data } = await req("/api/backlog?project=nonexistent-project-id");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    assert.equal((data as unknown[]).length, 0, "should be empty");
  });

  it("AC3: GET /api/backlog (no params) returns all entries", async () => {
    const { status, data } = await req("/api/backlog");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    const ids = (data as Array<{ id: string }>).map((e) => e.id);
    assert.ok(ids.includes(entryInProject), "should include project entry");
    assert.ok(ids.includes(entryNoProject), "should include no-project entry");
  });

  it("AC4: GET /api/backlog?workflow=<id>&project=<id> filters by both", async () => {
    const { status, data } = await req(`/api/backlog?workflow=${workflowId}&project=${projectId}`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return array");
    const ids = (data as Array<{ id: string }>).map((e) => e.id);
    assert.ok(ids.includes(entryWithWorkflowAndProject), "should include entry matching both");
    assert.ok(!ids.includes(entryInProject), "should not include entry with only project (no workflow)");
    assert.ok(!ids.includes(entryNoProject), "should not include entry with no project or workflow");
  });
});
