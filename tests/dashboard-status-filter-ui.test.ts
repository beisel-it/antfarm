import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('dashboard status filter UI', () => {
  let html: string;

  before(() => {
    const distPath = join(import.meta.dirname ?? __dirname, '..', 'dist', 'server', 'index.html');
    html = readFileSync(distPath, 'utf8');
  });

  it('has a toggle button for status "running" with data-status attribute', () => {
    assert.ok(
      html.includes('data-status="running"'),
      'Expected data-status="running" button in dist/server/index.html'
    );
  });

  it('has a toggle button for status "done" with data-status attribute', () => {
    assert.ok(
      html.includes('data-status="done"'),
      'Expected data-status="done" button in dist/server/index.html'
    );
  });

  it('has a toggle button for status "failed" with data-status attribute', () => {
    assert.ok(
      html.includes('data-status="failed"'),
      'Expected data-status="failed" button in dist/server/index.html'
    );
  });

  it('has a toggle button for status "cancelled" with data-status attribute', () => {
    assert.ok(
      html.includes('data-status="cancelled"'),
      'Expected data-status="cancelled" button in dist/server/index.html'
    );
  });

  it('JavaScript references the antfarm-status-filter localStorage key', () => {
    assert.ok(
      html.includes('antfarm-status-filter'),
      'Expected "antfarm-status-filter" localStorage key reference in dist/server/index.html JS'
    );
  });

  it('JavaScript contains logic to filter runs by status in renderBoard', () => {
    // Check that renderBoard filters runs using activeStatuses
    assert.ok(
      html.includes('activeStatuses.includes(run.status)'),
      'Expected activeStatuses.includes(run.status) filter logic in renderBoard'
    );
  });

  it('all four data-status buttons are present as filter buttons with class status-filter-btn', () => {
    const statuses = ['running', 'done', 'failed', 'cancelled'];
    for (const status of statuses) {
      const pattern = `data-status="${status}"`;
      assert.ok(
        html.includes(pattern),
        `Expected button with ${pattern}`
      );
    }
    // Also verify the button class is present
    assert.ok(
      html.includes('status-filter-btn'),
      'Expected .status-filter-btn CSS class in HTML'
    );
  });

  it('localStorage is read on page load to restore filter state', () => {
    assert.ok(
      html.includes('localStorage.getItem(STATUS_FILTER_KEY)'),
      'Expected localStorage.getItem call for STATUS_FILTER_KEY to restore filter state on load'
    );
  });

  it('localStorage is written on toggle to persist filter state', () => {
    assert.ok(
      html.includes('localStorage.setItem(STATUS_FILTER_KEY'),
      'Expected localStorage.setItem call for STATUS_FILTER_KEY to persist state on toggle'
    );
  });

  // US-004: Verify 'done' is the terminal run status in frontend logic
  it('renderBoard checks run.status === "done" to apply done styling (not "completed")', () => {
    assert.ok(
      html.includes("run.status === 'done'"),
      'Expected renderBoard to check run.status === \'done\' for done card styling'
    );
    assert.ok(
      !html.includes("run.status === 'completed'"),
      'Expected renderBoard NOT to check run.status === \'completed\' — "completed" is not a valid run status'
    );
  });

  it('.card.done CSS class is applied when run status is "done"', () => {
    // Verify that the CSS class 'done' on a card is wired to isDone check
    assert.ok(
      html.includes('.card.done'),
      'Expected .card.done CSS rule to style done runs with green border'
    );
    // Verify the isDone variable flows to the card class
    assert.ok(
      html.includes("isDone ? 'done'"),
      'Expected isDone ? \'done\' logic to set the card CSS class'
    );
  });

  it('does not use "completed" as a run status label in filter buttons or card classes', () => {
    // The only acceptable use of "completed" in the HTML is SSE event names and badge backward-compat CSS
    // There must be NO data-status="completed" button
    assert.ok(
      !html.includes('data-status="completed"'),
      'Expected no data-status="completed" filter button — terminal status is "done"'
    );
  });

  it('done status filter button is present and uses status value "done"', () => {
    assert.ok(
      html.includes('data-status="done"'),
      'Expected status filter button with data-status="done" to be present'
    );
  });
});
