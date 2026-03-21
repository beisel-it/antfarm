import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve('src/server/index.html'), 'utf8');

describe('submitBacklogForm() – US-007', () => {
  it('submitBacklogForm function exists in index.html', () => {
    assert.ok(html.includes('function submitBacklogForm()'), 'submitBacklogForm() should be defined');
  });

  it('Save button has onclick="submitBacklogForm()"', () => {
    assert.ok(html.includes('onclick="submitBacklogForm()"'), 'Save button should call submitBacklogForm()');
  });

  it('Save button has id="backlog-save-btn"', () => {
    assert.ok(html.includes('id="backlog-save-btn"'), 'Save button should have id backlog-save-btn');
  });

  it('submitBacklogForm validates title is non-empty (shows error)', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    assert.ok(idx !== -1, 'function must exist');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('Title is required'), 'should show inline validation error for empty title');
    assert.ok(body.includes('bm-title-error') || body.includes('errEl'), 'should manage error element');
  });

  it('submitBacklogForm returns early (does not POST) when title is empty', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    // Validation returns before fetch
    const returnIdx = body.indexOf('return;');
    const fetchIdx = body.indexOf("fetch(API");
    assert.ok(returnIdx < fetchIdx, 'return; should come before fetch (validates before posting)');
  });

  it('submitBacklogForm POSTs to /api/backlog', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes("'/api/backlog'"), 'should POST to /api/backlog');
    assert.ok(body.includes("method: 'POST'"), 'should use POST method');
  });

  it('submitBacklogForm includes all required fields in body', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('title'), 'should include title');
    assert.ok(body.includes('description'), 'should include description');
    assert.ok(body.includes('notes'), 'should include notes');
    assert.ok(body.includes('tags'), 'should include tags');
    assert.ok(body.includes('acceptanceCriteria'), 'should include acceptanceCriteria');
    assert.ok(body.includes('priority'), 'should include priority');
  });

  it('submitBacklogForm disables save button while in flight', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('saveBtn.disabled = true'), 'should disable save button during request');
    assert.ok(body.includes('saveBtn.disabled = false'), 'should re-enable save button after request');
  });

  it('submitBacklogForm calls closeBacklogModal on 201', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('closeBacklogModal()'), 'should call closeBacklogModal() on success');
  });

  it('submitBacklogForm calls loadBacklog on 201', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('loadBacklog()'), 'should call loadBacklog() on success');
  });

  it('submitBacklogForm calls renderBoard on 201', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('renderBoard('), 'should call renderBoard() on success');
  });

  it('submitBacklogForm handles error response', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('Failed to save entry') || body.includes('data.error'), 'should handle error response');
  });

  it('submitBacklogForm handles network error', () => {
    const idx = html.indexOf('function submitBacklogForm()');
    const body = html.slice(idx, idx + 7000);
    assert.ok(body.includes('Network error'), 'should handle network errors');
  });
});
