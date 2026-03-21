import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");
const html = fs.readFileSync(htmlPath, "utf8");

// Helper: extract just the cancelRun function body (stop at next top-level async function)
function getCancelRunBody(): string {
  const idx = html.indexOf("async function cancelRun(");
  assert.ok(idx !== -1, "Expected cancelRun function in index.html");
  // Find end of function: next 'async function ' or 'function ' at start of line
  const after = html.indexOf("\nasync function ", idx + 10);
  const end = after !== -1 ? after : idx + 1200;
  return html.slice(idx, end);
}

describe("US-003: cancelRun uses showConfirmModal instead of native confirm/alert", () => {
  it("cancelRun function does not contain native confirm( call", () => {
    const fnBody = getCancelRunBody();
    assert.ok(
      !fnBody.includes("confirm("),
      "cancelRun must not call native confirm()"
    );
  });

  it("cancelRun function calls showConfirmModal(", () => {
    const fnBody = getCancelRunBody();
    assert.ok(
      fnBody.includes("showConfirmModal("),
      "cancelRun must call showConfirmModal()"
    );
  });

  it("cancelRun function does not call alert(", () => {
    const fnBody = getCancelRunBody();
    assert.ok(
      !fnBody.includes("alert("),
      "cancelRun must not call alert()"
    );
  });

  it("cancelRun awaits the result of showConfirmModal", () => {
    const fnBody = getCancelRunBody();
    assert.ok(
      fnBody.includes("await showConfirmModal("),
      "cancelRun must await showConfirmModal()"
    );
  });

  it("cancelRun passes confirmLabel 'Yes, cancel' to showConfirmModal", () => {
    const fnBody = getCancelRunBody();
    assert.ok(
      fnBody.includes("Yes, cancel"),
      "cancelRun must pass confirmLabel 'Yes, cancel' to showConfirmModal"
    );
  });

  it("cancelRun uses run-card-error for inline error display", () => {
    const fnBody = getCancelRunBody();
    assert.ok(
      fnBody.includes(".run-card-error"),
      "cancelRun must use .run-card-error for inline error display"
    );
  });
});

describe("US-003: run card HTML includes .run-card-error element", () => {
  it("run card template includes a .run-card-error div", () => {
    assert.ok(
      html.includes('run-card-error'),
      "Expected .run-card-error class in run card template"
    );
  });

  it("run card has data-run-id attribute for targeting", () => {
    // The run card should use data-run-id="${run.id}" for the cancelRun error element lookup
    assert.ok(
      html.includes("data-run-id="),
      "Expected data-run-id attribute on run cards"
    );
  });
});

describe("US-003: .run-card-error CSS class is defined", () => {
  it(".run-card-error CSS class exists in the stylesheet", () => {
    assert.ok(
      html.includes(".run-card-error{"),
      "Expected .run-card-error CSS class defined in index.html"
    );
  });

  it(".run-card-error is display:none by default", () => {
    const idx = html.indexOf(".run-card-error{");
    assert.ok(idx !== -1, "Expected .run-card-error CSS class");
    const cssRule = html.slice(idx, idx + 200);
    assert.ok(
      cssRule.includes("display:none"),
      "Expected .run-card-error to have display:none by default"
    );
  });

  it(".run-card-error has a red/orange color for error visibility", () => {
    const idx = html.indexOf(".run-card-error{");
    assert.ok(idx !== -1, "Expected .run-card-error CSS class");
    const cssRule = html.slice(idx, idx + 200);
    assert.ok(
      cssRule.includes("color:"),
      "Expected .run-card-error to have a color property"
    );
  });
});
