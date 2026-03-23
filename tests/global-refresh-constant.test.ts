import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");
const distHtmlPath = path.join(__dirname, "../dist/server/index.html");

describe("US-002: configurable autorefresh interval wiring", () => {
  const html = fs.readFileSync(htmlPath, "utf8");

  it("keeps const GLOBAL_REFRESH_MS = 30000 in the script block as fallback", () => {
    assert.ok(
      html.includes("const GLOBAL_REFRESH_MS = 30000;"),
      "Expected 'const GLOBAL_REFRESH_MS = 30000;' in src/server/index.html script block"
    );
  });

  it("main board refresh interval is configurable via restartMainRefreshInterval(ms)", () => {
    assert.ok(
      html.includes("function restartMainRefreshInterval(ms) {"),
      "Expected restartMainRefreshInterval(ms) helper"
    );
    assert.ok(
      html.includes("mainRefreshInterval = setInterval(() => {"),
      "Expected board polling setInterval assigned to mainRefreshInterval"
    );
    assert.ok(
      html.includes("}, ms);") || html.includes("}, ms);"),
      "Expected main setInterval to use the passed ms value"
    );
    assert.ok(
      html.includes("applyAutorefreshSetting(getAutorefreshMs());"),
      "Expected page load to apply stored refresh setting"
    );
  });

  it("countdown formula uses Math.floor(getAutorefreshMs() / 1000)", () => {
    assert.ok(
      html.includes("Math.floor(getAutorefreshMs() / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000)"),
      "Expected countdown formula to use getAutorefreshMs()"
    );
  });

  it("refresh-note text is updated dynamically via updateRefreshNote(ms)", () => {
    assert.ok(
      html.includes("function updateRefreshNote(ms) {"),
      "Expected updateRefreshNote(ms) helper"
    );
    assert.ok(
      html.includes("note.textContent = `Auto-refresh: ${Math.floor(ms / 1000)}s`;"),
      "Expected non-off refresh-note text to be computed from ms"
    );
    assert.ok(
      html.includes("note.textContent = 'Auto-refresh: off';"),
      "Expected off state refresh-note text"
    );
  });

  it("no standalone 30000 magic number inside setInterval calls", () => {
    assert.ok(
      !html.includes(", 30000);"),
      "Expected no ', 30000);' in setInterval usage"
    );
  });

  it("GLOBAL_REFRESH_MS value is still 30000", () => {
    const match = html.match(/const GLOBAL_REFRESH_MS\s*=\s*(\d+)/);
    assert.ok(match, "GLOBAL_REFRESH_MS should be declared with a numeric value");
    assert.equal(parseInt(match[1], 10), 30000, "GLOBAL_REFRESH_MS should remain 30000 (30 seconds)");
  });
});

describe("US-002: configurable autorefresh interval wiring in dist build", () => {
  let distHtml: string;

  try {
    distHtml = fs.readFileSync(distHtmlPath, "utf8");
  } catch {
    distHtml = "";
  }

  it("dist: GLOBAL_REFRESH_MS constant is present", () => {
    assert.ok(
      distHtml.includes("const GLOBAL_REFRESH_MS = 30000;"),
      "Expected GLOBAL_REFRESH_MS in dist/server/index.html"
    );
  });

  it("dist: main refresh helper and apply call exist", () => {
    assert.ok(distHtml.includes("function restartMainRefreshInterval(ms) {"));
    assert.ok(distHtml.includes("applyAutorefreshSetting(getAutorefreshMs());"));
  });

  it("dist: countdown formula uses getAutorefreshMs()", () => {
    assert.ok(
      distHtml.includes("Math.floor(getAutorefreshMs() / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000)"),
      "Expected countdown formula using getAutorefreshMs() in dist"
    );
  });
});
