/**
 * US-004: Tests for Projects UI panel in the dashboard.
 * Verifies HTML contains projects panel markup and API calls work end-to-end.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";

let server: http.Server;
const PORT = 14099;

async function req(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; data: unknown; text: string }> {
  return new Promise((resolve, reject) => {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: "localhost",
      port: PORT,
      path: urlPath,
      method,
      headers: bodyStr
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(bodyStr),
          }
        : {},
    };
    const r = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(text), text });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: null, text });
        }
      });
    });
    r.on("error", reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

before(async () => {
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE name LIKE 'ui-test-%'").run();
  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE name LIKE 'ui-test-%'").run();
});

describe("US-004: Projects UI panel", () => {
  it("GET / returns 200 HTML page", async () => {
    const { status, text } = await req("GET", "/");
    assert.equal(status, 200);
    assert.ok(text.includes("<!DOCTYPE html>"), "Should return HTML");
  });

  it("GET / HTML contains projects panel markup (id and heading)", async () => {
    const { text } = await req("GET", "/");
    assert.ok(text.includes("projects-column"), "HTML should reference projects-column id");
    assert.ok(text.includes("Projects"), "HTML should contain 'Projects' heading text");
  });

  it("GET / HTML references project card CSS class", async () => {
    const { text } = await req("GET", "/");
    assert.ok(text.includes("project-card"), "HTML should reference project-card CSS class");
  });

  it("GET / HTML contains loadProjects function and /api/projects endpoint", async () => {
    const { text } = await req("GET", "/");
    assert.ok(text.includes("loadProjects"), "HTML should contain loadProjects function");
    assert.ok(text.includes("/api/projects"), "HTML should reference /api/projects endpoint");
  });

  it("GET / HTML contains Add Project button text", async () => {
    const { text } = await req("GET", "/");
    assert.ok(text.includes("Add Project"), "HTML should contain 'Add Project' button text");
  });

  it("GET / HTML contains deleteProject function", async () => {
    const { text } = await req("GET", "/");
    assert.ok(text.includes("deleteProject"), "HTML should contain deleteProject function");
  });

  let createdId: string;

  it("POST /api/projects creates project and GET /api/projects returns it", async () => {
    const { status, data } = await req("POST", "/api/projects", {
      name: "ui-test-myproject",
      gitRepoPath: "/tmp/myproject",
      githubRepoUrl: "https://github.com/example/myproject",
    });
    assert.equal(status, 201);
    const project = data as Record<string, unknown>;
    assert.ok(project.id, "Should have id");
    assert.equal(project.name, "ui-test-myproject");
    createdId = project.id as string;

    const { status: listStatus, data: listData } = await req("GET", "/api/projects");
    assert.equal(listStatus, 200);
    assert.ok(Array.isArray(listData));
    const list = listData as Array<Record<string, unknown>>;
    const found = list.find((p) => p.id === createdId);
    assert.ok(found, "Created project should appear in list");
    assert.equal(found.name, "ui-test-myproject");
    assert.equal(found.git_repo_path, "/tmp/myproject");
    assert.equal(found.github_repo_url, "https://github.com/example/myproject");
  });

  it("DELETE /api/projects/:id removes the project from the list", async () => {
    const { status, data } = await req("DELETE", `/api/projects/${createdId}`);
    assert.equal(status, 200);
    assert.deepEqual(data, { ok: true });

    const { data: listData } = await req("GET", "/api/projects");
    assert.ok(Array.isArray(listData));
    const found = (listData as Array<Record<string, unknown>>).find(
      (p) => p.id === createdId
    );
    assert.ok(!found, "Deleted project should not appear in list");
  });
});
