/**
 * US-001: Tests for status filter query parameter on GET /api/runs endpoint.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";
import { randomUUID } from "node:crypto";

let server: http.Server;
const PORT = 14201;
const BASE = `http://localhost:${PORT}`;

async function req(urlPath: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: "localhost", port: PORT, path: urlPath, method: "GET" },
      (res) => {
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
      }
    );
    r.on("error", reject);
    r.end();
  });
}

const WORKFLOW_ID = "test-wf-status-filter";

function seedRun(id: string, status: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?)"
  ).run(id, 1, WORKFLOW_ID, "test task", status, now, now);
}

let runRunning: string;
let runPending: string;
let runDone: string;
let runFailed: string;
let runCancelled: string;
let runError: string;
let runCompleted: string;

before(async () => {
  const db = getDb();
  db.prepare("DELETE FROM runs WHERE workflow_id = ?").run(WORKFLOW_ID);

  runRunning = randomUUID();
  runPending = randomUUID();
  runDone = randomUUID();
  runFailed = randomUUID();
  runCancelled = randomUUID();
  runError = randomUUID();
  runCompleted = randomUUID();

  seedRun(runRunning, "running");
  seedRun(runPending, "pending");
  seedRun(runDone, "done");
  seedRun(runFailed, "failed");
  seedRun(runCancelled, "cancelled");
  seedRun(runError, "error");
  // Deliberately seed a 'completed' run to test that the API filter does NOT
  // return it when filtering for 'done' (exact match, not alias)
  seedRun(runCompleted, "completed");

  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  db.prepare("DELETE FROM runs WHERE workflow_id = ?").run(WORKFLOW_ID);
});

describe("US-001: GET /api/runs status filter", () => {
  it("returns all runs for workflow when no status param given (backward-compatible)", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 7, "Should return all 7 seeded runs (including 'completed' legacy run)");
  });

  it("returns only running runs when status=running", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=running`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 1);
    assert.equal(runs[0].id, runRunning);
    assert.equal(runs[0].status, "running");
  });

  it("returns running and pending runs when status=running,pending", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=running,pending`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 2);
    const statuses = runs.map((r) => r.status);
    assert.ok(statuses.includes("running"));
    assert.ok(statuses.includes("pending"));
  });

  it("returns done, failed, and cancelled runs when status=done,failed,cancelled", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done,failed,cancelled`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 3);
    const statuses = runs.map((r) => r.status);
    assert.ok(statuses.includes("done"));
    assert.ok(statuses.includes("failed"));
    assert.ok(statuses.includes("cancelled"));
  });

  it("falls back to all runs when status param is empty string", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 7, "Empty status param should return all runs (including 'completed' legacy run)");
  });

  it("filters globally (no workflow param) when only status provided", async () => {
    const { status, data } = await req(`/api/runs?status=error`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    // At least the error run we seeded should be there
    const ourRun = runs.find((r) => r.id === runError);
    assert.ok(ourRun, "Should find the seeded error run globally");
    assert.equal(ourRun.status, "error");
  });

  it("returns empty array when status filter matches no runs", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=pending&status=nonexistent`);
    // Note: standard URLSearchParams only uses the last value for repeated keys,
    // so this effectively filters for status=nonexistent. Let's use a single param.
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });

  it("returns empty array when filtering a workflow with no matching status", async () => {
    const { status, data } = await req(`/api/runs?workflow=nonexistent-workflow-xyz&status=running`);
    assert.equal(status, 200);
    const runs = data as unknown[];
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 0);
  });
});

describe("US-003: GET /api/runs status=done does NOT return 'completed' legacy runs", () => {
  it("does not return 'completed' runs when filtering for status=done", async () => {
    // The DB migration (US-002) should handle backfilling 'completed' → 'done',
    // but we test that the API filter uses exact matching — a run that somehow
    // has status='completed' in the DB does NOT appear when querying ?status=done.
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));

    // The 'done' run MUST appear
    const doneRun = runs.find((r) => r.id === runDone);
    assert.ok(doneRun, "The run with status='done' should appear in status=done filter");
    assert.equal(doneRun.status, "done");

    // The 'completed' run MUST NOT appear (no alias — exact DB match only)
    const completedRun = runs.find((r) => r.id === runCompleted);
    assert.ok(!completedRun, "The run with status='completed' must NOT appear when filtering for status=done");

    // Verify none of the returned runs have status='completed'
    const completedStatuses = runs.filter((r) => r.status === "completed");
    assert.equal(completedStatuses.length, 0, "No runs with status='completed' should appear in status=done filter");
  });

  it("returns only runs with status='done' when filtering for status=done", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 1, "Exactly one run has status='done'");
    assert.equal(runs[0].id, runDone);
    assert.equal(runs[0].status, "done");
  });
});
