/**
 * US-005: Queue button in backlog card UI
 *
 * Tests:
 * 1. Queue button is rendered when hasActiveRun is true and entry is not dispatched/queued
 * 2. Queue button has class backlog-queue-btn
 * 3. When entry.status === 'queued', Queued ✓ indicator is shown
 * 4. When entry.status === 'queued', Unqueue button is present
 * 5. CSS rule .backlog-queue-btn exists in the HTML
 * 6. CSS rule .badge-queued exists in the HTML
 * 7. Dispatch button remains disabled for both blocked and queued states
 * 8. queueBacklogEntry function exists
 * 9. unqueueBacklogEntry function exists
 * 10. Queue button calls queueBacklogEntry
 * 11. Unqueue button calls unqueueBacklogEntry
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const HTML_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../dist/server/index.html"
);

describe("US-005: Queue button in backlog card UI", () => {
  let html: string;

  before(() => {
    html = fs.readFileSync(HTML_PATH, "utf8");
  });

  it("CSS rule .backlog-queue-btn exists", () => {
    assert.ok(
      html.includes(".backlog-queue-btn"),
      ".backlog-queue-btn CSS rule must exist"
    );
  });

  it(".backlog-queue-btn uses accent-teal background", () => {
    const idx = html.indexOf(".backlog-queue-btn{");
    assert.ok(idx !== -1, ".backlog-queue-btn CSS rule must exist");
    const cssBlock = html.slice(idx, html.indexOf("}", idx) + 1);
    assert.ok(
      cssBlock.includes("var(--accent-teal)"),
      ".backlog-queue-btn must use var(--accent-teal) background"
    );
  });

  it("CSS rule .badge-queued exists", () => {
    assert.ok(
      html.includes(".badge-queued"),
      ".badge-queued CSS rule must exist"
    );
  });

  it(".badge-queued uses accent-teal-subtle background and accent-teal color", () => {
    const idx = html.indexOf(".badge-queued{");
    assert.ok(idx !== -1, ".badge-queued CSS rule must exist");
    const cssBlock = html.slice(idx, html.indexOf("}", idx) + 1);
    assert.ok(
      cssBlock.includes("var(--accent-teal-subtle)"),
      ".badge-queued must use var(--accent-teal-subtle) background"
    );
    assert.ok(
      cssBlock.includes("var(--accent-teal)"),
      ".badge-queued must use var(--accent-teal) color"
    );
  });

  it("Queue button is rendered with class backlog-queue-btn when hasActiveRun and not dispatched/queued", () => {
    assert.ok(
      html.includes("class=\"backlog-queue-btn\"") || html.includes("class='backlog-queue-btn'"),
      "Queue button with class backlog-queue-btn must be present in template"
    );
  });

  it("Queue button calls queueBacklogEntry", () => {
    assert.ok(
      html.includes("queueBacklogEntry("),
      "Queue button must call queueBacklogEntry()"
    );
  });

  it("Queue button only renders when hasActiveRun is true and entry is not dispatched/queued", () => {
    // Check the conditional rendering logic
    assert.ok(
      html.includes("hasActiveRun && !isDispatched && !isQueued"),
      "Queue button conditional must check hasActiveRun && !isDispatched && !isQueued"
    );
  });

  it("Queued ✓ indicator is shown when entry.status === 'queued'", () => {
    assert.ok(
      html.includes("Queued ✓"),
      "Queued ✓ indicator must be present in template"
    );
  });

  it("badge-queued class is used for the Queued ✓ indicator", () => {
    assert.ok(
      html.includes("badge-queued"),
      "badge-queued class must be used for the Queued indicator"
    );
  });

  it("Unqueue button is rendered when entry.status === 'queued'", () => {
    assert.ok(
      html.includes("unqueueBacklogEntry(") || html.includes("Unqueue"),
      "Unqueue button or unqueueBacklogEntry call must be present"
    );
  });

  it("isQueued variable is declared in renderBacklogColumn", () => {
    assert.ok(
      html.includes("const isQueued = entry.status === 'queued'") ||
        html.includes("const isQueued=entry.status==='queued'"),
      "isQueued variable must be declared"
    );
  });

  it("Dispatch button is disabled when isQueued is true", () => {
    assert.ok(
      html.includes("isDispatched || hasActiveRun || isQueued ? 'disabled'") ||
        html.includes('isDispatched || hasActiveRun || isQueued ? "disabled"'),
      "Dispatch button must be disabled when isQueued is true"
    );
  });

  it("queueBacklogEntry function exists", () => {
    assert.ok(
      html.includes("async function queueBacklogEntry("),
      "queueBacklogEntry function must exist"
    );
  });

  it("queueBacklogEntry calls POST /api/backlog/:id/queue", () => {
    const fnStart = html.indexOf("async function queueBacklogEntry(");
    assert.ok(fnStart !== -1, "queueBacklogEntry must exist");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 1);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    assert.ok(
      fn.includes("/api/backlog/") && fn.includes("/queue") && fn.includes("method: 'POST'"),
      "queueBacklogEntry must POST to /api/backlog/:id/queue"
    );
  });

  it("unqueueBacklogEntry function exists", () => {
    assert.ok(
      html.includes("async function unqueueBacklogEntry("),
      "unqueueBacklogEntry function must exist"
    );
  });

  it("unqueueBacklogEntry calls DELETE /api/backlog/:id/queue", () => {
    const fnStart = html.indexOf("async function unqueueBacklogEntry(");
    assert.ok(fnStart !== -1, "unqueueBacklogEntry must exist");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 1);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    assert.ok(
      fn.includes("/api/backlog/") && fn.includes("/queue") && fn.includes("method: 'DELETE'"),
      "unqueueBacklogEntry must DELETE /api/backlog/:id/queue"
    );
  });

  it("queueBacklogEntry includes workflowId from currentWf", () => {
    const fnStart = html.indexOf("async function queueBacklogEntry(");
    assert.ok(fnStart !== -1);
    const fnEnd = html.indexOf("\nasync function ", fnStart + 1);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    assert.ok(
      fn.includes("workflowId: currentWf?.id") ||
        fn.includes("workflowId: currentWf && currentWf.id"),
      "queueBacklogEntry must include workflowId from currentWf"
    );
  });

  it("queueBacklogEntry calls loadBacklog() on success", () => {
    const fnStart = html.indexOf("async function queueBacklogEntry(");
    assert.ok(fnStart !== -1);
    const fnEnd = html.indexOf("\nasync function ", fnStart + 1);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    assert.ok(
      fn.includes("loadBacklog()"),
      "queueBacklogEntry must call loadBacklog() on success"
    );
  });

  it("unqueueBacklogEntry calls loadBacklog() on success", () => {
    const fnStart = html.indexOf("async function unqueueBacklogEntry(");
    assert.ok(fnStart !== -1);
    const fnEnd = html.indexOf("\nasync function ", fnStart + 1);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    assert.ok(
      fn.includes("loadBacklog()"),
      "unqueueBacklogEntry must call loadBacklog() on success"
    );
  });
});
