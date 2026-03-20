/**
 * US-004: Tests for Projects REST API endpoints in the dashboard server.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";

let server: http.Server;
const PORT = 14097;
const BASE = `http://localhost:${PORT}`;

async function req(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; data: unknown }> {
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
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: null });
        }
      });
    });
    r.on("error", reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

before(async () => {
  // Clean projects table before tests
  const db = getDb();
  db.prepare("DELETE FROM projects").run();

  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Cleanup
  const db = getDb();
  db.prepare("DELETE FROM projects").run();
});

describe("US-004: Projects REST API", () => {
  let createdId: string;

  it("GET /api/projects returns 200 with empty array initially", async () => {
    const { status, data } = await req("GET", "/api/projects");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "Should return JSON array");
    assert.equal((data as unknown[]).length, 0);
  });

  it("POST /api/projects with { name } returns 201 with id field", async () => {
    const { status, data } = await req("POST", "/api/projects", { name: "TestProject" });
    assert.equal(status, 201);
    const project = data as Record<string, unknown>;
    assert.ok(project.id, "Response should have id field");
    assert.equal(project.name, "TestProject");
    createdId = project.id as string;
  });

  it("POST /api/projects with optional fields returns 201", async () => {
    const { status, data } = await req("POST", "/api/projects", {
      name: "ProjectWithExtras",
      gitRepoPath: "/home/user/repos/myproject",
      githubRepoUrl: "https://github.com/user/myproject",
    });
    assert.equal(status, 201);
    const project = data as Record<string, unknown>;
    assert.ok(project.id, "Response should have id field");
    assert.equal(project.name, "ProjectWithExtras");
  });

  it("POST /api/projects without name returns 400", async () => {
    const { status } = await req("POST", "/api/projects", { gitRepoPath: "/some/path" });
    assert.equal(status, 400);
  });

  it("GET /api/projects returns 200 with array containing added projects", async () => {
    const { status, data } = await req("GET", "/api/projects");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    const list = data as Array<Record<string, unknown>>;
    assert.ok(list.length >= 2, "Should have at least 2 projects");
    const found = list.find((p) => p.id === createdId);
    assert.ok(found, "Created project should appear in list");
  });

  it("GET /api/projects/:id returns 200 with project", async () => {
    const { status, data } = await req("GET", `/api/projects/${createdId}`);
    assert.equal(status, 200);
    const project = data as Record<string, unknown>;
    assert.equal(project.id, createdId);
    assert.equal(project.name, "TestProject");
  });

  it("GET /api/projects/:id returns 404 for unknown id", async () => {
    const { status } = await req("GET", "/api/projects/nonexistent-id-12345");
    assert.equal(status, 404);
  });

  it("PATCH /api/projects/:id updates and returns updated project", async () => {
    const { status, data } = await req("PATCH", `/api/projects/${createdId}`, {
      name: "UpdatedProject",
      git_repo_path: "/home/user/updated-repo",
    });
    assert.equal(status, 200);
    const project = data as Record<string, unknown>;
    assert.equal(project.id, createdId);
    assert.equal(project.name, "UpdatedProject");
  });

  it("PATCH /api/projects/:id returns 404 for unknown id", async () => {
    const { status } = await req("PATCH", "/api/projects/nonexistent-id-12345", { name: "X" });
    assert.equal(status, 404);
  });

  it("DELETE /api/projects/:id returns { ok: true }", async () => {
    const { status, data } = await req("DELETE", `/api/projects/${createdId}`);
    assert.equal(status, 200);
    assert.deepEqual(data, { ok: true });
  });

  it("DELETE /api/projects/:id returns 404 for unknown id", async () => {
    const { status } = await req("DELETE", "/api/projects/nonexistent-id-12345");
    assert.equal(status, 404);
  });

  it("GET /api/projects/:id returns 404 after deletion", async () => {
    const { status } = await req("GET", `/api/projects/${createdId}`);
    assert.equal(status, 404);
  });
});
