import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { deleteBacklogEntry, listBacklogEntries } from "../dist/backlog/index.js";

let server: http.Server;
const PORT = 14009;

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
    runWorkflow: async ({ workflowId, taskTitle }) => ({
      id: "test-run-1",
      runNumber: 1,
      workflowId,
      task: taskTitle,
      status: "running",
    }),
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const entries = listBacklogEntries();
  for (const e of entries) {
    if (e.title.startsWith("test-new-fields-")) {
      deleteBacklogEntry(e.id);
    }
  }
});

describe("Backlog API - new fields (notes, tags, acceptanceCriteria)", () => {
  let createdId: string;

  it("POST /api/backlog with notes, tags, acceptanceCriteria returns 201 with all fields", async () => {
    const { status, data } = await req("POST", "/api/backlog", {
      title: "test-new-fields-full",
      notes: "some notes here",
      tags: "tag1,tag2",
      acceptanceCriteria: "it should work",
    });
    assert.equal(status, 201);
    const d = data as Record<string, unknown>;
    assert.ok(d.id, "should return id");
    assert.equal(d.title, "test-new-fields-full");
    assert.equal(d.notes, "some notes here");
    assert.equal(d.tags, "tag1,tag2");
    assert.equal(d.acceptance_criteria, "it should work");
    createdId = d.id as string;
  });

  it("GET /api/backlog returns entries with notes, tags, acceptance_criteria populated", async () => {
    const { status, data } = await req("GET", "/api/backlog");
    assert.equal(status, 200);
    const entries = data as Array<Record<string, unknown>>;
    const found = entries.find((e) => e.id === createdId);
    assert.ok(found, "should find the created entry");
    assert.equal(found!.notes, "some notes here");
    assert.equal(found!.tags, "tag1,tag2");
    assert.equal(found!.acceptance_criteria, "it should work");
  });

  it("PATCH /api/backlog/:id with { notes } updates only notes, other fields unchanged", async () => {
    const { status, data } = await req("PATCH", `/api/backlog/${createdId}`, {
      notes: "updated notes",
    });
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.notes, "updated notes");
    // tags and acceptance_criteria should be unchanged
    assert.equal(d.tags, "tag1,tag2");
    assert.equal(d.acceptance_criteria, "it should work");
    assert.equal(d.title, "test-new-fields-full");
  });

  it("PATCH /api/backlog/:id with tags updates only tags", async () => {
    const { status, data } = await req("PATCH", `/api/backlog/${createdId}`, {
      tags: "newtag",
    });
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.tags, "newtag");
    // notes should be as updated in previous test
    assert.equal(d.notes, "updated notes");
  });

  it("PATCH /api/backlog/:id with acceptance_criteria updates it", async () => {
    const { status, data } = await req("PATCH", `/api/backlog/${createdId}`, {
      acceptance_criteria: "new criteria",
    });
    assert.equal(status, 200);
    const d = data as Record<string, unknown>;
    assert.equal(d.acceptance_criteria, "new criteria");
  });

  it("POST /api/backlog without new fields creates entry with null values", async () => {
    const { status, data } = await req("POST", "/api/backlog", {
      title: "test-new-fields-minimal",
    });
    assert.equal(status, 201);
    const d = data as Record<string, unknown>;
    assert.equal(d.notes, null);
    assert.equal(d.tags, null);
    assert.equal(d.acceptance_criteria, null);
    deleteBacklogEntry(d.id as string);
  });
});
