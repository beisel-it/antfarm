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

  it("board refresh setInterval uses getAutorefreshMs()", () => {
    assert.ok(
      html.includes("}, getAutorefreshMs());"),
      "Expected board refresh setInterval to use getAutorefreshMs()"
    );
    assert.ok(
      !html.includes("}, GLOBAL_REFRESH_MS);"),
      "Board refresh setInterval should no longer use GLOBAL_REFRESH_MS"
    );
  });

  it("countdown formula uses Math.floor(getAutorefreshMs() / 1000)", () => {
    assert.ok(
      html.includes("Math.floor(getAutorefreshMs() / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000)"),
      "Expected countdown formula to use getAutorefreshMs()"
    );
  });

  it("refresh-note text is set dynamically using getAutorefreshMs()", () => {
    assert.ok(
      html.includes("`Auto-refresh: ${Math.floor(getAutorefreshMs() / 1000)}s`"),
      "Expected refresh-note text to be set via template literal using getAutorefreshMs()"
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

  it("dist: board setInterval uses getAutorefreshMs()", () => {
    assert.ok(
      distHtml.includes("}, getAutorefreshMs());"),
      "Expected getAutorefreshMs() in board setInterval in dist"
    );
  });

  it("dist: countdown formula uses getAutorefreshMs()", () => {
    assert.ok(
      distHtml.includes("Math.floor(getAutorefreshMs() / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000)"),
      "Expected countdown formula using getAutorefreshMs() in dist"
    );
  });
});
