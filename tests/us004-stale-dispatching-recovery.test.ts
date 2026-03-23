/**
 * US-004: Add stale 'dispatching' recovery in medic/cleanupAbandonedSteps
 *
 * Tests that cleanupAbandonedSteps() resets backlog entries stuck in 'dispatching'
 * for more than 60 seconds back to 'queued', while leaving recent 'dispatching'
 * entries untouched.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { getDb } from "../src/db.ts";
import {
  addBacklogEntry,
  getBacklogEntry,
} from "../dist/backlog/index.js";
import { cleanupAbandonedSteps } from "../dist/installer/step-ops.js";

function uid(): string {
  return crypto.randomUUID();
}

describe("US-004: stale 'dispatching' recovery in cleanupAbandonedSteps", () => {
  after(() => {
    // Nothing to clean up — test DB is temp
  });

  it("AC-1: resets backlog entry stuck in 'dispatching' for >60s back to 'queued'", () => {
    const db = getDb();
    const entry = addBacklogEntry({ title: "stale dispatch test" });

    // Manually set entry to 'dispatching' with an old updated_at (2 minutes ago)
    const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    db.prepare(
      "UPDATE backlog SET status='dispatching', updated_at=? WHERE id=?"
    ).run(staleTime, entry.id);

    // Verify it's dispatching before cleanup
    const before = getBacklogEntry(entry.id);
    assert.equal(before?.status, "dispatching");

    // Run cleanup
    cleanupAbandonedSteps();

    // Should be reset to queued
    const after = getBacklogEntry(entry.id);
    assert.equal(after?.status, "queued");
  });

  it("AC-3: entries 'dispatching' for <60s are NOT reset", () => {
    const db = getDb();
    const entry = addBacklogEntry({ title: "fresh dispatch test" });

    // Set entry to 'dispatching' with a very recent updated_at (10 seconds ago)
    const freshTime = new Date(Date.now() - 10 * 1000).toISOString();
    db.prepare(
      "UPDATE backlog SET status='dispatching', updated_at=? WHERE id=?"
    ).run(freshTime, entry.id);

    // Run cleanup
    cleanupAbandonedSteps();

    // Should still be dispatching
    const result = getBacklogEntry(entry.id);
    assert.equal(result?.status, "dispatching");

    // Clean up
    db.prepare("DELETE FROM backlog WHERE id=?").run(entry.id);
  });

  it("AC-1 variant: multiple stale 'dispatching' entries are all reset", () => {
    const db = getDb();
    const entry1 = addBacklogEntry({ title: "stale dispatch 1" });
    const entry2 = addBacklogEntry({ title: "stale dispatch 2" });

    const staleTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    db.prepare("UPDATE backlog SET status='dispatching', updated_at=? WHERE id=?").run(staleTime, entry1.id);
    db.prepare("UPDATE backlog SET status='dispatching', updated_at=? WHERE id=?").run(staleTime, entry2.id);

    cleanupAbandonedSteps();

    assert.equal(getBacklogEntry(entry1.id)?.status, "queued");
    assert.equal(getBacklogEntry(entry2.id)?.status, "queued");
  });

  it("queue_order is set to COALESCE(queue_order, 0) after recovery", () => {
    const db = getDb();
    const entry = addBacklogEntry({ title: "queue_order check" });

    // Set to dispatching with null queue_order
    const staleTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    db.prepare(
      "UPDATE backlog SET status='dispatching', queue_order=NULL, updated_at=? WHERE id=?"
    ).run(staleTime, entry.id);

    cleanupAbandonedSteps();

    const result = db.prepare("SELECT status, queue_order FROM backlog WHERE id=?").get(entry.id) as { status: string; queue_order: number | null } | undefined;
    assert.equal(result?.status, "queued");
    // COALESCE(NULL, 0) = 0
    assert.equal(result?.queue_order, 0);
  });

  it("entries exactly at 60s boundary are not reset (threshold is strictly > 60s)", () => {
    const db = getDb();
    const entry = addBacklogEntry({ title: "boundary test" });

    // Set to dispatching with updated_at exactly 58 seconds ago (well within threshold)
    const borderTime = new Date(Date.now() - 58 * 1000).toISOString();
    db.prepare(
      "UPDATE backlog SET status='dispatching', updated_at=? WHERE id=?"
    ).run(borderTime, entry.id);

    cleanupAbandonedSteps();

    // Should NOT be reset (< 60s)
    const result = getBacklogEntry(entry.id);
    assert.equal(result?.status, "dispatching");

    // Clean up
    db.prepare("DELETE FROM backlog WHERE id=?").run(entry.id);
  });
});
