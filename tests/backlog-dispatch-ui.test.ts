/**
 * US-006/US-010: Tests for Dispatch button functionality in the dashboard.
 * Verifies HTML structure for confirm dialog (using showConfirmModal), loading state,
 * dispatched state, error handling, and workflowId passthrough.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const HTML_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../dist/server/index.html"
);

describe("US-006/US-010: Dispatch button functionality (HTML structure)", () => {
  let html: string;

  before(() => {
    html = fs.readFileSync(HTML_PATH, "utf8");
  });

  it("dispatchBacklogEntry function exists in HTML", () => {
    assert.ok(
      html.includes("async function dispatchBacklogEntry("),
      "dispatchBacklogEntry function must exist"
    );
  });

  it("dispatchBacklogEntry uses showConfirmModal instead of native confirm()", () => {
    const fnStart = html.indexOf("async function dispatchBacklogEntry(");
    assert.ok(fnStart !== -1, "dispatchBacklogEntry function must exist");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 10);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    assert.ok(
      fn.includes("showConfirmModal("),
      "dispatchBacklogEntry must use showConfirmModal()"
    );
    assert.ok(
      !fn.includes("confirm(`Dispatch") && !fn.includes('confirm("Dispatch'),
      "dispatchBacklogEntry must not use native confirm() for dispatch"
    );
  });

  it("showConfirmModal is called with correct labels for dispatch", () => {
    const fnStart = html.indexOf("async function dispatchBacklogEntry(");
    assert.ok(fnStart !== -1, "dispatchBacklogEntry function must exist");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 10);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    assert.ok(
      fn.includes("'Dispatch entry'") || fn.includes('"Dispatch entry"'),
      "showConfirmModal must have title 'Dispatch entry'"
    );
    assert.ok(
      fn.includes("confirmLabel: 'Dispatch'") || fn.includes('confirmLabel: "Dispatch"'),
      "showConfirmModal must have confirmLabel: 'Dispatch'"
    );
    assert.ok(
      fn.includes("cancelLabel: 'Cancel'") || fn.includes('cancelLabel: "Cancel"'),
      "showConfirmModal must have cancelLabel: 'Cancel'"
    );
  });

  it("on cancel (showConfirmModal returns false), dispatch is not triggered", () => {
    const fnStart = html.indexOf("async function dispatchBacklogEntry(");
    assert.ok(fnStart !== -1, "dispatchBacklogEntry function must exist");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 10);
    const fn = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 2000);
    // Must return early when modal is declined
    assert.ok(
      fn.includes("if (!ok) return;"),
      "dispatch must return early when user cancels showConfirmModal"
    );
  });

  it("button shows 'Dispatching...' during in-flight request", () => {
    assert.ok(
      html.includes("'Dispatching...'") || html.includes('"Dispatching..."'),
      "button text must be 'Dispatching...' while in flight"
    );
  });

  it("dispatched button shows 'Dispatched ✓'", () => {
    assert.ok(
      html.includes("'Dispatched ✓'") || html.includes('"Dispatched ✓"'),
      "dispatched button label must be 'Dispatched ✓'"
    );
  });

  it("dispatch POST body includes workflowId from currentWf", () => {
    assert.ok(
      html.includes("workflowId: currentWf?.id") ||
        html.includes("workflowId: currentWf && currentWf.id"),
      "dispatch POST must include workflowId from currentWf"
    );
  });

  it("error is shown inline on the card (not via alert)", () => {
    assert.ok(
      html.includes("backlog-card-error"),
      "error element class must exist for inline display"
    );
    // Must set display:block on error
    assert.ok(
      html.includes("errEl.style.display = 'block'") ||
        html.includes('errEl.style.display = "block"'),
      "error element must be shown (display:block) on error"
    );
    // Must NOT use alert() for dispatch errors
    const dispatchFnStart = html.indexOf("async function dispatchBacklogEntry(");
    const dispatchFnEnd = html.indexOf("\n}", dispatchFnStart);
    const dispatchFn = html.slice(dispatchFnStart, dispatchFnEnd + 2);
    assert.ok(
      !dispatchFn.includes("alert("),
      "dispatch function must not use alert() for errors"
    );
  });

  it("card has data-backlog-title attribute for confirm dialog", () => {
    assert.ok(
      html.includes("data-backlog-title="),
      "backlog card must have data-backlog-title attribute"
    );
  });

  it("dispatched card gets 'dispatched' class added in-place", () => {
    assert.ok(
      html.includes("card.classList.add('dispatched')") ||
        html.includes('card.classList.add("dispatched")'),
      "dispatched card must get 'dispatched' CSS class"
    );
  });

  it("dispatched button is disabled in rendered HTML", () => {
    assert.ok(
      html.includes("isDispatched ? 'disabled' : ''") ||
        html.includes('isDispatched ? "disabled" : ""') ||
        html.includes("isDispatched || hasActiveRun ? 'disabled'") ||
        html.includes('isDispatched || hasActiveRun ? "disabled"') ||
        html.includes("isDispatched || hasActiveRun || isQueued ? 'disabled'") ||
        html.includes('isDispatched || hasActiveRun || isQueued ? "disabled"'),
      "dispatched entries must render with disabled button"
    );
  });

  it("on success button text is 'Dispatched ✓' and disabled", () => {
    const dispatchFnStart = html.indexOf("async function dispatchBacklogEntry(");
    const dispatchFnEnd = html.indexOf("\n}", dispatchFnStart);
    const dispatchFn = html.slice(dispatchFnStart, dispatchFnEnd + 2);
    assert.ok(
      dispatchFn.includes("Dispatched ✓"),
      "success path must set 'Dispatched ✓' text"
    );
    assert.ok(
      dispatchFn.includes("btn.disabled = true"),
      "success path must disable the button"
    );
  });

  it("error element has red color styling", () => {
    assert.ok(
      html.includes("backlog-card-error") &&
        (html.includes("color:var(--status-failed") || html.includes("color:#e05") || html.includes("color:red")),
      "error element must have red color styling"
    );
  });
});

// Import 'before' for the before() call above
import { before } from "node:test";
