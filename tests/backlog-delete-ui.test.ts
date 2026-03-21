/**
 * US-012 / US-005: Tests for Delete button functionality in the backlog dashboard card.
 * Verifies HTML structure, inline confirm UI pattern (no native confirm()),
 * DELETE fetch call via confirmDeleteBacklog, and DOM removal on success.
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

describe("US-012/US-005: Delete button HTML structure with inline confirm", () => {
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

  it("deleteBacklogEntry function exists (does NOT contain native confirm())", () => {
    const fnStart = html.indexOf("function deleteBacklogEntry(");
    assert.ok(fnStart !== -1, "deleteBacklogEntry must exist in the HTML");
    // Find end of function - look for next function declaration
    const fnEnd = html.indexOf("\nfunction ", fnStart + 10);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 500);
    assert.ok(
      !fn.includes("confirm("),
      "deleteBacklogEntry must NOT contain native confirm() call"
    );
  });

  it("delete button wires onclick to deleteBacklogEntry", () => {
    assert.ok(
      html.includes("deleteBacklogEntry("),
      "delete button must call deleteBacklogEntry on click"
    );
  });

  it("does NOT use native confirm() for backlog deletion", () => {
    assert.ok(
      !html.includes("confirm('Delete this backlog item?')") &&
        !html.includes('confirm("Delete this backlog item?")'),
      "deleteBacklogEntry must NOT show native confirm dialog"
    );
  });

  it("backlog-inline-confirm CSS class exists", () => {
    assert.ok(
      html.includes(".backlog-inline-confirm"),
      "CSS must include .backlog-inline-confirm class"
    );
  });

  it(".backlog-inline-confirm div exists in backlog card template", () => {
    assert.ok(
      html.includes('class="backlog-inline-confirm"'),
      "backlog card template must include .backlog-inline-confirm div"
    );
  });

  it("confirmDeleteBacklog function exists and calls DELETE fetch", () => {
    const fnStart = html.indexOf("async function confirmDeleteBacklog(");
    assert.ok(fnStart !== -1, "confirmDeleteBacklog must be an async function");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 10);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 600);
    assert.ok(
      fn.includes("method: 'DELETE'") || fn.includes('method: "DELETE"'),
      "confirmDeleteBacklog must use DELETE method"
    );
    assert.ok(
      fn.includes("/api/backlog/"),
      "confirmDeleteBacklog must call /api/backlog/:id"
    );
  });

  it("card is removed from DOM in confirmDeleteBacklog on success", () => {
    const fnStart = html.indexOf("async function confirmDeleteBacklog(");
    assert.ok(fnStart !== -1, "confirmDeleteBacklog must exist");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 10);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 600);
    assert.ok(
      fn.includes("card.remove()"),
      "confirmDeleteBacklog must remove card from DOM on success"
    );
  });

  it("cancelDeleteBacklog function exists and removes active class", () => {
    const fnStart = html.indexOf("function cancelDeleteBacklog(");
    assert.ok(fnStart !== -1, "cancelDeleteBacklog must exist");
    const fnEnd = html.indexOf("\n}", fnStart);
    const fn = html.slice(fnStart, fnEnd + 2);
    assert.ok(
      fn.includes("classList.remove('active')") || fn.includes('classList.remove("active")'),
      "cancelDeleteBacklog must remove active class from inline confirm"
    );
  });

  it("deleteBacklogEntry shows inline confirm by adding active class", () => {
    const fnStart = html.indexOf("function deleteBacklogEntry(");
    assert.ok(fnStart !== -1, "deleteBacklogEntry must exist");
    const fnEnd = html.indexOf("\n}", fnStart);
    const fn = html.slice(fnStart, fnEnd + 2);
    assert.ok(
      fn.includes("classList.add('active')") || fn.includes('classList.add("active")'),
      "deleteBacklogEntry must add active class to show inline confirm"
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

  it("inline confirm Delete button calls confirmDeleteBacklog", () => {
    assert.ok(
      html.includes("confirmDeleteBacklog("),
      "inline confirm must have a button calling confirmDeleteBacklog"
    );
  });

  it("inline confirm Cancel button calls cancelDeleteBacklog", () => {
    assert.ok(
      html.includes("cancelDeleteBacklog("),
      "inline confirm must have a button calling cancelDeleteBacklog"
    );
  });

  it("no alert() calls in backlog delete functions", () => {
    const fnStart = html.indexOf("function deleteBacklogEntry(");
    const fnEnd = html.indexOf("function renderBoard(", fnStart);
    const section = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 1500);
    assert.ok(
      !section.includes("alert("),
      "backlog delete functions must not use alert()"
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

describe("US-012/US-005: Delete backlog entry integration", () => {
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
