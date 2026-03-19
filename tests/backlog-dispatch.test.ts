/**
 * US-008: Wire dispatch endpoint to trigger a workflow run
 *
 * Tests:
 * 1. POST /api/backlog/:id/dispatch starts a new workflow run and returns runId
 * 2. After dispatch, the backlog entry status is 'dispatched' and run_id is set
 * 3. POST with invalid workflowId returns 400 with error message
 * 4. run_id column exists in backlog table after migration
 * 5. Dispatch with no body defaults to first installed workflow
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import {
  addBacklogEntry,
  deleteBacklogEntry,
  getBacklogEntry,
} from "../dist/backlog/index.js";
import { getDb } from "../dist/db.js";

let server: http.Server;
const PORT = 14099;
let fakeRunCalls = 0;
let lastRunRequest: { workflowId: string; taskTitle: string } | null = null;

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
  server = startDashboard(PORT, {
    runWorkflow: async ({ workflowId, taskTitle }) => {
      if (workflowId.startsWith("nonexistent")) {
        throw new Error(`Workflow "${workflowId}" not found`);
      }
      fakeRunCalls += 1;
      lastRunRequest = { workflowId, taskTitle };
      return {
        id: `test-dispatch-run-${fakeRunCalls}`,
        runNumber: fakeRunCalls,
        workflowId,
        task: taskTitle,
        status: "running",
      };
    },
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Backlog Dispatch - run_id column migration", () => {
  it("backlog table has run_id column after migration", () => {
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(backlog)").all() as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);
    assert.ok(colNames.includes("run_id"), "backlog table should have run_id column");
  });

  it("new backlog entries have run_id as null by default", () => {
    const entry = addBacklogEntry({ title: "test-dispatch-schema-check" });
    assert.equal(entry.run_id, null);
    deleteBacklogEntry(entry.id);
  });
});

describe("Backlog Dispatch - POST /api/backlog/:id/dispatch", () => {
  let entryId: string;

  before(() => {
    const entry = addBacklogEntry({
      title: "test-dispatch-title",
      description: "test-dispatch-description",
    });
    entryId = entry.id;
  });

  after(() => {
    // Clean up (if not dispatched)
    try { deleteBacklogEntry(entryId); } catch { /* ok */ }
  });

  it("returns 404 for unknown backlog entry", async () => {
    const { status, data } = await req("POST", "/api/backlog/nonexistent-dispatch-xyz/dispatch");
    assert.equal(status, 404);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "not found");
  });

  it("returns 400 for invalid workflowId", async () => {
    const { status, data } = await req(
      "POST",
      `/api/backlog/${entryId}/dispatch`,
      { workflowId: "nonexistent-workflow-id-xyz" }
    );
    assert.equal(status, 400);
    const d = data as Record<string, unknown>;
    assert.ok(d.error, "should have error message");
  });

  it("dispatches with default workflow (no body), returns ok with runId", async () => {
    const entry2 = addBacklogEntry({
      title: "test-dispatch-default-workflow",
      description: "dispatched via default",
    });

    const beforeCalls = fakeRunCalls;
    const { status, data } = await req("POST", `/api/backlog/${entry2.id}/dispatch`);
    const d = data as Record<string, unknown>;
    assert.equal(status, 200);
    assert.equal(d.ok, true);
    assert.equal(d.runId, `test-dispatch-run-${beforeCalls + 1}`);
    assert.equal(d.runNumber, beforeCalls + 1);
    assert.ok(lastRunRequest, "dispatch should call the workflow runner");
    assert.match(lastRunRequest.workflowId, /\S/, "default dispatch should resolve a workflow id");
    assert.equal(lastRunRequest.taskTitle, "test-dispatch-default-workflow\n\ndispatched via default");

    // Verify DB state
    const updated = getBacklogEntry(entry2.id);
    assert.ok(updated, "entry should still exist");
    assert.equal(updated!.status, "dispatched");
    assert.equal(updated!.run_id, d.runId);

    // Clean up
    try { deleteBacklogEntry(entry2.id); } catch { /* ok */ }
  });

  it("dispatches with explicit workflowId, returns ok with runId", async () => {
    // Use feature-dev which is known to exist
    const entry3 = addBacklogEntry({
      title: "test-dispatch-explicit-workflow",
      description: "dispatched via explicit workflowId",
    });

    const { status, data } = await req(
      "POST",
      `/api/backlog/${entry3.id}/dispatch`,
      { workflowId: "feature-dev" }
    );
    const d = data as Record<string, unknown>;
    assert.equal(status, 200);
    assert.equal(d.ok, true);
    assert.ok(typeof d.runId === "string", "should return runId");
    assert.ok(typeof d.runNumber === "number", "should return runNumber");
    assert.deepEqual(lastRunRequest, {
      workflowId: "feature-dev",
      taskTitle: "test-dispatch-explicit-workflow\n\ndispatched via explicit workflowId",
    });

    // Verify status and run_id updated
    const updated = getBacklogEntry(entry3.id);
    assert.ok(updated, "entry should still exist");
    assert.equal(updated!.status, "dispatched");
    assert.equal(updated!.run_id, d.runId);

    try { deleteBacklogEntry(entry3.id); } catch { /* ok */ }
  });

  it("prefix-match id works for dispatch", async () => {
    const entry4 = addBacklogEntry({ title: "test-dispatch-prefix" });
    const prefix = entry4.id.slice(0, 8);

    // Just test the 404 case with prefix (can't guarantee workflow is installed)
    const { status } = await req("POST", `/api/backlog/${prefix}/dispatch`, { workflowId: "nonexistent-xyz" });
    // Should be 400 (entry found, workflow not found) not 404
    assert.equal(status, 400, "prefix-matched entry should be found (not 404)");

    try { deleteBacklogEntry(entry4.id); } catch { /* ok */ }
  });
});
