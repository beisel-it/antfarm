/**
 * Tests for US-001: projects table migration and ProjectEntry type.
 * Runs against the built dist/ (node:sqlite via getDb).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

const distDb = path.resolve(import.meta.dirname, "..", "dist", "db.js");

const { getDb } = await import(distDb) as {
  getDb: () => import("node:sqlite").DatabaseSync;
};

describe("US-001: projects table migration", () => {
  it("creates projects table after getDb()", () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
      .all() as Array<{ name: string }>;
    assert.equal(tables.length, 1, "projects table should exist");
    assert.equal(tables[0].name, "projects");
  });

  it("has correct columns with correct types", () => {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(projects)").all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;
    const colMap = new Map(columns.map((c) => [c.name, c]));

    // id: TEXT PRIMARY KEY
    assert.ok(colMap.has("id"), "id column exists");
    assert.equal(colMap.get("id")!.type, "TEXT");
    assert.equal(colMap.get("id")!.pk, 1, "id should be primary key");

    // name: TEXT NOT NULL
    assert.ok(colMap.has("name"), "name column exists");
    assert.equal(colMap.get("name")!.type, "TEXT");
    assert.equal(colMap.get("name")!.notnull, 1, "name should be NOT NULL");

    // git_repo_path: TEXT nullable
    assert.ok(colMap.has("git_repo_path"), "git_repo_path column exists");
    assert.equal(colMap.get("git_repo_path")!.type, "TEXT");
    assert.equal(colMap.get("git_repo_path")!.notnull, 0, "git_repo_path should be nullable");

    // github_repo_url: TEXT nullable
    assert.ok(colMap.has("github_repo_url"), "github_repo_url column exists");
    assert.equal(colMap.get("github_repo_url")!.type, "TEXT");
    assert.equal(colMap.get("github_repo_url")!.notnull, 0, "github_repo_url should be nullable");

    // created_at: TEXT NOT NULL
    assert.ok(colMap.has("created_at"), "created_at column exists");
    assert.equal(colMap.get("created_at")!.type, "TEXT");
    assert.equal(colMap.get("created_at")!.notnull, 1, "created_at should be NOT NULL");

    // updated_at: TEXT NOT NULL
    assert.ok(colMap.has("updated_at"), "updated_at column exists");
    assert.equal(colMap.get("updated_at")!.type, "TEXT");
    assert.equal(colMap.get("updated_at")!.notnull, 1, "updated_at should be NOT NULL");
  });

  it("migration is idempotent (calling getDb() twice does not throw)", () => {
    assert.doesNotThrow(() => {
      getDb();
      getDb();
    });
  });

  it("can insert and retrieve a project row", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `test-proj-${Date.now()}`;
    db.prepare(
      "INSERT INTO projects (id, name, git_repo_path, github_repo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, "Test Project", "/home/user/repo", "https://github.com/test/repo", now, now);

    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
    assert.equal(row.id, id);
    assert.equal(row.name, "Test Project");
    assert.equal(row.git_repo_path, "/home/user/repo");
    assert.equal(row.github_repo_url, "https://github.com/test/repo");

    // Cleanup
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  });

  it("allows null values for optional fields", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `test-proj-null-${Date.now()}`;
    db.prepare(
      "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).run(id, "Minimal Project", now, now);

    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
    assert.equal(row.name, "Minimal Project");
    assert.equal(row.git_repo_path, null);
    assert.equal(row.github_repo_url, null);

    // Cleanup
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  });

  it("enforces NOT NULL on name column", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const id = `test-proj-noname-${Date.now()}`;
    assert.throws(() => {
      db.prepare(
        "INSERT INTO projects (id, created_at, updated_at) VALUES (?, ?, ?)"
      ).run(id, now, now);
    }, "should throw when name is missing");
  });
});
