/**
 * US-005: Disable dispatch button in the dashboard UI when project run is active
 *
 * Tests:
 * 1. Dispatch button is rendered disabled when entry's project has a running run
 * 2. Disabled button has title containing 'already in flight'
 * 3. Button gets CSS class backlog-dispatch-btn--blocked when active run
 * 4. CSS for .backlog-dispatch-btn--blocked uses accent-orange and cursor:not-allowed
 * 5. allRuns global variable exists for storing runs data
 * 6. loadRuns() assigns to allRuns before rendering
 * 7. dispatchBacklogEntry handles 409 response by showing error and re-enabling button
 * 8. renderBacklogColumn checks project_id against allRuns for active run detection
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const HTML_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../dist/server/index.html"
);

describe("US-005: Dispatch button disabled when project run is active (HTML structure)", () => {
  let html: string;

  before(() => {
    html = fs.readFileSync(HTML_PATH, "utf8");
  });

  it("allRuns global variable is declared", () => {
    assert.ok(
      html.includes("let allRuns = []") || html.includes("let allRuns=[]"),
      "allRuns global variable must be declared"
    );
  });

  it("loadRuns() stores result in allRuns before rendering", () => {
    assert.ok(
      html.includes("allRuns = runs"),
      "loadRuns must assign runs to allRuns global"
    );
  });

  it("renderBacklogColumn checks project_id against allRuns for active run", () => {
    assert.ok(
      html.includes("entry.project_id") &&
        html.includes("allRuns.some("),
      "renderBacklogColumn must check entry.project_id against allRuns"
    );
  });

  it("active run check filters by project_id and status === 'running'", () => {
    assert.ok(
      html.includes("r.project_id === entry.project_id") &&
        html.includes("r.status === 'running'"),
      "active run check must filter by project_id and status === 'running'"
    );
  });

  it("dispatch button renders disabled when hasActiveRun is true", () => {
    assert.ok(
      html.includes("hasActiveRun") &&
        (html.includes("isDispatched || hasActiveRun ? 'disabled'") ||
         html.includes("isDispatched || hasActiveRun ? \"disabled\"")),
      "dispatch button must be disabled when hasActiveRun is true"
    );
  });

  it("disabled button gets backlog-dispatch-btn--blocked CSS class", () => {
    assert.ok(
      html.includes("backlog-dispatch-btn--blocked"),
      "blocked dispatch button must have backlog-dispatch-btn--blocked CSS class"
    );
  });

  it("disabled button has title containing 'already in flight'", () => {
    assert.ok(
      html.includes("already in flight"),
      "blocked dispatch button must have title containing 'already in flight'"
    );
  });

  it("CSS for .backlog-dispatch-btn--blocked includes accent-orange background", () => {
    assert.ok(
      html.includes(".backlog-dispatch-btn--blocked") &&
        html.includes("var(--accent-orange)"),
      ".backlog-dispatch-btn--blocked CSS rule must use var(--accent-orange)"
    );
  });

  it("CSS for .backlog-dispatch-btn--blocked includes cursor:not-allowed", () => {
    // Extract the CSS block for .backlog-dispatch-btn--blocked
    const idx = html.indexOf(".backlog-dispatch-btn--blocked");
    assert.ok(idx !== -1, ".backlog-dispatch-btn--blocked CSS rule must exist");
    const cssBlock = html.slice(idx, html.indexOf("}", idx) + 1);
    assert.ok(
      cssBlock.includes("cursor:not-allowed") || cssBlock.includes("cursor: not-allowed"),
      ".backlog-dispatch-btn--blocked must have cursor:not-allowed"
    );
  });

  it("dispatchBacklogEntry handles 409 response by showing error in .backlog-card-error", () => {
    const fnStart = html.indexOf("async function dispatchBacklogEntry(");
    assert.ok(fnStart !== -1, "dispatchBacklogEntry must exist");
    // Find the end of the function (last closing brace after it)
    const fnEnd = html.indexOf("\nasync function ", fnStart + 1);
    const fnBody = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 3000);
    assert.ok(
      fnBody.includes("r.status === 409") || fnBody.includes("r.status==409"),
      "dispatchBacklogEntry must check for 409 status"
    );
    assert.ok(
      fnBody.includes("errEl.style.display = 'block'") ||
        fnBody.includes('errEl.style.display = "block"'),
      "409 handler must show error element"
    );
  });

  it("dispatchBacklogEntry re-enables button on 409 response", () => {
    const fnStart = html.indexOf("async function dispatchBacklogEntry(");
    assert.ok(fnStart !== -1, "dispatchBacklogEntry must exist");
    const fnEnd = html.indexOf("\nasync function ", fnStart + 1);
    const fnBody = fnEnd !== -1 ? html.slice(fnStart, fnEnd) : html.slice(fnStart, fnStart + 3000);
    // Should have btn.disabled = false in the 409 block area
    const section409Start = fnBody.indexOf("r.status === 409") !== -1
      ? fnBody.indexOf("r.status === 409")
      : fnBody.indexOf("r.status==409");
    assert.ok(section409Start !== -1, "409 check must be present");
    // Look for btn.disabled = false after the 409 check
    const after409 = fnBody.slice(section409Start, section409Start + 300);
    assert.ok(
      after409.includes("btn.disabled = false"),
      "409 handler must re-enable button (btn.disabled = false)"
    );
  });
});
