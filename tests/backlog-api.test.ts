import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { listBacklogEntries, addBacklogEntry, deleteBacklogEntry } from "../dist/backlog/index.js";

let server: http.Server;
const PORT = 13999;
let fakeRunCalls = 0;

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
      fakeRunCalls += 1;
      return {
        id: `test-run-${fakeRunCalls}`,
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
  // Clean up any test entries
  const entries = listBacklogEntries();
  for (const e of entries) {
    if (e.title.startsWith("test-api-")) {
      deleteBacklogEntry(e.id);
    }
  }
});

describe("Backlog API", () => {
  let createdId: string;

  it("GET /api/backlog returns JSON array", async () => {
    const { status, data } = await req("GET", "/api/backlog");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "should return an array");
  });

  it("POST /api/backlog creates a new entry with status 201", async () => {
    const { status, data } = await req("POST", "/api/backlog", {
      title: "test-api-entry",
      description: "test desc",
      priority: 5,
      workflowId: "feature-dev",
    });
    assert.equal(status, 201);
    const entry = data as Record<string, unknown>;
    assert.ok(entry.id, "should have id");
    assert.equal(entry.title, "test-api-entry");
    assert.equal(entry.description, "test desc");
    assert.equal(entry.priority, 5);
    assert.equal(entry.workflow_id, "feature-dev");
    assert.equal(entry.status, "pending");
    createdId = entry.id as string;
  });

  it("POST /api/backlog without title returns 400", async () => {
    const { status, data } = await req("POST", "/api/backlog", { description: "no title" });
    assert.equal(status, 400);
    const d = data as Record<string, unknown>;
    assert.ok(d.error);
  });

  it("GET /api/backlog includes the newly created entry", async () => {
    const { status, data } = await req("GET", "/api/backlog");
    assert.equal(status, 200);
    const entries = data as Array<Record<string, unknown>>;
    const found = entries.find((e) => e.id === createdId);
    assert.ok(found, "created entry should appear in list");
  });

  it("GET /api/backlog?workflow=<id> filters by workflow", async () => {
    const other = addBacklogEntry({ title: "test-api-other-workflow", workflow_id: "bug-fix" });
    try {
      const { status, data } = await req("GET", "/api/backlog?workflow=feature-dev");
      assert.equal(status, 200);
      const entries = data as Array<Record<string, unknown>>;
      assert.ok(entries.some((e) => e.id === createdId), "feature-dev entry should be present");
      assert.ok(!entries.some((e) => e.id === other.id), "bug-fix entry should be filtered out");
    } finally {
      deleteBacklogEntry(other.id);
    }
  });

  it("PATCH /api/backlog/:id updates entry fields", async () => {
    const { status, data } = await req("PATCH", `/api/backlog/${createdId}`, {
      title: "test-api-entry-updated",
      priority: 10,
    });
    assert.equal(status, 200);
    const entry = data as Record<string, unknown>;
    assert.equal(entry.title, "test-api-entry-updated");
    assert.equal(entry.priority, 10);
  });

  it("PATCH /api/backlog/:id with unknown id returns 404", async () => {
    const { status, data } = await req("PATCH", "/api/backlog/nonexistent-id-xyz", {
      title: "nope",
    });
    assert.equal(status, 404);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "not found");
  });

  it("POST /api/backlog/:id/dispatch triggers workflow run or returns error", async () => {
    const beforeCalls = fakeRunCalls;
    const { status, data } = await req("POST", `/api/backlog/${createdId}/dispatch`);
    const d = data as Record<string, unknown>;
    assert.equal(status, 200);
    assert.equal(d.ok, true);
    assert.equal(d.runId, `test-run-${beforeCalls + 1}`);
    assert.equal(d.runNumber, beforeCalls + 1);
  });

  it("POST /api/backlog/:id/dispatch with unknown id returns 404", async () => {
    const { status, data } = await req("POST", "/api/backlog/nonexistent-id-xyz/dispatch");
    assert.equal(status, 404);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "not found");
  });

  it("DELETE /api/backlog/:id removes entry and returns {ok:true}", async () => {
    // Create a fresh one to delete
    const createRes = await req("POST", "/api/backlog", { title: "test-api-to-delete" });
    const toDelete = (createRes.data as Record<string, unknown>).id as string;

    const { status, data } = await req("DELETE", `/api/backlog/${toDelete}`);
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.ok, true);

    // Confirm it's gone
    const listRes = await req("GET", "/api/backlog");
    const entries = listRes.data as Array<Record<string, unknown>>;
    const found = entries.find((e) => e.id === toDelete);
    assert.equal(found, undefined, "deleted entry should not appear in list");
  });

  it("DELETE /api/backlog/:id with unknown id returns 404", async () => {
    const { status, data } = await req("DELETE", "/api/backlog/nonexistent-id-xyz");
    assert.equal(status, 404);
    const d = data as Record<string, unknown>;
    assert.equal(d.error, "not found");
  });

  it("supports prefix-match id for PATCH", async () => {
    const newEntry = addBacklogEntry({ title: "test-api-prefix" });
    const prefix = newEntry.id.slice(0, 8);
    const { status, data } = await req("PATCH", `/api/backlog/${prefix}`, { priority: 99 });
    assert.equal(status, 200);
    const entry = data as Record<string, unknown>;
    assert.equal(entry.priority, 99);
    deleteBacklogEntry(newEntry.id);
  });
});
