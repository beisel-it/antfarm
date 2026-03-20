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
});
