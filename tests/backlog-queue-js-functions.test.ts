/**
 * US-006: queueBacklogEntry and unqueueBacklogEntry JS functions in dashboard
 *
 * Tests verify the JS function implementations in the built index.html.
 *
 * Acceptance Criteria:
 * 1. queueBacklogEntry JS function exists in index.html
 * 2. unqueueBacklogEntry JS function exists in index.html
 * 3. queueBacklogEntry POSTs to /api/backlog/:id/queue
 * 4. unqueueBacklogEntry sends DELETE to /api/backlog/:id/queue
 * 5. On success, queueBacklogEntry calls loadBacklog()
 * 6. On error, queueBacklogEntry shows error in .backlog-card-error element
 * 7. queueBacklogEntry disables button and shows 'Queuing...' while in flight
 * 8. queueBacklogEntry sends workflowId in request body
 * 9. unqueueBacklogEntry calls loadBacklog() on success
 * 10. unqueueBacklogEntry disables button while in flight
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const HTML_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../dist/server/index.html"
);

describe("US-006: queueBacklogEntry and unqueueBacklogEntry JS functions", () => {
  let html: string;
  let queueFn: string;
  let unqueueFn: string;

  before(() => {
    html = fs.readFileSync(HTML_PATH, "utf8");

    // Extract queueBacklogEntry function body
    const queueStart = html.indexOf("async function queueBacklogEntry(");
    assert.ok(queueStart !== -1, "queueBacklogEntry must exist");
    const queueEnd = html.indexOf("\nasync function ", queueStart + 1);
    queueFn =
      queueEnd !== -1
        ? html.slice(queueStart, queueEnd)
        : html.slice(queueStart, queueStart + 3000);

    // Extract unqueueBacklogEntry function body
    const unqueueStart = html.indexOf("async function unqueueBacklogEntry(");
    assert.ok(unqueueStart !== -1, "unqueueBacklogEntry must exist");
    const unqueueEnd = html.indexOf("\nasync function ", unqueueStart + 1);
    unqueueFn =
      unqueueEnd !== -1
        ? html.slice(unqueueStart, unqueueEnd)
        : html.slice(unqueueStart, unqueueStart + 3000);
  });

  // AC 1: queueBacklogEntry JS function exists
  it("AC1: queueBacklogEntry async function exists in index.html", () => {
    assert.ok(
      html.includes("async function queueBacklogEntry("),
      "queueBacklogEntry must be defined as an async function"
    );
  });

  // AC 2: unqueueBacklogEntry JS function exists
  it("AC2: unqueueBacklogEntry async function exists in index.html", () => {
    assert.ok(
      html.includes("async function unqueueBacklogEntry("),
      "unqueueBacklogEntry must be defined as an async function"
    );
  });

  // AC 3: queueBacklogEntry POSTs to /api/backlog/:id/queue
  it("AC3: queueBacklogEntry uses POST method to /api/backlog/:id/queue", () => {
    assert.ok(
      queueFn.includes("/api/backlog/") && queueFn.includes("/queue"),
      "queueBacklogEntry must call /api/backlog/:id/queue"
    );
    assert.ok(
      queueFn.includes("method: 'POST'") || queueFn.includes('method: "POST"'),
      "queueBacklogEntry must use POST method"
    );
  });

  // AC 4: unqueueBacklogEntry sends DELETE to /api/backlog/:id/queue
  it("AC4: unqueueBacklogEntry uses DELETE method to /api/backlog/:id/queue", () => {
    assert.ok(
      unqueueFn.includes("/api/backlog/") && unqueueFn.includes("/queue"),
      "unqueueBacklogEntry must call /api/backlog/:id/queue"
    );
    assert.ok(
      unqueueFn.includes("method: 'DELETE'") ||
        unqueueFn.includes('method: "DELETE"'),
      "unqueueBacklogEntry must use DELETE method"
    );
  });

  // AC 5: On success, queueBacklogEntry calls loadBacklog()
  it("AC5: queueBacklogEntry calls loadBacklog() on success", () => {
    assert.ok(
      queueFn.includes("loadBacklog()"),
      "queueBacklogEntry must call loadBacklog() on success"
    );
  });

  // AC 6: On error, queueBacklogEntry shows error in .backlog-card-error
  it("AC6: queueBacklogEntry shows error in .backlog-card-error on failure", () => {
    assert.ok(
      queueFn.includes("backlog-card-error"),
      "queueBacklogEntry must reference .backlog-card-error for error display"
    );
    // Should show the error element on error
    assert.ok(
      queueFn.includes("display = 'block'") ||
        queueFn.includes("display='block'") ||
        queueFn.includes('display = "block"'),
      "queueBacklogEntry must make error element visible on error"
    );
  });

  // AC 7 additional: button disabling behavior
  it("queueBacklogEntry disables the button before fetch", () => {
    assert.ok(
      queueFn.includes("btn.disabled = true") ||
        queueFn.includes("btn.disabled=true"),
      "queueBacklogEntry must disable the button"
    );
  });

  it("queueBacklogEntry shows 'Queuing...' text while in flight", () => {
    assert.ok(
      queueFn.includes("Queuing..."),
      "queueBacklogEntry must set button text to 'Queuing...'"
    );
  });

  it("queueBacklogEntry re-enables button on error", () => {
    // After error, button should be re-enabled
    assert.ok(
      queueFn.includes("btn.disabled = false") ||
        queueFn.includes("btn.disabled=false"),
      "queueBacklogEntry must re-enable the button on error"
    );
  });

  it("queueBacklogEntry sends workflowId in request body from currentWf", () => {
    assert.ok(
      queueFn.includes("workflowId: currentWf?.id") ||
        queueFn.includes("workflowId: currentWf && currentWf.id"),
      "queueBacklogEntry must include workflowId: currentWf?.id in request body"
    );
  });

  it("queueBacklogEntry sends JSON Content-Type header", () => {
    assert.ok(
      queueFn.includes("Content-Type") && queueFn.includes("application/json"),
      "queueBacklogEntry must set Content-Type: application/json"
    );
  });

  // AC 9: unqueueBacklogEntry calls loadBacklog() on success
  it("AC9: unqueueBacklogEntry calls loadBacklog() on success", () => {
    assert.ok(
      unqueueFn.includes("loadBacklog()"),
      "unqueueBacklogEntry must call loadBacklog() on success"
    );
  });

  // AC 10: unqueueBacklogEntry disables button while in flight
  it("AC10: unqueueBacklogEntry disables the button while in flight", () => {
    assert.ok(
      unqueueFn.includes("btn.disabled = true") ||
        unqueueFn.includes("btn.disabled=true"),
      "unqueueBacklogEntry must disable the button"
    );
  });

  it("unqueueBacklogEntry re-enables button on error", () => {
    assert.ok(
      unqueueFn.includes("btn.disabled = false") ||
        unqueueFn.includes("btn.disabled=false"),
      "unqueueBacklogEntry must re-enable the button on error"
    );
  });

  it("unqueueBacklogEntry shows error in .backlog-card-error on failure", () => {
    assert.ok(
      unqueueFn.includes("backlog-card-error"),
      "unqueueBacklogEntry must reference .backlog-card-error for error display"
    );
  });

  it("queueBacklogEntry uses fetch API", () => {
    assert.ok(
      queueFn.includes("fetch("),
      "queueBacklogEntry must use fetch API"
    );
  });

  it("unqueueBacklogEntry uses fetch API", () => {
    assert.ok(
      unqueueFn.includes("fetch("),
      "unqueueBacklogEntry must use fetch API"
    );
  });

  it("both functions accept id and btn parameters", () => {
    assert.ok(
      html.includes("async function queueBacklogEntry(id, btn)") ||
        html.includes("async function queueBacklogEntry(id,btn)"),
      "queueBacklogEntry must accept (id, btn) parameters"
    );
    assert.ok(
      html.includes("async function unqueueBacklogEntry(id, btn)") ||
        html.includes("async function unqueueBacklogEntry(id,btn)"),
      "unqueueBacklogEntry must accept (id, btn) parameters"
    );
  });
});
