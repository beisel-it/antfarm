import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");
const distHtmlPath = path.join(__dirname, "../dist/server/index.html");

describe("US-001: GLOBAL_REFRESH_MS constant", () => {
  const html = fs.readFileSync(htmlPath, "utf8");

  it("declares const GLOBAL_REFRESH_MS = 30000 in the script block", () => {
    assert.ok(
      html.includes("const GLOBAL_REFRESH_MS = 30000;"),
      "Expected 'const GLOBAL_REFRESH_MS = 30000;' in src/server/index.html script block"
    );
  });

  it("GLOBAL_REFRESH_MS is declared near the top of the script block (before other setIntervals)", () => {
    const scriptIdx = html.indexOf("<script>");
    const globalRefreshIdx = html.indexOf("const GLOBAL_REFRESH_MS = 30000;");
    const firstSetIntervalIdx = html.indexOf("setInterval(");
    assert.ok(scriptIdx !== -1, "<script> block should exist");
    assert.ok(globalRefreshIdx !== -1, "GLOBAL_REFRESH_MS should be declared");
    assert.ok(
      globalRefreshIdx > scriptIdx,
      "GLOBAL_REFRESH_MS should be declared inside the <script> block"
    );
    assert.ok(
      globalRefreshIdx < firstSetIntervalIdx,
      "GLOBAL_REFRESH_MS should be declared before first setInterval usage"
    );
  });

  it("global board setInterval uses GLOBAL_REFRESH_MS instead of 30000", () => {
    // The board refresh setInterval should reference GLOBAL_REFRESH_MS
    assert.ok(
      html.includes("}, GLOBAL_REFRESH_MS);"),
      "Expected '}, GLOBAL_REFRESH_MS);' for the board refresh setInterval"
    );
  });

  it("countdown formula uses Math.floor(GLOBAL_REFRESH_MS / 1000) instead of literal 30", () => {
    assert.ok(
      html.includes("Math.floor(GLOBAL_REFRESH_MS / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000)"),
      "Expected countdown formula to use 'Math.floor(GLOBAL_REFRESH_MS / 1000)' instead of literal 30"
    );
  });

  it("refresh-note text is set dynamically using GLOBAL_REFRESH_MS", () => {
    assert.ok(
      html.includes("`Auto-refresh: ${Math.floor(GLOBAL_REFRESH_MS / 1000)}s`"),
      "Expected refresh-note text to be set via template literal using GLOBAL_REFRESH_MS"
    );
  });

  it("no standalone 30000 magic number in board refresh setInterval", () => {
    // Find the board setInterval that calls loadRuns/loadBacklog
    const loadRunsIntervalIdx = html.indexOf("if (currentWf) loadRuns()");
    assert.ok(loadRunsIntervalIdx !== -1, "Board refresh setInterval body should exist");
    // Look in a window around this code (500 chars before and after)
    const window = html.slice(Math.max(0, loadRunsIntervalIdx - 50), loadRunsIntervalIdx + 200);
    assert.ok(
      !window.includes("}, 30000)"),
      "Expected no '}, 30000)' in board refresh setInterval — should use GLOBAL_REFRESH_MS"
    );
  });

  it("GLOBAL_REFRESH_MS value is 30000 (ensures 30s refresh)", () => {
    // Verify the constant value directly using a regex
    const match = html.match(/const GLOBAL_REFRESH_MS\s*=\s*(\d+)/);
    assert.ok(match, "GLOBAL_REFRESH_MS should be declared with a numeric value");
    assert.equal(
      parseInt(match[1], 10),
      30000,
      "GLOBAL_REFRESH_MS should be 30000 (30 seconds)"
    );
  });
});

describe("US-001: GLOBAL_REFRESH_MS in dist build", () => {
  let distHtml: string;

  try {
    distHtml = fs.readFileSync(distHtmlPath, "utf8");
  } catch {
    // dist may not exist yet — tests will fail gracefully
    distHtml = "";
  }

  it("dist: GLOBAL_REFRESH_MS constant is present", () => {
    assert.ok(
      distHtml.includes("const GLOBAL_REFRESH_MS = 30000;"),
      "Expected GLOBAL_REFRESH_MS in dist/server/index.html"
    );
  });

  it("dist: board setInterval uses GLOBAL_REFRESH_MS", () => {
    assert.ok(
      distHtml.includes("}, GLOBAL_REFRESH_MS);"),
      "Expected GLOBAL_REFRESH_MS in board setInterval in dist"
    );
  });

  it("dist: countdown formula uses GLOBAL_REFRESH_MS", () => {
    assert.ok(
      distHtml.includes("Math.floor(GLOBAL_REFRESH_MS / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000)"),
      "Expected countdown formula using GLOBAL_REFRESH_MS in dist"
    );
  });
});
