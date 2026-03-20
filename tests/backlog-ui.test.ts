/**
 * US-009: Tests for Backlog column in the dashboard board UI.
 * Verifies that the built index.html contains the correct structure
 * for rendering the Backlog column.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import {
  addBacklogEntry,
  deleteBacklogEntry,
  listBacklogEntries,
} from "../dist/backlog/index.js";

const HTML_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../dist/server/index.html"
);

let server: http.Server;
const PORT = 14098;
const BASE = `http://localhost:${PORT}`;

async function req(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; data: unknown; text: string }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: "localhost",
      port: PORT,
      path: urlPath,
      method,
      headers: bodyStr
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(bodyStr),
          }
        : {},
    };
    const r = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(text), text });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: null, text });
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
  const entries = listBacklogEntries();
  for (const e of entries) {
    if (e.title.startsWith("test-ui-")) {
      deleteBacklogEntry(e.id);
    }
  }
});

describe("US-009: Backlog UI – HTML structure", () => {
  it("dist/server/index.html exists", () => {
    assert.ok(fs.existsSync(HTML_PATH), "index.html should exist in dist/server/");
  });

  it("contains renderBacklogColumn function", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    assert.ok(
      html.includes("renderBacklogColumn"),
      "HTML should define renderBacklogColumn function"
    );
  });

  it("contains backlog-column id in rendered output", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    assert.ok(
      html.includes("backlog-column"),
      "HTML should reference backlog-column id"
    );
  });

  it("contains 'Backlog' column header text", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    assert.ok(
      html.includes(">Backlog<"),
      "HTML should contain 'Backlog' column header"
    );
  });

  it("contains count badge for backlog column", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    // renderBacklogColumn includes entries.length for the count badge
    assert.ok(
      html.includes("entries.length"),
      "HTML should show count badge using entries.length"
    );
  });

  it("contains empty state message for backlog", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    assert.ok(
      html.includes("No backlog entries"),
      "HTML should include empty state 'No backlog entries'"
    );
  });

  it("contains Dispatch button markup", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    assert.ok(
      html.includes("backlog-dispatch-btn"),
      "HTML should include backlog-dispatch-btn class for Dispatch button"
    );
    assert.ok(
      html.includes("Dispatch"),
      "HTML should include 'Dispatch' button text"
    );
  });

  it("Dispatch button uses existing CSS tokens (accent-green)", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    // The dispatch button style should use var(--accent-green) — no hardcoded new colours
    assert.ok(
      html.includes("var(--accent-green)"),
      "Dispatch button should use var(--accent-green) from existing CSS tokens"
    );
  });

  it("dispatched entries get dimmed class", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    assert.ok(
      html.includes("dispatched") && html.includes("opacity"),
      "HTML should include styling for dispatched/dimmed entries"
    );
  });

  it("backlog column is placed before workflow columns (renderBacklogColumn called first)", () => {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    // renderBacklogColumn() + workflowColumnsHTML — backlog is concatenated first
    const backlogPos = html.indexOf("renderBacklogColumn()");
    const workflowColsPos = html.indexOf("workflowColumnsHTML");
    assert.ok(backlogPos > -1, "renderBacklogColumn() should exist in HTML");
    assert.ok(workflowColsPos > -1, "workflowColumnsHTML should exist in HTML");
    assert.ok(
      backlogPos < workflowColsPos,
      "renderBacklogColumn() should appear before workflowColumnsHTML in the render call"
    );
  });
});

describe("US-009: Backlog UI – API integration via dashboard server", () => {
  it("GET /api/backlog returns array", async () => {
    const { status, data } = await req("GET", "/api/backlog");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "Should return array of backlog entries");
  });

  it("backlog entries appear in GET /api/backlog after being added", async () => {
    const entry = addBacklogEntry({
      title: "test-ui-entry",
      description: "for UI test",
      status: "pending",
      priority: 0,
    });
    try {
      const { status, data } = await req("GET", "/api/backlog");
      assert.equal(status, 200);
      const list = data as Array<{ id: string; title: string }>;
      const found = list.find((e) => e.id === entry.id);
      assert.ok(found, "Added entry should appear in GET /api/backlog");
      assert.equal(found.title, "test-ui-entry");
    } finally {
      deleteBacklogEntry(entry.id);
    }
  });

  it("pending entries included in API response with status=pending", async () => {
    const entry = addBacklogEntry({
      title: "test-ui-pending",
      status: "pending",
      priority: 0,
    });
    try {
      const { status, data } = await req("GET", "/api/backlog");
      assert.equal(status, 200);
      const list = data as Array<{ id: string; status: string }>;
      const found = list.find((e) => e.id === entry.id);
      assert.ok(found, "Pending entry should be in list");
      assert.equal(found.status, "pending");
    } finally {
      deleteBacklogEntry(entry.id);
    }
  });
});
