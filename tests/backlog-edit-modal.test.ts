import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf8');

describe('US-008: openBacklogEntryEdit()', () => {
  it('openBacklogEntryEdit function is defined in index.html', () => {
    assert.ok(html.includes('function openBacklogEntryEdit('), 'openBacklogEntryEdit function must exist');
  });

  it('openBacklogEntryEdit sets editingBacklogId = id', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    assert.ok(fnStart !== -1, 'function must exist');
    const fnBody = html.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes('editingBacklogId = id'), 'must set editingBacklogId to the entry id');
  });

  it('openBacklogEntryEdit pre-fills title field', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("'bm-title'"), 'must reference bm-title field');
    assert.ok(fnBody.includes('entry.title'), 'must use entry.title value');
  });

  it('openBacklogEntryEdit pre-fills description field', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("'bm-description'"), 'must reference bm-description field');
    assert.ok(fnBody.includes('entry.description'), 'must use entry.description value');
  });

  it('openBacklogEntryEdit pre-fills acceptance_criteria field', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("'bm-criteria'"), 'must reference bm-criteria field');
    assert.ok(fnBody.includes('entry.acceptance_criteria'), 'must use entry.acceptance_criteria value');
  });

  it('openBacklogEntryEdit pre-fills notes field', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("'bm-notes'"), 'must reference bm-notes field');
    assert.ok(fnBody.includes('entry.notes'), 'must use entry.notes value');
  });

  it('openBacklogEntryEdit pre-fills tags field', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("'bm-tags'"), 'must reference bm-tags field');
    assert.ok(fnBody.includes('entry.tags'), 'must use entry.tags value');
  });

  it('openBacklogEntryEdit pre-fills priority field', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("'bm-priority'"), 'must reference bm-priority field');
    assert.ok(fnBody.includes('entry.priority'), 'must use entry.priority value');
  });

  it('openBacklogEntryEdit sets modal heading to "Edit Backlog Entry"', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 1200);
    assert.ok(fnBody.includes("'Edit Backlog Entry'") || fnBody.includes('"Edit Backlog Entry"'),
      'must set heading to "Edit Backlog Entry"');
  });

  it('openBacklogEntryEdit shows the overlay', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 1100);
    assert.ok(fnBody.includes("overlay.style.display = 'flex'"), 'must show overlay with flex display');
    assert.ok(fnBody.includes("overlay.classList.add('open')"), 'must add open class to overlay');
  });

  it('backlog card has onclick calling openBacklogEntryEdit', () => {
    assert.ok(html.includes("onclick=\"openBacklogEntryEdit("), 'card must call openBacklogEntryEdit on click');
  });

  it('dispatch button uses event.stopPropagation()', () => {
    assert.ok(html.includes('event.stopPropagation();dispatchBacklogEntry('), 
      'dispatch button must stop propagation to prevent card click');
  });

  it('delete button uses event.stopPropagation()', () => {
    assert.ok(html.includes('event.stopPropagation();deleteBacklogEntry('), 
      'delete button must stop propagation to prevent card click');
  });

  it('openBacklogEntryEdit pre-fills project_id field', () => {
    const fnStart = html.indexOf('function openBacklogEntryEdit(');
    const fnBody = html.slice(fnStart, fnStart + 1100);
    assert.ok(fnBody.includes("'bm-project-id'") || fnBody.includes('"bm-project-id"') || fnBody.includes('populateProjectSelect'),
      'must populate project select from entry.project_id');
    assert.ok(fnBody.includes('entry.project_id') || fnBody.includes('populateProjectSelect'),
      'must use entry.project_id value');
  });

  it('submitBacklogForm PATCH includes project_id', () => {
    const fnStart = html.indexOf('async function submitBacklogForm()');
    assert.ok(fnStart !== -1, 'submitBacklogForm must exist');
    const fnBody = html.slice(fnStart, fnStart + 4000);
    const patchIdx = fnBody.indexOf("method: 'PATCH'");
    assert.ok(patchIdx !== -1, 'must have PATCH block');
    const patchBlock = fnBody.slice(0, patchIdx + 200);
    assert.ok(patchBlock.includes('project_id'), 'PATCH body must include project_id');
  });

  it('submitBacklogForm handles PATCH when editingBacklogId is set', () => {
    const fnStart = html.indexOf('async function submitBacklogForm()');
    assert.ok(fnStart !== -1, 'submitBacklogForm must exist');
    const fnBody = html.slice(fnStart, fnStart + 2000);
    assert.ok(fnBody.includes('editingBacklogId'), 'submitBacklogForm must check editingBacklogId');
    assert.ok(fnBody.includes("method: 'PATCH'"), 'must support PATCH for edit mode');
    assert.ok(fnBody.includes('/api/backlog/${editingBacklogId}') || fnBody.includes('`/api/backlog/${editingBacklogId}`') || fnBody.includes("'/api/backlog/' + editingBacklogId"),
      'must PATCH to /api/backlog/:id');
    assert.ok(fnBody.includes('acceptance_criteria'), 'PATCH must use snake_case acceptance_criteria');
  });
});
