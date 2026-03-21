import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");
const distHtmlPath = path.join(__dirname, "../dist/server/index.html");

describe("US-001: Status bar HTML element and base CSS", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");

  it("<footer id=\"status-bar\"> exists in the HTML", () => {
    assert.ok(
      html.includes('<footer id="status-bar">'),
      'Expected <footer id="status-bar"> in src/server/index.html'
    );
  });

  it("<footer id=\"status-bar\"> appears just before </body>", () => {
    const footerIdx = html.indexOf('<footer id="status-bar">');
    const scriptIdx = html.indexOf('<script>');
    // footer should come before the closing script block, right before </body>
    assert.ok(footerIdx !== -1, "footer element should exist");
    assert.ok(
      footerIdx < scriptIdx,
      "footer should appear before the <script> block (i.e., before </body>)"
    );
  });

  it("CSS rule #status-bar exists", () => {
    assert.ok(
      html.includes("#status-bar{"),
      "Expected #status-bar CSS rule in src/server/index.html"
    );
  });

  it("status bar is position:fixed", () => {
    const ruleIdx = html.indexOf("#status-bar{");
    const rule = html.slice(ruleIdx, ruleIdx + 300);
    assert.ok(rule.includes("position:fixed"), "Expected position:fixed in #status-bar rule");
  });

  it("status bar is anchored to bottom:0", () => {
    const ruleIdx = html.indexOf("#status-bar{");
    const rule = html.slice(ruleIdx, ruleIdx + 300);
    assert.ok(rule.includes("bottom:0"), "Expected bottom:0 in #status-bar rule");
  });

  it("status bar spans full width (left:0; right:0)", () => {
    const ruleIdx = html.indexOf("#status-bar{");
    const rule = html.slice(ruleIdx, ruleIdx + 300);
    assert.ok(rule.includes("left:0"), "Expected left:0 in #status-bar rule");
    assert.ok(rule.includes("right:0"), "Expected right:0 in #status-bar rule");
  });

  it("status bar height is 36px", () => {
    const ruleIdx = html.indexOf("#status-bar{");
    const rule = html.slice(ruleIdx, ruleIdx + 300);
    assert.ok(rule.includes("height:36px"), "Expected height:36px in #status-bar rule");
  });

  it("status bar uses --header-bg (same green as header)", () => {
    const ruleIdx = html.indexOf("#status-bar{");
    const rule = html.slice(ruleIdx, ruleIdx + 300);
    assert.ok(
      rule.includes("background:var(--header-bg)"),
      "Expected background:var(--header-bg) in #status-bar rule"
    );
  });

  it("status bar has border-top using --header-border", () => {
    const ruleIdx = html.indexOf("#status-bar{");
    const rule = html.slice(ruleIdx, ruleIdx + 300);
    assert.ok(
      rule.includes("border-top:1px solid var(--header-border)"),
      "Expected border-top:1px solid var(--header-border) in #status-bar rule"
    );
  });

  it("status bar has z-index:40 (below overlays at z-index:100)", () => {
    const ruleIdx = html.indexOf("#status-bar{");
    const rule = html.slice(ruleIdx, ruleIdx + 300);
    assert.ok(rule.includes("z-index:40"), "Expected z-index:40 in #status-bar rule");
  });

  it("body has padding-bottom:36px so content is not hidden behind bar", () => {
    assert.ok(
      html.includes("padding-bottom:36px"),
      "Expected padding-bottom:36px in body rule"
    );
  });

  it(".board min-height is adjusted to calc(100vh - 101px)", () => {
    assert.ok(
      html.includes("min-height:calc(100vh - 101px)"),
      "Expected min-height:calc(100vh - 101px) in .board rule (header 65px + status bar 36px)"
    );
  });

  it("dist/server/index.html also contains footer#status-bar (build copied correctly)", () => {
    assert.ok(
      distHtml.includes('<footer id="status-bar">'),
      "Expected footer#status-bar in dist/server/index.html after build"
    );
  });

  it("dist/server/index.html also contains #status-bar CSS rule", () => {
    assert.ok(
      distHtml.includes("#status-bar{"),
      "Expected #status-bar CSS in dist/server/index.html after build"
    );
  });
});
