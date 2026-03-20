import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Backlog add button (US-004)', () => {
  const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf8');

  it('renderBacklogColumn template contains backlog-add-btn class', () => {
    assert.ok(
      html.includes('backlog-add-btn'),
      'Expected class "backlog-add-btn" to appear in index.html'
    );
  });

  it('button text is "+ Add"', () => {
    assert.ok(
      html.includes('+ Add'),
      'Expected button text "+ Add" to appear in index.html'
    );
  });

  it('.backlog-add-btn CSS uses var(--accent-green) for background', () => {
    // Find the CSS definition for .backlog-add-btn
    const cssMatch = html.match(/\.backlog-add-btn\{[^}]+\}/);
    assert.ok(cssMatch, 'Expected .backlog-add-btn CSS rule to exist');
    assert.ok(
      cssMatch[0].includes('background:var(--accent-green)'),
      'Expected .backlog-add-btn to use var(--accent-green) as background'
    );
  });

  it('.backlog-add-btn CSS uses white text color', () => {
    const cssMatch = html.match(/\.backlog-add-btn\{[^}]+\}/);
    assert.ok(cssMatch, 'Expected .backlog-add-btn CSS rule to exist');
    assert.ok(
      cssMatch[0].includes('color:#fff'),
      'Expected .backlog-add-btn to use white (#fff) text color'
    );
  });

  it('button has onclick="openBacklogForm()"', () => {
    assert.ok(
      html.includes('onclick="openBacklogForm()"'),
      'Expected button to have onclick="openBacklogForm()"'
    );
  });

  it('openBacklogForm function is defined', () => {
    assert.ok(
      html.includes('function openBacklogForm()'),
      'Expected openBacklogForm() function to be defined'
    );
  });

  it('renderBacklogColumn header uses flex layout with space-between', () => {
    assert.ok(
      html.includes('justify-content:space-between'),
      'Expected column header to use justify-content:space-between for flex layout'
    );
  });

  it('Backlog column still renders entries via renderBacklogColumn()', () => {
    // Verify the function still maps entries and renders empty-state
    assert.ok(
      html.includes("'No backlog entries'") || html.includes('"No backlog entries"') || html.includes('No backlog entries'),
      'Expected empty-state text "No backlog entries" to still be present'
    );
    assert.ok(
      html.includes('backlog-card'),
      'Expected backlog-card class to be present in card rendering'
    );
  });
});
