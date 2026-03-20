import { SQLInputValue } from "node:sqlite";
import { getDb, ProjectEntry } from "../db.js";

export function addProject(fields: {
  name: string;
  gitRepoPath?: string;
  githubRepoUrl?: string;
}): ProjectEntry {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const gitRepoPath = fields.gitRepoPath ?? null;
  const githubRepoUrl = fields.githubRepoUrl ?? null;

  db.prepare(
    "INSERT INTO projects (id, name, git_repo_path, github_repo_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, fields.name, gitRepoPath, githubRepoUrl, now, now);

  return getProject(id)!;
}

export function getProject(id: string): ProjectEntry | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, name, git_repo_path, github_repo_url, created_at, updated_at FROM projects WHERE id = ?"
    )
    .get(id) as unknown as ProjectEntry | undefined;
  return row ?? null;
}

export function listProjects(): ProjectEntry[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, name, git_repo_path, github_repo_url, created_at, updated_at FROM projects ORDER BY created_at ASC"
    )
    .all() as unknown as ProjectEntry[];
}

export function updateProject(
  id: string,
  updates: Partial<Pick<ProjectEntry, "name" | "git_repo_path" | "github_repo_url">>
): ProjectEntry | null {
  const db = getDb();
  const existing = getProject(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: SQLInputValue[] = [];

  if (updates.name !== undefined) {
    setClauses.push("name = ?");
    values.push(updates.name);
  }
  if (updates.git_repo_path !== undefined) {
    setClauses.push("git_repo_path = ?");
    values.push(updates.git_repo_path);
  }
  if (updates.github_repo_url !== undefined) {
    setClauses.push("github_repo_url = ?");
    values.push(updates.github_repo_url);
  }

  if (setClauses.length === 0) return existing;

  setClauses.push("updated_at = ?");
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

  return getProject(id);
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return (result as { changes: number }).changes > 0;
}
