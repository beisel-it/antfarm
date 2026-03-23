import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DB_PATH = process.env.ANTFARM_DB_PATH
  ?? path.join(os.homedir(), ".openclaw", "antfarm", "antfarm.db");
const DB_DIR = path.dirname(DB_PATH);

let _db: DatabaseSync | null = null;
let _dbOpenedAt = 0;
const DB_MAX_AGE_MS = 5000;

export function getDb(): DatabaseSync {
  const now = Date.now();
  if (_db && (now - _dbOpenedAt) < DB_MAX_AGE_MS) return _db;
  if (_db) { try { _db.close(); } catch {} }

  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _dbOpenedAt = now;
  _db.exec("PRAGMA journal_mode=WAL");
  _db.exec("PRAGMA busy_timeout=5000");
  _db.exec("PRAGMA foreign_keys=ON");
  migrate(_db);
  return _db;
}

function dedupeStoriesForRunStoryUniqueIndex(db: DatabaseSync): void {
  db.exec(`
    DELETE FROM stories
    WHERE id IN (
      SELECT doomed.id
      FROM stories AS doomed
      JOIN stories AS keeper
        ON keeper.run_id = doomed.run_id
       AND keeper.story_id = doomed.story_id
       AND (
         CASE keeper.status
           WHEN 'running' THEN 4
           WHEN 'done' THEN 3
           WHEN 'pending' THEN 2
           WHEN 'failed' THEN 1
           ELSE 0
         END > CASE doomed.status
           WHEN 'running' THEN 4
           WHEN 'done' THEN 3
           WHEN 'pending' THEN 2
           WHEN 'failed' THEN 1
           ELSE 0
         END
         OR (
           CASE keeper.status
             WHEN 'running' THEN 4
             WHEN 'done' THEN 3
             WHEN 'pending' THEN 2
             WHEN 'failed' THEN 1
             ELSE 0
           END = CASE doomed.status
             WHEN 'running' THEN 4
             WHEN 'done' THEN 3
             WHEN 'pending' THEN 2
             WHEN 'failed' THEN 1
             ELSE 0
           END
           AND COALESCE(keeper.updated_at, keeper.created_at, '') > COALESCE(doomed.updated_at, doomed.created_at, '')
         )
         OR (
           CASE keeper.status
             WHEN 'running' THEN 4
             WHEN 'done' THEN 3
             WHEN 'pending' THEN 2
             WHEN 'failed' THEN 1
             ELSE 0
           END = CASE doomed.status
             WHEN 'running' THEN 4
             WHEN 'done' THEN 3
             WHEN 'pending' THEN 2
             WHEN 'failed' THEN 1
             ELSE 0
           END
           AND COALESCE(keeper.updated_at, keeper.created_at, '') = COALESCE(doomed.updated_at, doomed.created_at, '')
           AND keeper.id > doomed.id
         )
       )
    )
  `);
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      context TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      step_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      input_template TEXT NOT NULL,
      expects TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      claimed_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      story_index INTEGER NOT NULL,
      story_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      claimed_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backlog_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      workflow_id TEXT,
      priority INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backlog (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      workflow_id TEXT,
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      git_repo_path TEXT,
      github_repo_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Add run_id column to backlog table for backwards compat
  const backlogCols = db.prepare("PRAGMA table_info(backlog)").all() as Array<{ name: string }>;
  const backlogColNames = new Set(backlogCols.map((c) => c.name));
  if (!backlogColNames.has("workflow_id")) {
    db.exec("ALTER TABLE backlog ADD COLUMN workflow_id TEXT");
  }
  if (!backlogColNames.has("run_id")) {
    db.exec("ALTER TABLE backlog ADD COLUMN run_id TEXT");
  }
  if (!backlogColNames.has("project_id")) {
    db.exec("ALTER TABLE backlog ADD COLUMN project_id TEXT");
  }
  if (!backlogColNames.has("notes")) {
    db.exec("ALTER TABLE backlog ADD COLUMN notes TEXT");
  }
  if (!backlogColNames.has("tags")) {
    db.exec("ALTER TABLE backlog ADD COLUMN tags TEXT");
  }
  if (!backlogColNames.has("acceptance_criteria")) {
    db.exec("ALTER TABLE backlog ADD COLUMN acceptance_criteria TEXT");
  }
  if (!backlogColNames.has("queue_order")) {
    db.exec("ALTER TABLE backlog ADD COLUMN queue_order INTEGER DEFAULT NULL");
  }

  // Add columns to steps table for backwards compat
  const cols = db.prepare("PRAGMA table_info(steps)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("type")) {
    db.exec("ALTER TABLE steps ADD COLUMN type TEXT NOT NULL DEFAULT 'single'");
  }
  if (!colNames.has("loop_config")) {
    db.exec("ALTER TABLE steps ADD COLUMN loop_config TEXT");
  }
  if (!colNames.has("current_story_id")) {
    db.exec("ALTER TABLE steps ADD COLUMN current_story_id TEXT");
  }
  if (!colNames.has("abandoned_count")) {
    db.exec("ALTER TABLE steps ADD COLUMN abandoned_count INTEGER DEFAULT 0");
  }
  if (!colNames.has("session_key")) {
    db.exec("ALTER TABLE steps ADD COLUMN session_key TEXT");
  }
  if (!colNames.has("claimed_at")) {
    db.exec("ALTER TABLE steps ADD COLUMN claimed_at TEXT");
  }
  if (!colNames.has("finished_at")) {
    db.exec("ALTER TABLE steps ADD COLUMN finished_at TEXT");
  }

  // Add columns to stories table for backwards compat
  const storyCols = db.prepare("PRAGMA table_info(stories)").all() as Array<{ name: string }>;
  const storyColNames = new Set(storyCols.map((c) => c.name));
  if (!storyColNames.has("claimed_at")) {
    db.exec("ALTER TABLE stories ADD COLUMN claimed_at TEXT");
  }
  if (!storyColNames.has("finished_at")) {
    db.exec("ALTER TABLE stories ADD COLUMN finished_at TEXT");
  }

  dedupeStoriesForRunStoryUniqueIndex(db);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_run_id_story_id
    ON stories (run_id, story_id)
  `);

  // Add columns to runs table for backwards compat
  const runCols = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
  const runColNames = new Set(runCols.map((c) => c.name));
  if (!runColNames.has("notify_url")) {
    db.exec("ALTER TABLE runs ADD COLUMN notify_url TEXT");
  }
  if (!runColNames.has("run_number")) {
    db.exec("ALTER TABLE runs ADD COLUMN run_number INTEGER");
    // Backfill existing runs with sequential numbers based on creation order
    db.exec(`
      UPDATE runs SET run_number = (
        SELECT COUNT(*) FROM runs r2 WHERE r2.created_at <= runs.created_at
      ) WHERE run_number IS NULL
    `);
  }
  if (!runColNames.has("project_id")) {
    db.exec("ALTER TABLE runs ADD COLUMN project_id TEXT");
  }

  // Backfill: normalize legacy 'completed' status to 'done' (idempotent)
  db.exec("UPDATE runs SET status = 'done' WHERE status = 'completed'");

  // Unique partial index: prevent two backlog entries in the same project+workflow from being 'dispatched' simultaneously
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_backlog_one_dispatched_per_project
    ON backlog (project_id, workflow_id)
    WHERE status = 'dispatched' AND project_id IS NOT NULL
  `);
}

