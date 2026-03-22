/**
 * US-003: Tests for horizontal projects bar CSS classes in index.html.
 * Verifies that the new badge-bar CSS classes are present and the
 * existing project-card class is still present for backward compat.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";

let server: http.Server;
const PORT = 14320;

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
  db.prepare("DELETE FROM projects WHERE name LIKE 'css-test-%'").run();
  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE name LIKE 'css-test-%'").run();
});

describe("US-003: Horizontal projects bar CSS", () => {
  it("index.html contains .projects-bar CSS class definition", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".projects-bar"), "Should contain .projects-bar CSS class");
  });

  it("index.html contains .projects-bar-inner CSS class definition", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".projects-bar-inner"), "Should contain .projects-bar-inner CSS class");
  });

  it("index.html contains .project-badge CSS class definition", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".project-badge"), "Should contain .project-badge CSS class");
  });

  it("index.html contains .project-badge.selected CSS rule", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".project-badge.selected"), "Should contain .project-badge.selected CSS rule");
  });

  it("index.html contains .project-badge-actions CSS class", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".project-badge-actions"), "Should contain .project-badge-actions CSS class");
  });

  it("index.html contains .project-badge-edit-btn CSS class", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".project-badge-edit-btn"), "Should contain .project-badge-edit-btn CSS class");
  });

  it("index.html contains .project-badge-delete-btn CSS class", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".project-badge-delete-btn"), "Should contain .project-badge-delete-btn CSS class");
  });

  it("index.html contains .project-badge-new-btn CSS rule", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".project-badge-new-btn"), "Should contain .project-badge-new-btn CSS rule");
  });

  it("index.html still contains .project-card CSS class (backward compat)", async () => {
    const html = await getHtml();
    assert.ok(html.includes(".project-card"), "Should still contain .project-card CSS class for backward compat");
  });
});
