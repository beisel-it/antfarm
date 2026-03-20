/**
 * US-004: Enforce single-run-per-project in the dashboard backlog dispatch API
 *
 * Tests:
 * 1. POST /api/backlog/:id/dispatch returns 409 when project already has a running run
 * 2. 409 response body contains { error, activeRunId, activeRunNumber }
 * 3. Dispatch succeeds (200) when project has no running run
 * 4. Dispatch for a backlog entry with no project_id is unaffected by the guard
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import {
  addBacklogEntry,
  deleteBacklogEntry,
} from "../dist/backlog/index.js";
import {
  addProject,
  deleteProject,
} from "../dist/projects/index.js";

const PORT = 14107;

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
          const data = JSON.parse(Buffer.concat(chunks).toString());
          resolve({ status: res.statusCode ?? 0, data });
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

// --- Shared state for the mock active run ---
let mockActiveRun: { id: string; run_number: number } | null = null;
let fakeRunCalls = 0;

let server: http.Server;
let projectId: string;
let entryWithProject: string;
let entryWithoutProject: string;

before(async () => {
  // Create a project and backlog entries
  const proj = addProject({ name: "test-dispatch-conflict-proj" });
  projectId = proj.id;

  const e1 = addBacklogEntry({ title: "entry-with-project" });
  // Update project_id via the DB module
  const { getDb } = await import("../dist/db.js");
  const db = getDb();
  db.prepare("UPDATE backlog SET project_id = ? WHERE id = ?").run(projectId, e1.id);
  entryWithProject = e1.id;

  const e2 = addBacklogEntry({ title: "entry-without-project" });
  entryWithoutProject = e2.id;

  server = startDashboard(PORT, {
    runWorkflow: async ({ workflowId, taskTitle, projectId: pid }) => {
      fakeRunCalls += 1;
      return {
        id: `us004-run-${fakeRunCalls}`,
        runNumber: fakeRunCalls,
        workflowId: workflowId ?? "feature-dev",
        task: taskTitle,
        status: "running",
      };
    },
    getActiveRunForProject: (pid: string) => {
      return mockActiveRun;
    },
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { deleteBacklogEntry(entryWithProject); } catch { /* ok */ }
  try { deleteBacklogEntry(entryWithoutProject); } catch { /* ok */ }
  try { deleteProject(projectId); } catch { /* ok */ }
});

describe("Backlog dispatch conflict guard (US-004)", () => {
  it("returns 409 when project already has a running run", async () => {
    mockActiveRun = { id: "existing-run-abc", run_number: 7 };
    const { status } = await req("POST", `/api/backlog/${entryWithProject}/dispatch`, { workflowId: "feature-dev" });
    assert.equal(status, 409);
  });

  it("409 response body contains error, activeRunId, and activeRunNumber", async () => {
    mockActiveRun = { id: "existing-run-abc", run_number: 7 };
    const { status, data } = await req("POST", `/api/backlog/${entryWithProject}/dispatch`, { workflowId: "feature-dev" });
    const d = data as Record<string, unknown>;
    assert.equal(status, 409);
    assert.ok(typeof d.error === "string" && d.error.length > 0, "should have error message");
    assert.equal(d.activeRunId, "existing-run-abc");
    assert.equal(d.activeRunNumber, 7);
  });

  it("dispatch succeeds (200) when project has no running run", async () => {
    mockActiveRun = null;
    const before = fakeRunCalls;
    const { status, data } = await req("POST", `/api/backlog/${entryWithProject}/dispatch`, { workflowId: "feature-dev" });
    const d = data as Record<string, unknown>;
    assert.equal(status, 200, `expected 200 but got ${status}: ${JSON.stringify(d)}`);
    assert.equal(d.ok, true);
    assert.equal(fakeRunCalls, before + 1, "runWorkflow should have been called once");
  });

  it("dispatch for entry with no project_id ignores the guard", async () => {
    // Even with a mock active run, entries without project_id should not be blocked
    mockActiveRun = { id: "some-run", run_number: 3 };
    const before = fakeRunCalls;
    const { status, data } = await req("POST", `/api/backlog/${entryWithoutProject}/dispatch`, { workflowId: "feature-dev" });
    const d = data as Record<string, unknown>;
    assert.equal(status, 200, `expected 200 but got ${status}: ${JSON.stringify(d)}`);
    assert.equal(d.ok, true);
    assert.equal(fakeRunCalls, before + 1, "runWorkflow should have been called for entry without project_id");
  });
});