export function nextRunNumber(): number {
  const db = getDb();
  const row = db.prepare("SELECT COALESCE(MAX(run_number), 0) + 1 AS next FROM runs").get() as { next: number };
  return row.next;
}

export function getDbPath(): string {
  return DB_PATH;
}

export interface BacklogEntry {
  id: string;
  title: string;
  description: string | null;
  /**
   * Valid statuses:
   *   'pending'      — not yet queued
   *   'queued'       — queued for auto-dispatch, waiting for an active run to finish
   *   'dispatching'  — transient in-flight lock; CAS-claimed by advancePipeline before runWorkflow() is called.
   *                    Must NOT be returned by getNextQueuedEntry(). Must be visible in list views.
   *   'dispatched'   — runWorkflow() completed; entry is linked to a run_id
   */
  status: string;
  priority: number;
  run_id: string | null;
  project_id: string | null;
  workflow_id: string | null;
  notes: string | null;
  tags: string | null;
  acceptance_criteria: string | null;
  queue_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  git_repo_path: string | null;
  github_repo_url: string | null;
  created_at: string;
  updated_at: string;
}

export function getBacklog(): BacklogEntry[] {
  const db = getDb();
  return db.prepare(
    "SELECT id, title, description, status, priority, run_id, project_id, workflow_id, notes, tags, acceptance_criteria, queue_order, created_at, updated_at FROM backlog ORDER BY priority ASC, created_at ASC"
  ).all() as unknown as BacklogEntry[];
}
