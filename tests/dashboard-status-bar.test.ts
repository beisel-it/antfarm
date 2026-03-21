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

describe("US-002: Move Medic badge into the status bar", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");

  it("medic-badge is a direct child of #status-bar, not inside <header>", () => {
    const statusBarIdx = html.indexOf('<footer id="status-bar">');
    const medicBadgeIdx = html.indexOf('id="medic-badge"');
    assert.ok(statusBarIdx !== -1, "footer#status-bar should exist");
    assert.ok(medicBadgeIdx !== -1, "medic-badge should exist");
    // medic-badge should appear AFTER status-bar opening tag
    assert.ok(
      medicBadgeIdx > statusBarIdx,
      "medic-badge should appear after <footer id=\"status-bar\">"
    );
    // medic-badge should appear BEFORE the </footer> tag
    const footerCloseIdx = html.indexOf("</footer>", statusBarIdx);
    assert.ok(
      medicBadgeIdx < footerCloseIdx,
      "medic-badge should be inside the #status-bar footer element"
    );
  });

  it("medic-badge is NOT inside <header>", () => {
    const headerStart = html.indexOf("<header");
    const headerEnd = html.indexOf("</header>");
    const medicBadgeIdx = html.indexOf('id="medic-badge"');
    assert.ok(headerStart !== -1, "header should exist");
    assert.ok(headerEnd !== -1, "header closing tag should exist");
    assert.ok(medicBadgeIdx !== -1, "medic-badge should exist");
    const isInsideHeader = medicBadgeIdx > headerStart && medicBadgeIdx < headerEnd;
    assert.ok(!isInsideHeader, "medic-badge should NOT be inside <header>");
  });

  it("medic-panel CSS has bottom:40px (opens upward from status bar)", () => {
    const ruleIdx = html.indexOf(".medic-panel{");
    assert.ok(ruleIdx !== -1, ".medic-panel CSS rule should exist");
    const rule = html.slice(ruleIdx, ruleIdx + 400);
    assert.ok(
      rule.includes("bottom:40px"),
      "Expected bottom:40px in .medic-panel rule"
    );
  });

  it("medic-panel CSS does NOT have top:60px", () => {
    const ruleIdx = html.indexOf(".medic-panel{");
    assert.ok(ruleIdx !== -1, ".medic-panel CSS rule should exist");
    const rule = html.slice(ruleIdx, ruleIdx + 400);
    assert.ok(
      !rule.includes("top:60px"),
      "Expected top:60px to be removed from .medic-panel rule"
    );
  });

  it("medic-panel CSS has right:16px", () => {
    const ruleIdx = html.indexOf(".medic-panel{");
    assert.ok(ruleIdx !== -1, ".medic-panel CSS rule should exist");
    const rule = html.slice(ruleIdx, ruleIdx + 400);
    assert.ok(
      rule.includes("right:16px"),
      "Expected right:16px in .medic-panel rule"
    );
  });

  it("medic-badge still calls toggleMedicPanel() on click", () => {
    assert.ok(
      html.includes('onclick="toggleMedicPanel()"'),
      "medic-badge should still call toggleMedicPanel() on click"
    );
  });

  it("dist: medic-badge is inside footer#status-bar", () => {
    const statusBarIdx = distHtml.indexOf('<footer id="status-bar">');
    const medicBadgeIdx = distHtml.indexOf('id="medic-badge"');
    const footerCloseIdx = distHtml.indexOf("</footer>", statusBarIdx);
    assert.ok(statusBarIdx !== -1, "footer#status-bar should exist in dist");
    assert.ok(medicBadgeIdx !== -1, "medic-badge should exist in dist");
    assert.ok(
      medicBadgeIdx > statusBarIdx && medicBadgeIdx < footerCloseIdx,
      "medic-badge should be inside footer#status-bar in dist"
    );
  });

  it("dist: medic-panel CSS has bottom:40px", () => {
    const ruleIdx = distHtml.indexOf(".medic-panel{");
    assert.ok(ruleIdx !== -1, ".medic-panel CSS rule should exist in dist");
    const rule = distHtml.slice(ruleIdx, ruleIdx + 400);
    assert.ok(rule.includes("bottom:40px"), "Expected bottom:40px in dist .medic-panel rule");
  });
});

