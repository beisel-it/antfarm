import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf8');

describe('Backlog modal HTML structure', () => {
  it('contains element with id backlog-modal-overlay', () => {
    assert.ok(html.includes('id="backlog-modal-overlay"'), 'Missing id="backlog-modal-overlay"');
  });

  it('contains element with id backlog-modal', () => {
    assert.ok(html.includes('id="backlog-modal"'), 'Missing id="backlog-modal"');
  });

  it('contains input id bm-title', () => {
    assert.ok(html.includes('id="bm-title"'), 'Missing id="bm-title"');
  });

  it('contains textarea id bm-description', () => {
    assert.ok(html.includes('id="bm-description"'), 'Missing id="bm-description"');
  });

  it('contains textarea id bm-criteria', () => {
    assert.ok(html.includes('id="bm-criteria"'), 'Missing id="bm-criteria"');
  });

  it('contains textarea id bm-notes', () => {
    assert.ok(html.includes('id="bm-notes"'), 'Missing id="bm-notes"');
  });

  it('contains input id bm-tags', () => {
    assert.ok(html.includes('id="bm-tags"'), 'Missing id="bm-tags"');
  });

  it('contains input id bm-priority', () => {
    assert.ok(html.includes('id="bm-priority"'), 'Missing id="bm-priority"');
  });

  it('save button has class backlog-modal-save-btn', () => {
    assert.ok(html.includes('class="backlog-modal-save-btn"'), 'Missing class="backlog-modal-save-btn"');
  });

  it('cancel button has class backlog-modal-cancel-btn', () => {
    assert.ok(html.includes('class="backlog-modal-cancel-btn"'), 'Missing class="backlog-modal-cancel-btn"');
  });

  it('modal overlay is hidden by default (display:none)', () => {
    // The overlay should have style="display:none" by default
    assert.ok(html.includes('id="backlog-modal-overlay"') && html.includes('style="display:none"'),
      'Modal overlay should have display:none by default');
  });

  it('modal CSS uses CSS variable tokens for key properties', () => {
    // Modal field inputs should use CSS vars for background, border, and color
    const fieldRule = html.match(/\.backlog-modal-field input,[^{]*\{([^}]+)\}/);
    assert.ok(fieldRule, 'Missing .backlog-modal-field input CSS rule');
    assert.ok(fieldRule[1].includes('var(--bg-surface'), 'Input background should use CSS var');
    assert.ok(fieldRule[1].includes('var(--border)'), 'Input border should use CSS var');
    assert.ok(fieldRule[1].includes('var(--text-primary)'), 'Input color should use CSS var');
  });

  it('modal uses .backlog-modal-field CSS class', () => {
    assert.ok(html.includes('.backlog-modal-field{'), 'Missing .backlog-modal-field CSS rule');
  });

  it('modal uses .backlog-modal-actions CSS class with flex layout', () => {
    assert.ok(html.includes('.backlog-modal-actions{'), 'Missing .backlog-modal-actions CSS rule');
    assert.ok(html.includes('.backlog-modal-actions{display:flex'), 'Missing flex in .backlog-modal-actions');
  });

  it('openBacklogForm function exists', () => {
    assert.ok(html.includes('function openBacklogForm('), 'Missing openBacklogForm function');
  });

  it('closeBacklogModal function exists', () => {
    assert.ok(html.includes('function closeBacklogModal('), 'Missing closeBacklogModal function');
  });

  it('bm-priority input is type number', () => {
    assert.ok(html.includes('type="number" id="bm-priority"') || html.includes('id="bm-priority"'),
      'Missing bm-priority input');
    assert.ok(html.includes('type="number"') && html.includes('id="bm-priority"'),
      'bm-priority should be type number');
  });

  it('contains select id bm-project-id', () => {
    assert.ok(html.includes('id="bm-project-id"'), 'Missing id="bm-project-id" select');
  });

  it('bm-project-id has a default "No project" option', () => {
    assert.ok(html.includes('— No project —'), 'Missing default "No project" option');
  });

  it('populateProjectSelect function exists', () => {
    assert.ok(html.includes('function populateProjectSelect('), 'Missing populateProjectSelect function');
  });

  it('modal CSS includes select in field styling', () => {
    assert.ok(html.includes('.backlog-modal-field select'), 'select must be styled within .backlog-modal-field');
  });
});
