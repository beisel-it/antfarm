/**
 * US-012: Tests for Delete button functionality in the backlog dashboard card.
 * Verifies HTML structure, deleteBacklogEntry function, confirm dialog,
 * DELETE fetch call, and DOM removal on success.
 * Also includes integration test: POST → DELETE → verify gone.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { listBacklogEntries, deleteBacklogEntry } from "../dist/backlog/index.js";

const HTML_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../dist/server/index.html"
);

// ─── HTML structure tests (no server needed) ───────────────────────────────

describe("US-012: Delete button HTML structure", () => {
  let html: string;

  before(() => {
    html = fs.readFileSync(HTML_PATH, "utf8");
  });

  it("backlog-delete-btn class exists in renderBacklogColumn()", () => {
    assert.ok(
      html.includes("backlog-delete-btn"),
      "renderBacklogColumn must include a backlog-delete-btn button"
    );
  });

  it("deleteBacklogEntry async function exists", () => {
    assert.ok(
      html.includes("async function deleteBacklogEntry("),
      "deleteBacklogEntry must be an async function"
    );
  });

  it("delete button wires onclick to deleteBacklogEntry", () => {
    assert.ok(
      html.includes("deleteBacklogEntry("),
      "delete button must call deleteBacklogEntry on click"
    );
  });

  it("confirm dialog shows 'Delete this backlog item?'", () => {
    assert.ok(
      html.includes("confirm('Delete this backlog item?')") ||
        html.includes('confirm("Delete this backlog item?")'),
      "deleteBacklogEntry must show correct confirm message"
    );
  });

  it("on cancel (confirm = false), function returns early without fetching", () => {
    const fnStart = html.indexOf("async function deleteBacklogEntry(");
    const fnEnd = html.indexOf("\n}", fnStart);
    const fn = html.slice(fnStart, fnEnd + 2);
    assert.ok(
      fn.includes("if (!confirm(") && fn.includes(") return;"),
      "deleteBacklogEntry must return early when confirm is cancelled"
    );
  });

  it("calls DELETE fetch to /api/backlog/:id", () => {
    const fnStart = html.indexOf("async function deleteBacklogEntry(");
    const fnEnd = html.indexOf("\n}", fnStart);
    const fn = html.slice(fnStart, fnEnd + 2);
    assert.ok(
      fn.includes("method: 'DELETE'") || fn.includes('method: "DELETE"'),
      "deleteBacklogEntry must use DELETE method"
    );
    assert.ok(
      fn.includes("/api/backlog/"),
      "deleteBacklogEntry must call /api/backlog/:id"
    );
  });

  it("card is removed from DOM on success", () => {
    const fnStart = html.indexOf("async function deleteBacklogEntry(");
    const fnEnd = html.indexOf("\n}", fnStart);
    const fn = html.slice(fnStart, fnEnd + 2);
    assert.ok(
      fn.includes("card.remove()"),
      "deleteBacklogEntry must remove card from DOM on success"
    );
  });

  it("delete button title attribute is 'Delete'", () => {
    assert.ok(
      html.includes("title='Delete'") || html.includes('title="Delete"'),
      "delete button must have title='Delete'"
    );
  });

  it("delete button label is ✕", () => {
    assert.ok(
      html.includes(">✕<"),
      "delete button must show ✕ as label"
    );
  });
});

// ─── Integration tests (real server) ─────────────────────────────────────

let server: http.Server;
const PORT = 14002;

async function req(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: "localhost",
      port: PORT,
      path: urlPath,
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
      id: `test-run-${Date.now()}`,
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
  // Clean up any leftover test entries
  const entries = listBacklogEntries();
  for (const e of entries) {
    if (e.title.startsWith("test-us012-delete-")) {
      deleteBacklogEntry(e.id);
    }
  }
});

describe("US-012: Delete backlog entry integration", () => {
  it("POST /api/backlog creates entry, DELETE /api/backlog/:id removes it, GET confirms it's gone", async () => {
    const title = `test-us012-delete-${Date.now()}`;

    // Create
    const { status: createStatus, data: created } = await req("POST", "/api/backlog", { title });
    assert.equal(createStatus, 201, "POST should return 201");
    const entry = created as { id: string; title: string };
    assert.ok(entry.id, "created entry must have an id");

    // Verify it's listed
    const { status: listStatus, data: listBefore } = await req("GET", "/api/backlog");
    assert.equal(listStatus, 200);
    const before = listBefore as Array<{ id: string }>;
    assert.ok(before.some(e => e.id === entry.id), "entry should be in list before delete");

    // Delete
    const { status: deleteStatus, data: deleteData } = await req("DELETE", `/api/backlog/${entry.id}`);
    assert.equal(deleteStatus, 200, "DELETE should return 200");
    const del = deleteData as { ok: boolean };
    assert.equal(del.ok, true, "DELETE should return { ok: true }");

    // Verify it's gone
    const { status: listAfterStatus, data: listAfter } = await req("GET", "/api/backlog");
    assert.equal(listAfterStatus, 200);
    const after = listAfter as Array<{ id: string }>;
    assert.ok(!after.some(e => e.id === entry.id), "entry should not appear in list after delete");
  });

  it("DELETE /api/backlog/:id on non-existent id returns 404", async () => {
    const { status } = await req("DELETE", "/api/backlog/non-existent-id-us012");
    assert.equal(status, 404, "DELETE for missing entry should return 404");
  });
});