describe("US-003: Move Auto-Refresh note into the status bar", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");

  it("#refresh-note is inside #status-bar, not inside <header>", () => {
    const statusBarIdx = html.indexOf('<footer id="status-bar">');
    const footerCloseIdx = html.indexOf("</footer>", statusBarIdx);
    const refreshNoteIdx = html.indexOf('id="refresh-note"');
    assert.ok(statusBarIdx !== -1, "footer#status-bar should exist");
    assert.ok(refreshNoteIdx !== -1, "#refresh-note should exist");
    assert.ok(
      refreshNoteIdx > statusBarIdx && refreshNoteIdx < footerCloseIdx,
      "#refresh-note should be inside <footer id=\"status-bar\">"
    );
  });

  it("#refresh-note is NOT inside <header>", () => {
    const headerStart = html.indexOf("<header");
    const headerEnd = html.indexOf("</header>");
    const refreshNoteIdx = html.indexOf('id="refresh-note"');
    assert.ok(headerStart !== -1, "<header> should exist");
    assert.ok(headerEnd !== -1, "</header> should exist");
    assert.ok(refreshNoteIdx !== -1, "#refresh-note should exist");
    const isInsideHeader = refreshNoteIdx > headerStart && refreshNoteIdx < headerEnd;
    assert.ok(!isInsideHeader, "#refresh-note should NOT be inside <header>");
  });

  it("#refresh-note displays 'Auto-refresh: 30s' text", () => {
    assert.ok(
      html.includes('>Auto-refresh: 30s<'),
      "Expected #refresh-note to contain text 'Auto-refresh: 30s'"
    );
  });

  it(".refresh-note CSS does not have margin-left:auto", () => {
    const ruleIdx = html.indexOf(".refresh-note{");
    assert.ok(ruleIdx !== -1, ".refresh-note CSS rule should exist");
    const rule = html.slice(ruleIdx, ruleIdx + 200);
    assert.ok(
      !rule.includes("margin-left:auto"),
      "Expected margin-left:auto to be removed from .refresh-note rule"
    );
  });

  it("dist: #refresh-note is inside #status-bar", () => {
    const statusBarIdx = distHtml.indexOf('<footer id="status-bar">');
    const footerCloseIdx = distHtml.indexOf("</footer>", statusBarIdx);
    const refreshNoteIdx = distHtml.indexOf('id="refresh-note"');
    assert.ok(statusBarIdx !== -1, "footer#status-bar should exist in dist");
    assert.ok(refreshNoteIdx !== -1, "#refresh-note should exist in dist");
    assert.ok(
      refreshNoteIdx > statusBarIdx && refreshNoteIdx < footerCloseIdx,
      "#refresh-note should be inside footer#status-bar in dist"
    );
  });

  it("dist: #refresh-note is NOT inside <header>", () => {
    const headerStart = distHtml.indexOf("<header");
    const headerEnd = distHtml.indexOf("</header>");
    const refreshNoteIdx = distHtml.indexOf('id="refresh-note"');
    assert.ok(headerStart !== -1, "<header> should exist in dist");
    assert.ok(headerEnd !== -1, "</header> should exist in dist");
    assert.ok(refreshNoteIdx !== -1, "#refresh-note should exist in dist");
    const isInsideHeader = refreshNoteIdx > headerStart && refreshNoteIdx < headerEnd;
    assert.ok(!isInsideHeader, "#refresh-note should NOT be inside <header> in dist");
  });

  it("dist: #refresh-note displays 'Auto-refresh: 30s' text", () => {
    assert.ok(
      distHtml.includes('>Auto-refresh: 30s<'),
      "Expected #refresh-note to contain 'Auto-refresh: 30s' in dist"
    );
  });
});

