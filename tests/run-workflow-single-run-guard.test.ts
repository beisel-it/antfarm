/**
 * Tests for the runWorkflow() single-run-per-project guard.
 *
 * Safety note: These tests call runWorkflow() which internally calls ensureWorkflowCrons().
 * However, ANTFARM_SKIP_CRON=1 (set by tests/db-test-setup.js) makes ensureWorkflowCrons
 * a no-op, so no cronjobs are registered in the real gateway during these tests.
 *
 * Additional defence-in-depth:
 * - A beforeEach verifies ANTFARM_SKIP_CRON === '1' and throws if not set.
 * - A globalThis.fetch spy asserts that fetch is never called on the cron endpoint.
 * - Tests 1–4 trigger the guard (which throws BEFORE ensureWorkflowCrons is reached),
 *   making them doubly safe.
 * - Tests 5–6 fail with a "workflow not found" error (also before ensureWorkflowCrons),
 *   so they are equally safe.
 */

import { test, before, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { runWorkflow } from "../dist/installer/run.js";
import { getDb } from "../dist/db.js";

// ---------------------------------------------------------------------------
// Fetch spy — asserts that the cron gateway endpoint is never called
// ---------------------------------------------------------------------------

let originalFetch: typeof globalThis.fetch;
let cronFetchCalled = false;
let cronFetchUrl = "";

function installFetchSpy() {
  originalFetch = globalThis.fetch;
  cronFetchCalled = false;
  cronFetchUrl = "";
  (globalThis as any).fetch = (...args: unknown[]) => {
    const url = typeof args[0] === "string" ? args[0] : String(args[0]);
    // Detect any call to the openclaw gateway cron endpoint
    if (url.includes("/cron") || url.includes("openclaw") || url.includes("gateway")) {
      cronFetchCalled = true;
      cronFetchUrl = url;
      throw new Error(
        `[TEST GUARD] fetch was unexpectedly called on a gateway/cron URL: ${url}`
      );
    }
    // For any other fetch call, delegate to original or throw to keep tests hermetic
    throw new Error(`[TEST GUARD] unexpected fetch call: ${url}`);
  };
}

function uninstallFetchSpy() {
  (globalThis as any).fetch = originalFetch;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function insertRun(opts: {
  id?: string;
  projectId: string | null;
  status: string;
  workflowId?: string;
  task?: string;
  runNumber?: number;
}): string {
  const db = getDb();
  const id = opts.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, run_number, workflow_id, task, status, context, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    opts.runNumber ?? 1,
    opts.workflowId ?? "test-workflow",
    opts.task ?? "Test task",
    opts.status,
    "{}",
    opts.projectId,
    now,
    now
  );
  return id;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

before(() => {
  const db = getDb();
  db.prepare("DELETE FROM steps").run();
  db.prepare("DELETE FROM runs").run();
});

beforeEach(() => {
  // Verify that the ANTFARM_SKIP_CRON guard is active before each test.
  // This ensures no cron jobs are accidentally registered in the real gateway.
  if (process.env.ANTFARM_SKIP_CRON !== "1") {
    throw new Error(
      "ANTFARM_SKIP_CRON must be '1' when running tests. " +
        "Ensure tests/db-test-setup.js is loaded via --import."
    );
  }

  const db = getDb();
  db.prepare("DELETE FROM steps").run();
  db.prepare("DELETE FROM runs").run();

  installFetchSpy();
});

afterEach(() => {
  uninstallFetchSpy();

  // Assert the cron endpoint was never called during this test
  assert.ok(
    !cronFetchCalled,
    `fetch was called on a cron/gateway URL during the test: ${cronFetchUrl}`
  );
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("runWorkflow() throws when projectId already has a running run", async () => {
  const projectId = crypto.randomUUID();
  const runId = insertRun({ projectId, status: "running", runNumber: 7 });

  await assert.rejects(
    () => runWorkflow({ workflowId: "any-workflow", taskTitle: "New task", projectId }),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should be an Error");
      assert.ok(
        err.message.includes(runId),
        `error message should contain active run id "${runId}", got: "${err.message}"`
      );
      return true;
    }
  );
});

test("runWorkflow() error message contains run number", async () => {
  const projectId = crypto.randomUUID();
  insertRun({ projectId, status: "running", runNumber: 42 });

  await assert.rejects(
    () => runWorkflow({ workflowId: "any-workflow", taskTitle: "New task", projectId }),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should be an Error");
      assert.ok(
        err.message.includes("#42"),
        `error message should contain "#42", got: "${err.message}"`
      );
      return true;
    }
  );
});

test("runWorkflow() error message matches expected format", async () => {
  const projectId = crypto.randomUUID();
  const runId = insertRun({ projectId, status: "running", runNumber: 3 });

  await assert.rejects(
    () => runWorkflow({ workflowId: "any-workflow", taskTitle: "New task", projectId }),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should be an Error");
      assert.equal(
        err.message,
        `Project already has an active run: #3 (${runId})`
      );
      return true;
    }
  );
});

test("runWorkflow() guard does not create a new DB row when it fires", async () => {
  const db = getDb();
  const projectId = crypto.randomUUID();
  insertRun({ projectId, status: "running", runNumber: 1 });

  const countBefore = (db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number }).count;

  await assert.rejects(
    () => runWorkflow({ workflowId: "any-workflow", taskTitle: "Should not be created", projectId }),
    /Project already has an active run/
  );

  const countAfter = (db.prepare("SELECT COUNT(*) as count FROM runs").get() as { count: number }).count;
  assert.equal(countAfter, countBefore, "no new run should be created when guard fires");
});

test("runWorkflow() without projectId is unaffected by the guard (even when other projects have running runs)", async () => {
  const otherProjectId = crypto.randomUUID();
  insertRun({ projectId: otherProjectId, status: "running", runNumber: 5 });

  // Should throw for a different reason (workflow not found), NOT for the concurrent run guard
  await assert.rejects(
    () => runWorkflow({ workflowId: "nonexistent-workflow", taskTitle: "No project" }),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should be an Error");
      // Should NOT be the concurrent run guard error
      assert.ok(
        !err.message.startsWith("Project already has an active run"),
        `should not throw concurrent run error, got: "${err.message}"`
      );
      return true;
    }
  );
});

test("runWorkflow() with projectId that has only completed/failed runs does not throw the guard error", async () => {
  const projectId = crypto.randomUUID();
  insertRun({ projectId, status: "completed", runNumber: 1 });
  insertRun({ projectId, status: "failed", runNumber: 2 });
  insertRun({ projectId, status: "cancelled", runNumber: 3 });

  // Should fail for a different reason (workflow not found), NOT the guard
  await assert.rejects(
    () => runWorkflow({ workflowId: "nonexistent-workflow", taskTitle: "Test", projectId }),
    (err: unknown) => {
      assert.ok(err instanceof Error, "should be an Error");
      assert.ok(
        !err.message.startsWith("Project already has an active run"),
        `should not throw concurrent run error, got: "${err.message}"`
      );
      return true;
    }
  );
});
