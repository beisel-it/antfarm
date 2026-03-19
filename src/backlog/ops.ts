import { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getDb, BacklogEntry } from "../db.js";

export function addBacklogEntry(fields: {
  title: string;
  description?: string;
  priority?: number;
}): BacklogEntry {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const priority = fields.priority ?? 0;
  const description = fields.description ?? null;

  db.prepare(
    "INSERT INTO backlog (id, title, description, status, priority, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)"
  ).run(id, fields.title, description, priority, now, now);

  return getBacklogEntry(id)!;
}

export function updateBacklogEntry(
  id: string,
  updates: Partial<Pick<BacklogEntry, "title" | "description" | "status" | "priority">>
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
  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    values.push(updates.status);
  }
  if (updates.priority !== undefined) {
    setClauses.push("priority = ?");
    values.push(updates.priority);
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

export function listBacklogEntries(): BacklogEntry[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT id, title, description, status, priority, created_at, updated_at FROM backlog ORDER BY priority DESC, created_at ASC"
    )
    .all() as unknown as BacklogEntry[];
}

export function getBacklogEntry(id: string): BacklogEntry | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, title, description, status, priority, created_at, updated_at FROM backlog WHERE id = ?"
    )
    .get(id) as unknown as BacklogEntry | undefined;
  return row ?? null;
}
