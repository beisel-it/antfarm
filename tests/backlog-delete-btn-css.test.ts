import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, "../src/server/index.html");
const distHtmlPath = path.join(__dirname, "../dist/server/index.html");

describe("US-011: backlog-delete-btn CSS", () => {
  const html = fs.readFileSync(htmlPath, "utf8");
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");

  it("src/server/index.html contains .backlog-delete-btn rule", () => {
    assert.ok(
      html.includes(".backlog-delete-btn{"),
      "Expected .backlog-delete-btn{ CSS rule in src/server/index.html"
    );
  });

  it(".backlog-delete-btn:hover sets color:var(--accent-orange)", () => {
    assert.ok(
      html.includes(".backlog-delete-btn:hover"),
      "Expected .backlog-delete-btn:hover rule"
    );
    // Find the hover rule and check it contains the right color
    const hoverIdx = html.indexOf(".backlog-delete-btn:hover");
    const hoverRule = html.slice(hoverIdx, hoverIdx + 200);
    assert.ok(
      hoverRule.includes("color:var(--accent-orange)"),
      "Expected color:var(--accent-orange) in hover rule"
    );
  });

  it(".backlog-delete-btn:hover sets background:var(--accent-orange-subtle)", () => {
    const hoverIdx = html.indexOf(".backlog-delete-btn:hover");
    const hoverRule = html.slice(hoverIdx, hoverIdx + 200);
    assert.ok(
      hoverRule.includes("background:var(--accent-orange-subtle)"),
      "Expected background:var(--accent-orange-subtle) in hover rule"
    );
  });

  it("no hardcoded colours in .backlog-delete-btn rules (no hex colours)", () => {
    const btnIdx = html.indexOf(".backlog-delete-btn{");
    const btnSection = html.slice(btnIdx, btnIdx + 300);
    // Check no hex colours like #fff or #123456
    assert.ok(
      !/[^-]#[0-9a-fA-F]{3,6}/.test(btnSection),
      "Expected no hardcoded hex colours in .backlog-delete-btn rules"
    );
  });

  it("dist/server/index.html also contains .backlog-delete-btn (build copied correctly)", () => {
    assert.ok(
      distHtml.includes(".backlog-delete-btn{"),
      "Expected .backlog-delete-btn in dist/server/index.html after build"
    );
  });
});
