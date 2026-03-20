/**
 * US-001: Expose type and loop_config fields in StepInfo TypeScript type
 *
 * Tests that:
 * 1. StepInfo type includes `type` field with values 'single' | 'loop'
 * 2. StepInfo type includes `loop_config` field that can be string or null
 * 3. DB rows with these fields are correctly returned by SELECT *
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import type { StepInfo } from "../src/installer/status.js";

// ── Minimal in-memory DB mirroring production schema ──────────────────

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      context TEXT NOT NULL DEFAULT '{}',
      run_number INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE steps (
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
      type TEXT NOT NULL DEFAULT 'single',
      loop_config TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}

function now(): string {
  return new Date().toISOString();
}

describe("US-001: StepInfo type exposes type and loop_config fields", () => {
  it("StepInfo type includes 'type' field — default is 'single'", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    db.prepare(
      `INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, created_at, updated_at)
       VALUES (?, ?, 'step-1', 'agent-1', 0, 'input', 'output', ?, ?)`
    ).run(stepId, runId, t, t);

    const step = db.prepare("SELECT * FROM steps WHERE id = ?").get(stepId) as StepInfo;

    assert.ok('type' in step, "StepInfo should have 'type' field");
    assert.equal(step.type, 'single', "Default type should be 'single'");
  });

  it("StepInfo type includes 'type' field — can be 'loop'", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    db.prepare(
      `INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, type, created_at, updated_at)
       VALUES (?, ?, 'step-1', 'agent-1', 0, 'input', 'output', 'loop', ?, ?)`
    ).run(stepId, runId, t, t);

    const step = db.prepare("SELECT * FROM steps WHERE id = ?").get(stepId) as StepInfo;

    assert.equal(step.type, 'loop', "Type field should support 'loop' value");
  });

  it("StepInfo type includes 'loop_config' field — default is null", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    db.prepare(
      `INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, created_at, updated_at)
       VALUES (?, ?, 'step-1', 'agent-1', 0, 'input', 'output', ?, ?)`
    ).run(stepId, runId, t, t);

    const step = db.prepare("SELECT * FROM steps WHERE id = ?").get(stepId) as StepInfo;

    assert.ok('loop_config' in step, "StepInfo should have 'loop_config' field");
    assert.equal(step.loop_config, null, "Default loop_config should be null");
  });

  it("StepInfo type includes 'loop_config' field — can hold JSON string", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const t = now();
    const loopConfig = JSON.stringify({ steps: ['implement', 'verify'], stories: ['US-001', 'US-002'] });

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    db.prepare(
      `INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, type, loop_config, created_at, updated_at)
       VALUES (?, ?, 'step-1', 'agent-1', 0, 'input', 'output', 'loop', ?, ?, ?)`
    ).run(stepId, runId, loopConfig, t, t);

    const step = db.prepare("SELECT * FROM steps WHERE id = ?").get(stepId) as StepInfo;

    assert.equal(typeof step.loop_config, 'string', "loop_config should be a string when set");
    assert.equal(step.loop_config, loopConfig, "loop_config should match the stored JSON string");

    // Verify it parses back correctly
    const parsed = JSON.parse(step.loop_config as string);
    assert.deepEqual(parsed.steps, ['implement', 'verify']);
  });

  it("SELECT * returns both type and loop_config fields together", () => {
    const db = createTestDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const t = now();
    const loopConfig = JSON.stringify({ steps: ['implement', 'verify'] });

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    db.prepare(
      `INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, type, loop_config, created_at, updated_at)
       VALUES (?, ?, 'step-1', 'agent-1', 0, 'input', 'output', 'loop', ?, ?, ?)`
    ).run(stepId, runId, loopConfig, t, t);

    const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(runId) as StepInfo[];

    assert.equal(steps.length, 1);
    const step = steps[0];
    assert.equal(step.type, 'loop');
    assert.equal(step.loop_config, loopConfig);
    assert.equal(step.id, stepId);
    assert.equal(step.run_id, runId);
  });
});
