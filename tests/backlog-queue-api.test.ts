/**
 * US-003: Add POST /api/backlog/:id/queue and DELETE /api/backlog/:id/queue endpoints
 *
 * Tests:
 * 1. POST /api/backlog/:id/queue with a valid entry returns 200 { ok: true, queueOrder: <number> }
 * 2. POST /api/backlog/:id/queue on a dispatched entry returns 409
 * 3. POST /api/backlog/:id/queue on an entry without project_id returns 400
 * 4. POST /api/backlog/:id/queue on an unknown id returns 404
 * 5. DELETE /api/backlog/:id/queue on a queued entry returns 200 { ok: true } and resets status to 'pending'
 * 6. DELETE /api/backlog/:id/queue on an unknown id returns 404
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import {
  addBacklogEntry,
  deleteBacklogEntry,
  getBacklogEntry,
  updateBacklogEntry,
} from "../dist/backlog/index.js";
import { addProject, deleteProject } from "../dist/projects/index.js";

let server: http.Server;
const PORT = 14105;

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

before(async () => {
  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Backlog Queue API - POST /api/backlog/:id/queue", () => {
  it("returns 404 for unknown backlog entry", async () => {
    const { status, data } = await req("POST", "/api/backlog/nonexistent-queue-xyz/queue");
    assert.equal(status, 404);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "not found");
  });

  it("returns 409 if entry is already dispatched", async () => {
    const project = addProject({ name: "queue-api-test-proj-dispatched" });
    const entry = addBacklogEntry({ title: "test-queue-dispatched", projectId: project.id, workflowId: "feature-dev" });
    updateBacklogEntry(entry.id, { status: "dispatched" });

    const { status, data } = await req("POST", `/api/backlog/${entry.id}/queue`);
    assert.equal(status, 409);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "already dispatched");

    try { deleteBacklogEntry(entry.id); } catch { /* ok */ }
    try { deleteProject(project.id); } catch { /* ok */ }
  });

  it("returns 400 if entry has no project_id", async () => {
    const entry = addBacklogEntry({ title: "test-queue-no-project", workflowId: "feature-dev" });

    const { status, data } = await req("POST", `/api/backlog/${entry.id}/queue`);
    assert.equal(status, 400);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "entry has no project — queue requires a project");

    try { deleteBacklogEntry(entry.id); } catch { /* ok */ }
  });

  it("returns 200 with ok and queueOrder for valid entry with explicit workflowId", async () => {
    const project = addProject({ name: "queue-api-test-proj-valid" });
    const entry = addBacklogEntry({ title: "test-queue-valid", projectId: project.id });

    const { status, data } = await req("POST", `/api/backlog/${entry.id}/queue`, { workflowId: "feature-dev" });
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.ok, true);
    assert.ok(typeof d.queueOrder === "number", "queueOrder should be a number");
    assert.ok((d.queueOrder as number) >= 1, "queueOrder should be >= 1");

    // Verify entry state in DB
    const updated = getBacklogEntry(entry.id);
    assert.ok(updated, "entry should still exist");
    assert.equal(updated!.status, "queued");
    assert.equal(updated!.queue_order, d.queueOrder);

    try { deleteBacklogEntry(entry.id); } catch { /* ok */ }
    try { deleteProject(project.id); } catch { /* ok */ }
  });

  it("returns 200 with ok and queueOrder using entry.workflow_id when no body", async () => {
    const project = addProject({ name: "queue-api-test-proj-entry-wf" });
    const entry = addBacklogEntry({ title: "test-queue-entry-workflow", projectId: project.id, workflowId: "feature-dev" });

    const { status, data } = await req("POST", `/api/backlog/${entry.id}/queue`);
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.ok, true);
    assert.ok(typeof d.queueOrder === "number", "queueOrder should be a number");

    // Verify state
    const updated = getBacklogEntry(entry.id);
    assert.ok(updated, "entry should still exist");
    assert.equal(updated!.status, "queued");

    try { deleteBacklogEntry(entry.id); } catch { /* ok */ }
    try { deleteProject(project.id); } catch { /* ok */ }
  });

  it("sequential queue_order for multiple entries in same project+workflow", async () => {
    const project = addProject({ name: "queue-api-test-proj-seq" });
    const entry1 = addBacklogEntry({ title: "test-queue-seq-1", projectId: project.id, workflowId: "feature-dev" });
    const entry2 = addBacklogEntry({ title: "test-queue-seq-2", projectId: project.id, workflowId: "feature-dev" });

    const { data: d1 } = await req("POST", `/api/backlog/${entry1.id}/queue`);
    const { data: d2 } = await req("POST", `/api/backlog/${entry2.id}/queue`);
    const r1 = d1 as Record<string, unknown>;
    const r2 = d2 as Record<string, unknown>;

    assert.ok(typeof r1.queueOrder === "number");
    assert.ok(typeof r2.queueOrder === "number");
    assert.ok((r2.queueOrder as number) > (r1.queueOrder as number), "second entry should have higher queue_order");

    try { deleteBacklogEntry(entry1.id); } catch { /* ok */ }
    try { deleteBacklogEntry(entry2.id); } catch { /* ok */ }
    try { deleteProject(project.id); } catch { /* ok */ }
  });
});

describe("Backlog Queue API - DELETE /api/backlog/:id/queue", () => {
  it("returns 404 for unknown backlog entry", async () => {
    const { status, data } = await req("DELETE", "/api/backlog/nonexistent-unqueue-xyz/queue");
    assert.equal(status, 404);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "not found");
  });

  it("returns 200 and resets status to pending for a queued entry", async () => {
    const project = addProject({ name: "queue-api-test-proj-cancel" });
    const entry = addBacklogEntry({ title: "test-unqueue-valid", projectId: project.id, workflowId: "feature-dev" });

    // First queue the entry
    const queueRes = await req("POST", `/api/backlog/${entry.id}/queue`);
    assert.equal(queueRes.status, 200, "queue should succeed");

    // Now unqueue
    const { status, data } = await req("DELETE", `/api/backlog/${entry.id}/queue`);
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.ok, true);

    // Verify entry is reset to pending with no queue_order
    const updated = getBacklogEntry(entry.id);
    assert.ok(updated, "entry should still exist");
    assert.equal(updated!.status, "pending");
    assert.equal(updated!.queue_order, null);

    try { deleteBacklogEntry(entry.id); } catch { /* ok */ }
    try { deleteProject(project.id); } catch { /* ok */ }
  });

  it("returns 200 for a non-queued entry (cancel is idempotent)", async () => {
    const project = addProject({ name: "queue-api-test-proj-idempotent" });
    const entry = addBacklogEntry({ title: "test-unqueue-pending", projectId: project.id });

    // Entry is 'pending' by default, cancelling should still return 200
    const { status, data } = await req("DELETE", `/api/backlog/${entry.id}/queue`);
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.ok, true);

    try { deleteBacklogEntry(entry.id); } catch { /* ok */ }
    try { deleteProject(project.id); } catch { /* ok */ }
  });
});
