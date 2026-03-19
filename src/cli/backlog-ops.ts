import { getDb } from "../db.js";
import { randomUUID } from "node:crypto";

export interface BacklogItem {
  id: string;
  title: string;
  description: string | null;
  workflow_id: string | null;
  priority: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export function addBacklogItem(options: {
  title: string;
  workflow?: string;
  description?: string;
}): { id: string; priority: number } {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  // Calculate next priority
  const maxPriorityRow = db
    .prepare("SELECT MAX(priority) as max_priority FROM backlog_items")
    .get() as { max_priority: number | null };
  const nextPriority = (maxPriorityRow.max_priority ?? 0) + 1;

  // Insert the item
  db.prepare(
    `INSERT INTO backlog_items (id, title, description, workflow_id, priority, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    id,
    options.title,
    options.description ?? null,
    options.workflow ?? null,
    nextPriority,
    now,
    now
  );

  return { id, priority: nextPriority };
}

export function listBacklogItems(): BacklogItem[] {
  const db = getDb();
  const items = db
    .prepare("SELECT * FROM backlog_items ORDER BY priority ASC")
    .all() as unknown as BacklogItem[];
  return items;
}
