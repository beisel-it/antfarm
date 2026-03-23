import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");
const distHtmlPath = path.join(__dirname, "../dist/server/index.html");

const expectedOptions = [
  { value: "0", label: "Off" },
  { value: "10000", label: "10s" },
  { value: "30000", label: "30s" },
  { value: "60000", label: "1min" },
  { value: "300000", label: "5min" },
];

describe("US-003: Refresh interval dropdown in footer", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");

  function extractSelect(markup: string): string {
    const match = markup.match(/<select id="refresh-interval-select"[\s\S]*?<\/select>/);
    assert.ok(match, "Expected <select id=\"refresh-interval-select\"> in markup");
    return match[0];
  }

  function assertExpectedOptions(selectMarkup: string) {
    const optionMatches = [...selectMarkup.matchAll(/<option value="(\d+)"(?:\s+selected)?>([^<]+)<\/option>/g)];
    assert.equal(optionMatches.length, expectedOptions.length, "Refresh interval select should have exactly 5 options");

    const actualOptions = optionMatches.map(match => ({ value: match[1], label: match[2] }));
    assert.deepEqual(actualOptions, expectedOptions, "Refresh interval options should match exact values/labels and order");
  }

  it("contains <select id=\"refresh-interval-select\"> inside footer#status-bar", () => {
    const statusBarIdx = html.indexOf('<footer id="status-bar">');
    const footerCloseIdx = html.indexOf("</footer>", statusBarIdx);
    const selectIdx = html.indexOf('id="refresh-interval-select"');
    assert.ok(statusBarIdx !== -1, "footer#status-bar should exist");
    assert.ok(selectIdx !== -1, "refresh interval select should exist");
    assert.ok(selectIdx > statusBarIdx && selectIdx < footerCloseIdx, "refresh interval select should be inside footer#status-bar");
  });

  it("is adjacent to #refresh-note in footer", () => {
    assert.match(
      html,
      /<span class="refresh-note" id="refresh-note">[\s\S]*?<\/span>\s*<select id="refresh-interval-select"/,
      "refresh interval select should be adjacent to #refresh-note"
    );
  });

  it("has exact options: Off, 10s, 30s, 1min, 5min", () => {
    const selectMarkup = extractSelect(html);
    assertExpectedOptions(selectMarkup);
  });

  it("marks 30s (30000) as the default option in markup", () => {
    const selectMarkup = extractSelect(html);
    assert.match(
      selectMarkup,
      /<option value="30000"\s+selected>30s<\/option>/,
      "Expected the 30s option to be selected by default"
    );
  });

  it("initializes selected value from getAutorefreshMs() with fallback to 30000", () => {
    assert.ok(html.includes("const autorefreshMs = getAutorefreshMs();"), "Should read stored autorefresh value via getAutorefreshMs()");
    assert.ok(
      html.includes("refreshIntervalSelect.value = hasMatchingOption ? selectedValue : String(GLOBAL_REFRESH_MS);"),
      "Should set select value to matching option or fallback to GLOBAL_REFRESH_MS (30000)"
    );
  });

  it("dist: select exists with exact options", () => {
    const selectMarkup = extractSelect(distHtml);
    assertExpectedOptions(selectMarkup);
  });
});
