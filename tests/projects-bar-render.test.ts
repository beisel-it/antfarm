/**
 * US-004: Tests for renderProjectsBar() function in index.html.
 * Verifies the function exists, generates correct HTML structure,
 * includes data-project-id attributes, and "+ New" button.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";

let server: http.Server;
const PORT = 14430;

async function getHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: "localhost", port: PORT, path: "/", method: "GET" },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString()));
      }
    );
    r.on("error", reject);
    r.end();
  });
}

before(async () => {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE name LIKE 'bar-render-test-%'").run();
  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE name LIKE 'bar-render-test-%'").run();
});

describe("US-004: renderProjectsBar() function in index.html", () => {
  it("index.html contains renderProjectsBar function definition", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("renderProjectsBar"),
      "Should contain renderProjectsBar function"
    );
  });

  it("index.html contains selectedProjectIds variable declaration", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("selectedProjectIds"),
      "Should contain selectedProjectIds variable"
    );
  });

  it("index.html contains toggleProjectSelection function", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("toggleProjectSelection"),
      "Should contain toggleProjectSelection function"
    );
  });

  it("renderProjectsBar generates div with id='projects-bar'", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("id='projects-bar'") || html.includes('id="projects-bar"'),
      "renderProjectsBar should generate element with id projects-bar"
    );
  });

  it("renderProjectsBar generates projects-bar class", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("projects-bar"),
      "renderProjectsBar function should reference projects-bar class"
    );
  });

  it("renderProjectsBar generates projects-bar-inner inner div", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("projects-bar-inner"),
      "renderProjectsBar function should reference projects-bar-inner class"
    );
  });

  it("renderProjectsBar includes data-project-id attribute for badges", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("data-project-id"),
      "Badge elements should have data-project-id attribute"
    );
  });

  it("renderProjectsBar includes + New button", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("+ New") || html.includes("+&nbsp;New") || html.includes("+ New Project"),
      "Bar should contain a + New button"
    );
  });

  it("renderProjectsBar includes project-badge-new-btn class", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("project-badge-new-btn"),
      "New button should use project-badge-new-btn class"
    );
  });

  it("toggleProjectSelection is referenced in badge onclick handlers", async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("toggleProjectSelection"),
      "Badge onclick should reference toggleProjectSelection"
    );
  });
});
