import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");

describe("US-001: confirm modal CSS classes", () => {
  const html = fs.readFileSync(htmlPath, "utf8");

  it(".confirm-modal exists with position:fixed and z-index >= 200", () => {
    assert.ok(
      html.includes(".confirm-modal{") || html.includes(".confirm-modal {"),
      "Expected .confirm-modal CSS rule in src/server/index.html"
    );
    const idx = html.indexOf(".confirm-modal{");
    const rule = html.slice(idx, idx + 300);
    assert.ok(
      rule.includes("position:fixed"),
      "Expected position:fixed in .confirm-modal rule"
    );
    // z-index >= 200
    const zMatch = rule.match(/z-index:(\d+)/);
    assert.ok(zMatch, "Expected z-index in .confirm-modal rule");
    assert.ok(
      parseInt(zMatch![1], 10) >= 200,
      `Expected z-index >= 200, got ${zMatch![1]}`
    );
  });

  it(".confirm-modal-backdrop exists with position:fixed and z-index >= 200", () => {
    assert.ok(
      html.includes(".confirm-modal-backdrop{"),
      "Expected .confirm-modal-backdrop CSS rule"
    );
    const idx = html.indexOf(".confirm-modal-backdrop{");
    const rule = html.slice(idx, idx + 300);
    assert.ok(rule.includes("position:fixed"), "Expected position:fixed in .confirm-modal-backdrop");
    const zMatch = rule.match(/z-index:(\d+)/);
    assert.ok(zMatch, "Expected z-index in .confirm-modal-backdrop rule");
    assert.ok(
      parseInt(zMatch![1], 10) >= 200,
      `Expected z-index >= 200, got ${zMatch![1]}`
    );
  });

  it(".confirm-modal-title class exists", () => {
    assert.ok(
      html.includes(".confirm-modal-title{"),
      "Expected .confirm-modal-title CSS rule"
    );
  });

  it(".confirm-modal-body class exists", () => {
    assert.ok(
      html.includes(".confirm-modal-body{"),
      "Expected .confirm-modal-body CSS rule"
    );
  });

  it(".confirm-modal-actions has display:flex, gap, and justify-content:flex-end", () => {
    assert.ok(
      html.includes(".confirm-modal-actions{"),
      "Expected .confirm-modal-actions CSS rule"
    );
    const idx = html.indexOf(".confirm-modal-actions{");
    const rule = html.slice(idx, idx + 200);
    assert.ok(rule.includes("display:flex"), "Expected display:flex in .confirm-modal-actions");
    assert.ok(rule.includes("gap:"), "Expected gap in .confirm-modal-actions");
    assert.ok(
      rule.includes("justify-content:flex-end"),
      "Expected justify-content:flex-end in .confirm-modal-actions"
    );
  });

  it(".confirm-btn-danger uses var(--accent-orange) background and white text", () => {
    assert.ok(
      html.includes(".confirm-btn-danger{"),
      "Expected .confirm-btn-danger CSS rule"
    );
    const idx = html.indexOf(".confirm-btn-danger{");
    const rule = html.slice(idx, idx + 200);
    assert.ok(
      rule.includes("background:var(--accent-orange)"),
      "Expected background:var(--accent-orange) in .confirm-btn-danger"
    );
    assert.ok(
      rule.includes("color:#fff") || rule.includes("color:white"),
      "Expected white text in .confirm-btn-danger"
    );
  });

  it(".confirm-btn-cancel uses var(--border) and var(--text-secondary)", () => {
    assert.ok(
      html.includes(".confirm-btn-cancel{"),
      "Expected .confirm-btn-cancel CSS rule"
    );
    const idx = html.indexOf(".confirm-btn-cancel{");
    const rule = html.slice(idx, idx + 200);
    assert.ok(
      rule.includes("var(--border)"),
      "Expected var(--border) in .confirm-btn-cancel"
    );
    assert.ok(
      rule.includes("var(--text-secondary)"),
      "Expected var(--text-secondary) in .confirm-btn-cancel"
    );
  });

  it(".inline-confirm class exists", () => {
    assert.ok(
      html.includes(".inline-confirm{"),
      "Expected .inline-confirm CSS rule"
    );
  });

  it(".inline-confirm-actions exists for expand animation", () => {
    assert.ok(
      html.includes(".inline-confirm-actions{"),
      "Expected .inline-confirm-actions CSS rule"
    );
  });

  it("no hardcoded hex colours in confirm modal rules (except #fff for danger button text)", () => {
    const startIdx = html.indexOf("/* ── Confirmation modal");
    assert.ok(startIdx !== -1, "Expected confirm modal CSS comment section");
    // End at inline-confirm section end (or end of style block)
    const endIdx = html.indexOf("</style>", startIdx);
    const section = html.slice(startIdx, endIdx);
    // Allow #fff (white text on orange button), disallow other hex colours
    const hexMatches = section.match(/[^-]#[0-9a-fA-F]{3,6}/g) || [];
    const nonWhiteHex = hexMatches.filter(m => !m.includes("#fff") && !m.includes("#FFF"));
    assert.strictEqual(
      nonWhiteHex.length,
      0,
      `Expected no hardcoded hex colours (except #fff), found: ${nonWhiteHex.join(", ")}`
    );
  });
});
