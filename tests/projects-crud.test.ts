import { test, before } from "node:test";
import assert from "node:assert/strict";
import { addProject, getProject, listProjects, updateProject, deleteProject } from "../dist/projects/index.js";
import { getDb } from "../dist/db.js";

before(() => {
  // Clean up projects table before tests
  const db = getDb();
  db.prepare("DELETE FROM projects").run();
});

test("addProject returns correct shape with all fields", () => {
  const project = addProject({
    name: "My Project",
    gitRepoPath: "/home/user/repos/my-project",
    githubRepoUrl: "https://github.com/user/my-project",
  });

  assert.ok(project.id, "should have an id");
  assert.equal(project.name, "My Project");
  assert.equal(project.git_repo_path, "/home/user/repos/my-project");
  assert.equal(project.github_repo_url, "https://github.com/user/my-project");
  assert.ok(project.created_at, "should have created_at");
  assert.ok(project.updated_at, "should have updated_at");
  // Verify ISO timestamp format
  assert.ok(!isNaN(Date.parse(project.created_at)), "created_at should be valid ISO date");
  assert.ok(!isNaN(Date.parse(project.updated_at)), "updated_at should be valid ISO date");
});

test("addProject works with only name (optional fields)", () => {
  const project = addProject({ name: "Minimal Project" });

  assert.ok(project.id, "should have an id");
  assert.equal(project.name, "Minimal Project");
  assert.equal(project.git_repo_path, null);
  assert.equal(project.github_repo_url, null);
});

test("addProject generates unique UUIDs", () => {
  const p1 = addProject({ name: "Project A" });
  const p2 = addProject({ name: "Project B" });

  assert.notEqual(p1.id, p2.id);
});

test("listProjects returns all projects", () => {
  // Clean before this test to get a predictable count
  const db = getDb();
  db.prepare("DELETE FROM projects").run();

  addProject({ name: "Alpha" });
  addProject({ name: "Beta" });
  addProject({ name: "Gamma" });

  const projects = listProjects();
  assert.equal(projects.length, 3);
});

test("getProject returns project by id", () => {
  const created = addProject({ name: "Findable", gitRepoPath: "/tmp/findable" });
  const found = getProject(created.id);

  assert.ok(found, "should find the project");
  assert.equal(found!.id, created.id);
  assert.equal(found!.name, "Findable");
  assert.equal(found!.git_repo_path, "/tmp/findable");
});

test("getProject returns null for missing id", () => {
  const result = getProject("non-existent-id-12345");
  assert.equal(result, null);
});

test("updateProject updates only changed fields", async () => {
  const project = addProject({
    name: "Original",
    gitRepoPath: "/original/path",
    githubRepoUrl: "https://github.com/original",
  });

  // Small delay to ensure updated_at differs
  await new Promise((resolve) => setTimeout(resolve, 5));

  const updated = updateProject(project.id, { name: "Updated Name" });

  assert.ok(updated, "should return updated project");
  assert.equal(updated!.name, "Updated Name");
  assert.equal(updated!.git_repo_path, "/original/path", "git_repo_path should be unchanged");
  assert.equal(updated!.github_repo_url, "https://github.com/original", "github_repo_url should be unchanged");
  assert.equal(updated!.created_at, project.created_at, "created_at should not change");
  assert.notEqual(updated!.updated_at, project.updated_at, "updated_at should change");
});

test("updateProject returns null for missing id", () => {
  const result = updateProject("non-existent-id-99999", { name: "Ghost" });
  assert.equal(result, null);
});

test("deleteProject removes the row", () => {
  const project = addProject({ name: "To Delete" });

  const deleted = deleteProject(project.id);
  assert.equal(deleted, true);

  const found = getProject(project.id);
  assert.equal(found, null);
});

test("deleteProject returns false when id does not exist", () => {
  const result = deleteProject("non-existent-id-delete");
  assert.equal(result, false);
});
