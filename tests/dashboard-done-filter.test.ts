/**
 * US-005: End-to-end integration test: done filter shows completed runs.
 *
 * Verifies the full round-trip: a run stored with status='done' is returned
 * by GET /api/runs?status=done, while runs with other statuses are not.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startDashboard } from "../dist/server/dashboard.js";
import { getDb } from "../dist/db.js";
import { randomUUID } from "node:crypto";

let server: http.Server;
const PORT = 14205;
const BASE = `http://localhost:${PORT}`;

// Unique workflow ID to avoid interference with other tests
const WORKFLOW_ID = `us005-done-filter-${randomUUID()}`;

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

function seedRun(id: string, status: string) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?, ?)"
  ).run(id, 1, WORKFLOW_ID, "test task", status, now, now);
}

let runDone: string;
let runRunning: string;
let runFailed: string;

before(async () => {
  // Initialize schema
  const db = getDb();
  db.prepare("DELETE FROM runs WHERE workflow_id = ?").run(WORKFLOW_ID);

  // Seed the three test runs
  runDone = randomUUID();
  runRunning = randomUUID();
  runFailed = randomUUID();

  seedRun(runDone, "done");
  seedRun(runRunning, "running");
  seedRun(runFailed, "failed");

  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once("listening", resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  db.prepare("DELETE FROM runs WHERE workflow_id = ?").run(WORKFLOW_ID);
});

describe("US-005: GET /api/runs?status=done full round-trip", () => {
  it("returns the run with status='done' when filtering for status=done", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));

    const found = runs.find((r) => r.id === runDone);
    assert.ok(found, "The run with status='done' must appear in status=done filter");
    assert.equal(found.status, "done");
  });

  it("does NOT return a run with status='running' when filtering for status=done", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));

    const runningRun = runs.find((r) => r.id === runRunning);
    assert.ok(!runningRun, "A run with status='running' must NOT appear in status=done filter");
  });

  it("does NOT return a run with status='failed' when filtering for status=done", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));

    const failedRun = runs.find((r) => r.id === runFailed);
    assert.ok(!failedRun, "A run with status='failed' must NOT appear in status=done filter");
  });

  it("returns exactly one run when filtering status=done for this workflow", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 1, "Exactly one run has status='done' in this workflow");
    assert.equal(runs[0].status, "done");
  });

  it("all returned runs have status='done' — no other statuses leak through", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}&status=done`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));

    for (const run of runs) {
      assert.equal(run.status, "done", `Expected all filtered runs to have status='done', got '${run.status}'`);
    }
  });

  it("returns all three runs when no status filter applied", async () => {
    const { status, data } = await req(`/api/runs?workflow=${WORKFLOW_ID}`);
    assert.equal(status, 200);
    const runs = data as Array<{ id: string; status: string }>;
    assert.ok(Array.isArray(runs));
    assert.equal(runs.length, 3, "All 3 seeded runs should appear with no status filter");
  });
});
