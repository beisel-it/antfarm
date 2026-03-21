import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf8');

describe('US-009: submitBacklogForm() – edit path (PATCH)', () => {
  const fnStart = html.indexOf('async function submitBacklogForm()');

  it('submitBacklogForm is an async function', () => {
    assert.ok(fnStart !== -1, 'submitBacklogForm must exist as async function');
  });

  it('submitBacklogForm checks editingBacklogId to determine PATCH vs POST', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    assert.ok(fnBody.includes('editingBacklogId'), 'must check editingBacklogId');
    // Both branches must exist
    assert.ok(fnBody.includes("method: 'PATCH'"), 'must have PATCH method for edit mode');
    assert.ok(fnBody.includes("method: 'POST'"), 'must have POST method for create mode');
  });

  it('PATCH request is sent to /api/backlog/:id (dynamic route with editingBacklogId)', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    // Template literal with editingBacklogId
    assert.ok(
      fnBody.includes('`/api/backlog/${editingBacklogId}`') ||
      fnBody.includes("'/api/backlog/' + editingBacklogId"),
      'must PATCH to dynamic /api/backlog/:id URL'
    );
  });

  it('PATCH body contains title (snake_case compatible)', () => {
    // Find the PATCH block specifically
    const patchIdx = html.indexOf("method: 'PATCH'", fnStart);
    assert.ok(patchIdx !== -1, 'PATCH block must exist');
    // Get the body object before 'method: PATCH'
    const patchBlock = html.slice(fnStart, patchIdx + 200);
    assert.ok(patchBlock.includes('title'), 'PATCH body must contain title');
  });

  it('PATCH body contains description', () => {
    const patchIdx = html.indexOf("method: 'PATCH'", fnStart);
    const patchBlock = html.slice(fnStart, patchIdx + 200);
    assert.ok(patchBlock.includes('description'), 'PATCH body must contain description');
  });

  it('PATCH body contains notes', () => {
    const patchIdx = html.indexOf("method: 'PATCH'", fnStart);
    const patchBlock = html.slice(fnStart, patchIdx + 200);
    assert.ok(patchBlock.includes('notes'), 'PATCH body must contain notes');
  });

  it('PATCH body contains tags', () => {
    const patchIdx = html.indexOf("method: 'PATCH'", fnStart);
    const patchBlock = html.slice(fnStart, patchIdx + 200);
    assert.ok(patchBlock.includes('tags'), 'PATCH body must contain tags');
  });

  it('PATCH body uses snake_case acceptance_criteria (not camelCase)', () => {
    const patchIdx = html.indexOf("method: 'PATCH'", fnStart);
    const patchBlock = html.slice(fnStart, patchIdx + 200);
    assert.ok(patchBlock.includes('acceptance_criteria'), 'PATCH body must use snake_case acceptance_criteria');
  });

  it('PATCH body contains priority', () => {
    const patchIdx = html.indexOf("method: 'PATCH'", fnStart);
    const patchBlock = html.slice(fnStart, patchIdx + 200);
    assert.ok(patchBlock.includes('priority'), 'PATCH body must contain priority');
  });

  it('on successful PATCH (200), closeBacklogModal is called', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    // After PATCH success check status 200, then close modal
    assert.ok(fnBody.includes("r.status === 200"), 'must check for 200 status on PATCH success');
    assert.ok(fnBody.includes('closeBacklogModal()'), 'must call closeBacklogModal() on success');
  });

  it('on successful PATCH, loadBacklog is called to refresh backlog', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    assert.ok(fnBody.includes('loadBacklog()'), 'must call loadBacklog() to refresh backlog column');
  });

  it('on successful PATCH, renderBoard is called to re-render the board', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    assert.ok(fnBody.includes('renderBoard('), 'must call renderBoard() to re-render board after edit');
  });

  it('editingBacklogId=null path still uses POST (not PATCH)', () => {
    // The else branch after editingBacklogId check should have POST
    const elseIdx = html.indexOf("method: 'POST'", fnStart);
    assert.ok(elseIdx !== -1, 'POST branch must exist for create mode');
    // POST should come after PATCH in the function (else branch)
    const patchIdx = html.indexOf("method: 'PATCH'", fnStart);
    assert.ok(patchIdx < elseIdx, 'PATCH branch should come before POST branch (if/else structure)');
  });

  it('POST body uses camelCase acceptanceCriteria (not snake_case)', () => {
    // Find the POST block
    const postIdx = html.indexOf("method: 'POST'", fnStart);
    // Get body object before POST
    const postBlock = html.slice(fnStart + 2000, postIdx + 200); // skip past the PATCH block
    assert.ok(postBlock.includes('acceptanceCriteria'), 'POST body must use camelCase acceptanceCriteria');
  });

  it('Save button is disabled during PATCH request and re-enabled in finally', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    assert.ok(fnBody.includes('saveBtn.disabled = true'), 'must disable save button before request');
    assert.ok(fnBody.includes('saveBtn.disabled = false'), 'must re-enable save button in finally block');
    // The re-enable should be in a finally block
    const finallyIdx = fnBody.indexOf('finally');
    assert.ok(finallyIdx !== -1, 'must have finally block');
    const finallyBlock = fnBody.slice(finallyIdx);
    assert.ok(finallyBlock.includes('saveBtn.disabled = false'), 'must re-enable in finally block');
  });

  it('title validation occurs before PATCH (returns early on empty title)', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    const returnIdx = fnBody.indexOf('return;');
    const patchIdx = fnBody.indexOf("method: 'PATCH'");
    assert.ok(returnIdx !== -1, 'must have early return for validation');
    assert.ok(returnIdx < patchIdx, 'validation return must come before PATCH request');
  });

  it('PATCH error response shows error message', () => {
    const fnBody = html.slice(fnStart, fnStart + 7000);
    assert.ok(
      fnBody.includes('Failed to update entry') || fnBody.includes('data.error'),
      'must show error message when PATCH fails'
    );
  });
});
