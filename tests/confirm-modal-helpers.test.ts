import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");
const html = fs.readFileSync(htmlPath, "utf8");

describe("US-002: confirm modal HTML element", () => {
  it('has <div id="confirm-modal-overlay"> in the HTML body', () => {
    assert.ok(
      html.includes('id="confirm-modal-overlay"'),
      'Expected id="confirm-modal-overlay" element in index.html'
    );
  });

  it("confirm-modal-overlay uses class overlay", () => {
    const idx = html.indexOf('id="confirm-modal-overlay"');
    const before = html.slice(Math.max(0, idx - 60), idx + 50);
    assert.ok(
      before.includes('class="overlay"') || html.slice(idx - 80, idx + 10).includes('class="overlay"'),
      'Expected class="overlay" on confirm-modal-overlay element'
    );
  });

  it("confirm-modal-overlay is hidden by default (display:none)", () => {
    const idx = html.indexOf('id="confirm-modal-overlay"');
    const surrounds = html.slice(Math.max(0, idx - 80), idx + 80);
    assert.ok(
      surrounds.includes("display:none"),
      "Expected display:none on confirm-modal-overlay"
    );
  });

  it("confirm-modal-overlay has backdrop-click handler to cancel", () => {
    const idx = html.indexOf('id="confirm-modal-overlay"');
    const surrounds = html.slice(Math.max(0, idx - 80), idx + 200);
    assert.ok(
      surrounds.includes("closeConfirmModal(false)"),
      "Expected onclick closeConfirmModal(false) for backdrop click"
    );
  });

  it("has confirm-modal-title element", () => {
    assert.ok(
      html.includes('id="confirm-modal-title"'),
      'Expected id="confirm-modal-title" element'
    );
  });

  it("has confirm-modal-body element", () => {
    assert.ok(
      html.includes('id="confirm-modal-body"'),
      'Expected id="confirm-modal-body" element'
    );
  });

  it("has confirm-modal-confirm-btn with class confirm-btn-danger", () => {
    assert.ok(
      html.includes('id="confirm-modal-confirm-btn"'),
      'Expected id="confirm-modal-confirm-btn"'
    );
    // find the confirm button and check its class
    const idx = html.indexOf('id="confirm-modal-confirm-btn"');
    const around = html.slice(Math.max(0, idx - 80), idx + 20);
    assert.ok(
      around.includes('confirm-btn-danger'),
      'Expected confirm-btn-danger class on confirm button'
    );
  });

  it("has confirm-modal-cancel-btn with class confirm-btn-cancel", () => {
    assert.ok(
      html.includes('id="confirm-modal-cancel-btn"'),
      'Expected id="confirm-modal-cancel-btn"'
    );
    const idx = html.indexOf('id="confirm-modal-cancel-btn"');
    const around = html.slice(Math.max(0, idx - 80), idx + 20);
    assert.ok(
      around.includes('confirm-btn-cancel'),
      'Expected confirm-btn-cancel class on cancel button'
    );
  });
});

describe("US-002: showConfirmModal and closeConfirmModal JS functions", () => {
  it("showConfirmModal function is defined in the script", () => {
    assert.ok(
      html.includes("function showConfirmModal("),
      "Expected function showConfirmModal() in index.html script"
    );
  });

  it("showConfirmModal returns a Promise (uses new Promise)", () => {
    const idx = html.indexOf("function showConfirmModal(");
    const fnBody = html.slice(idx, idx + 600);
    assert.ok(
      fnBody.includes("new Promise("),
      "Expected showConfirmModal to return a new Promise"
    );
    assert.ok(
      fnBody.includes("return new Promise("),
      "Expected showConfirmModal to return the Promise"
    );
  });

  it("showConfirmModal resolves to a boolean (resolve(!!result))", () => {
    // closeConfirmModal must call resolve with a boolean-coerced value
    const idx = html.indexOf("function closeConfirmModal(");
    const fnBody = html.slice(idx, idx + 400);
    assert.ok(
      fnBody.includes("resolve(!!result)"),
      "Expected closeConfirmModal to call resolve(!!result)"
    );
  });

  it("showConfirmModal shows the overlay (adds 'open' class)", () => {
    const idx = html.indexOf("function showConfirmModal(");
    const fnBody = html.slice(idx, idx + 900);
    assert.ok(
      fnBody.includes("classList.add('open')"),
      "Expected classList.add('open') in showConfirmModal"
    );
  });

  it("closeConfirmModal function is defined", () => {
    assert.ok(
      html.includes("function closeConfirmModal("),
      "Expected function closeConfirmModal() in index.html script"
    );
  });

  it("closeConfirmModal hides the overlay (removes 'open' class)", () => {
    const idx = html.indexOf("function closeConfirmModal(");
    const fnBody = html.slice(idx, idx + 400);
    assert.ok(
      fnBody.includes("classList.remove('open')"),
      "Expected classList.remove('open') in closeConfirmModal"
    );
  });

  it("confirm button calls closeConfirmModal(true)", () => {
    const idx = html.indexOf('id="confirm-modal-confirm-btn"');
    const around = html.slice(Math.max(0, idx - 100), idx + 100);
    assert.ok(
      around.includes("closeConfirmModal(true)"),
      "Expected confirm button to call closeConfirmModal(true)"
    );
  });

  it("cancel button calls closeConfirmModal(false)", () => {
    const idx = html.indexOf('id="confirm-modal-cancel-btn"');
    const around = html.slice(Math.max(0, idx - 100), idx + 100);
    assert.ok(
      around.includes("closeConfirmModal(false)"),
      "Expected cancel button to call closeConfirmModal(false)"
    );
  });

  it("Escape key listener calls closeConfirmModal(false) when modal is open", () => {
    // Check that keydown listener handles Escape and calls closeConfirmModal(false)
    const keydownIdx = html.indexOf("document.addEventListener('keydown'");
    assert.ok(keydownIdx !== -1, "Expected keydown event listener");
    const listenerBody = html.slice(keydownIdx, keydownIdx + 600);
    assert.ok(
      listenerBody.includes("closeConfirmModal(false)"),
      "Expected closeConfirmModal(false) in Escape key handler"
    );
    assert.ok(
      listenerBody.includes("Escape"),
      "Expected Escape key check in keydown listener"
    );
  });

  it("backdrop click cancels modal (onclick with closeConfirmModal(false))", () => {
    const idx = html.indexOf('id="confirm-modal-overlay"');
    const tag = html.slice(Math.max(0, idx - 100), idx + 200);
    assert.ok(
      tag.includes("closeConfirmModal(false)"),
      "Expected backdrop onclick to call closeConfirmModal(false)"
    );
  });

  it("_confirmResolve module-level variable is declared", () => {
    assert.ok(
      html.includes("_confirmResolve"),
      "Expected _confirmResolve variable for storing promise resolver"
    );
  });
});