describe("US-004: Add 'Last refreshed' timestamp to the status bar", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");

  it("<span id=\"last-refreshed\"> exists in the HTML", () => {
    assert.ok(
      html.includes('<span id="last-refreshed">'),
      'Expected <span id="last-refreshed"> in src/server/index.html'
    );
  });

  it("<span id=\"last-refreshed\"> is inside #status-bar", () => {
    const statusBarIdx = html.indexOf('<footer id="status-bar">');
    const footerCloseIdx = html.indexOf("</footer>", statusBarIdx);
    const lastRefreshedIdx = html.indexOf('id="last-refreshed"');
    assert.ok(statusBarIdx !== -1, "footer#status-bar should exist");
    assert.ok(lastRefreshedIdx !== -1, "#last-refreshed should exist");
    assert.ok(
      lastRefreshedIdx > statusBarIdx && lastRefreshedIdx < footerCloseIdx,
      '#last-refreshed should be inside <footer id="status-bar">'
    );
  });

  it("#last-refreshed initial text is 'Last refresh: —'", () => {
    assert.ok(
      html.includes('>Last refresh: —<'),
      "Expected #last-refreshed to have initial text 'Last refresh: —'"
    );
  });

  it("updateLastRefreshed() function is defined in the script", () => {
    assert.ok(
      html.includes("function updateLastRefreshed()"),
      "Expected updateLastRefreshed() function to be defined"
    );
  });

  it("updateLastRefreshed() sets text using toLocaleTimeString()", () => {
    assert.ok(
      html.includes("toLocaleTimeString()"),
      "Expected toLocaleTimeString() to be used in updateLastRefreshed()"
    );
  });

  it("updateLastRefreshed() is called after loadRuns()", () => {
    const loadRunsIdx = html.indexOf("async function loadRuns()");
    assert.ok(loadRunsIdx !== -1, "loadRuns() should exist");
    // Find the closing brace of loadRuns — look for updateLastRefreshed() after loadRuns()
    const loadRunsSection = html.slice(loadRunsIdx, loadRunsIdx + 500);
    assert.ok(
      loadRunsSection.includes("updateLastRefreshed()"),
      "Expected updateLastRefreshed() to be called inside loadRuns()"
    );
  });

  it("updateLastRefreshed() is called after loadBacklog()", () => {
    const loadBacklogIdx = html.indexOf("async function loadBacklog()");
    assert.ok(loadBacklogIdx !== -1, "loadBacklog() should exist");
    const loadBacklogSection = html.slice(loadBacklogIdx, loadBacklogIdx + 300);
    assert.ok(
      loadBacklogSection.includes("updateLastRefreshed()"),
      "Expected updateLastRefreshed() to be called inside loadBacklog()"
    );
  });

  it("updateLastRefreshed() is called after loadProjects()", () => {
    const loadProjectsIdx = html.indexOf("async function loadProjects()");
    assert.ok(loadProjectsIdx !== -1, "loadProjects() should exist");
    const loadProjectsSection = html.slice(loadProjectsIdx, loadProjectsIdx + 300);
    assert.ok(
      loadProjectsSection.includes("updateLastRefreshed()"),
      "Expected updateLastRefreshed() to be called inside loadProjects()"
    );
  });

  it("dist: <span id=\"last-refreshed\"> exists", () => {
    assert.ok(
      distHtml.includes('<span id="last-refreshed">'),
      'Expected <span id="last-refreshed"> in dist/server/index.html'
    );
  });

  it("dist: #last-refreshed is inside #status-bar", () => {
    const statusBarIdx = distHtml.indexOf('<footer id="status-bar">');
    const footerCloseIdx = distHtml.indexOf("</footer>", statusBarIdx);
    const lastRefreshedIdx = distHtml.indexOf('id="last-refreshed"');
    assert.ok(statusBarIdx !== -1, "footer#status-bar should exist in dist");
    assert.ok(lastRefreshedIdx !== -1, "#last-refreshed should exist in dist");
    assert.ok(
      lastRefreshedIdx > statusBarIdx && lastRefreshedIdx < footerCloseIdx,
      "#last-refreshed should be inside footer#status-bar in dist"
    );
  });

  it("dist: updateLastRefreshed() function is defined", () => {
    assert.ok(
      distHtml.includes("function updateLastRefreshed()"),
      "Expected updateLastRefreshed() function in dist/server/index.html"
    );
  });
});
