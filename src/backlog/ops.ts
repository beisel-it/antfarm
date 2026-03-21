import { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getDb, BacklogEntry } from "../db.js";

export function addBacklogEntry(fields: {
  title: string;
  description?: string;
  priority?: number;
  projectId?: string;
  workflowId?: string;
  notes?: string;
  tags?: string;
  acceptanceCriteria?: string;
}): BacklogEntry {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const priority = fields.priority ?? 0;
  const description = fields.description ?? null;
  const projectId = fields.projectId ?? null;
  const workflowId = fields.workflowId ?? null;
  const notes = fields.notes ?? null;
  const tags = fields.tags ?? null;
  const acceptanceCriteria = fields.acceptanceCriteria ?? null;

  db.prepare(
    "INSERT INTO backlog (id, title, description, status, priority, project_id, workflow_id, notes, tags, acceptance_criteria, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, fields.title, description, priority, projectId, workflowId, notes, tags, acceptanceCriteria, now, now);

  return getBacklogEntry(id)!;
}

export function updateBacklogEntry(
  id: string,
  updates: Partial<Pick<BacklogEntry, "title" | "description" | "status" | "priority" | "run_id" | "project_id" | "workflow_id" | "notes" | "tags" | "acceptance_criteria">>
): BacklogEntry | null {
  const db = getDb();
  const existing = getBacklogEntry(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const setClauses: string[] = [];
  const values: SQLInputValue[] = [];

  if (updates.title !== undefined) {
    setClauses.push("title = ?");
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push("description = ?");
    values.push(updates.description);
  }
  if (updates.workflow_id !== undefined) {
    setClauses.push("workflow_id = ?");
    values.push(updates.workflow_id);
  }
  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    values.push(updates.status);
  }
  if (updates.priority !== undefined) {
    setClauses.push("priority = ?");
    values.push(updates.priority);
  }
  if (updates.run_id !== undefined) {
    setClauses.push("run_id = ?");
    values.push(updates.run_id);
  }
  if (updates.project_id !== undefined) {
    setClauses.push("project_id = ?");
    values.push(updates.project_id);
  }
  if (updates.notes !== undefined) {
    setClauses.push("notes = ?");
    values.push(updates.notes);
  }
  if (updates.tags !== undefined) {
    setClauses.push("tags = ?");
    values.push(updates.tags);
  }
  if (updates.acceptance_criteria !== undefined) {
    setClauses.push("acceptance_criteria = ?");
    values.push(updates.acceptance_criteria);
  }

  if (setClauses.length === 0) return existing;

  setClauses.push("updated_at = ?");
  values.push(now);
  values.push(id);

  db.prepare(`UPDATE backlog SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);

  return getBacklogEntry(id);
}

export function deleteBacklogEntry(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM backlog WHERE id = ?").run(id);
  return (result as { changes: number }).changes > 0;
}

export function listBacklogEntries(filters?: { workflow_id?: string; project_id?: string }): BacklogEntry[] {
  const db = getDb();
  const SELECT = "SELECT id, title, description, status, priority, run_id, project_id, workflow_id, notes, tags, acceptance_criteria, created_at, updated_at FROM backlog";
  const ORDER = "ORDER BY priority DESC, created_at ASC";

  if (filters?.workflow_id && filters?.project_id) {
    return db
      .prepare(`${SELECT} WHERE workflow_id = ? AND project_id = ? ${ORDER}`)
      .all(filters.workflow_id, filters.project_id) as unknown as BacklogEntry[];
  }
  if (filters?.workflow_id) {
    return db
      .prepare(`${SELECT} WHERE workflow_id = ? ${ORDER}`)
      .all(filters.workflow_id) as unknown as BacklogEntry[];
  }
  if (filters?.project_id) {
    return db
      .prepare(`${SELECT} WHERE project_id = ? ${ORDER}`)
      .all(filters.project_id) as unknown as BacklogEntry[];
  }

  return db
    .prepare(`${SELECT} ${ORDER}`)
    .all() as unknown as BacklogEntry[];
}

export function getBacklogEntry(id: string): BacklogEntry | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, title, description, status, priority, run_id, project_id, workflow_id, notes, tags, acceptance_criteria, created_at, updated_at FROM backlog WHERE id = ?"
    )
    .get(id) as unknown as BacklogEntry | undefined;
  return row ?? null;
}

export function listBacklogEntriesForProject(projectId: string): BacklogEntry[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, title, description, status, priority, run_id, project_id, workflow_id, notes, tags, acceptance_criteria, created_at, updated_at FROM backlog WHERE project_id = ? ORDER BY priority DESC, created_at ASC"
    )
    .all(projectId) as unknown as BacklogEntry[];
}
