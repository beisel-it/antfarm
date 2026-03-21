import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(import.meta.dirname, '../src/server/index.html'), 'utf-8');

describe('US-004: deleteProject inline confirm UI', () => {
  test('deleteProject function does not use native confirm()', () => {
    const idx = html.indexOf('\nfunction deleteProject(');
    assert.ok(idx !== -1, 'deleteProject function should exist');
    const end = html.indexOf('\nasync function ', idx + 10);
    const funcBody = end !== -1 ? html.slice(idx, end) : html.slice(idx, idx + 1500);
    assert.ok(!funcBody.includes("confirm('Delete this project?')"), 'deleteProject should not call native confirm()');
    assert.ok(!funcBody.includes('confirm('), 'deleteProject should not call any native confirm()');
  });

  test('deleteProject accepts a btn parameter', () => {
    assert.ok(html.includes('function deleteProject(id, btn)'), 'deleteProject should accept (id, btn) parameters');
  });

  test('confirmDeleteProject function exists', () => {
    assert.ok(html.includes('async function confirmDeleteProject('), 'confirmDeleteProject function should exist');
  });

  test('cancelDeleteProject function exists', () => {
    assert.ok(html.includes('function cancelDeleteProject('), 'cancelDeleteProject function should exist');
  });

  test('project card renders with data-project-id attribute', () => {
    assert.ok(
      html.includes('class="project-card" data-project-id='),
      'project card should have data-project-id attribute'
    );
  });

  test('CSS class .project-inline-confirm exists in style block', () => {
    assert.ok(html.includes('.project-inline-confirm{'), 'CSS class .project-inline-confirm should exist');
  });

  test('deleteProject does not call alert()', () => {
    const idx = html.indexOf('\nfunction deleteProject(');
    assert.ok(idx !== -1, 'deleteProject function should exist');
    // Check deleteProject and its helpers together
    const helperEnd = html.indexOf('\nfunction rerenderProjectsColumn', idx + 10);
    const body = helperEnd !== -1 ? html.slice(idx, helperEnd) : html.slice(idx, idx + 2000);
    assert.ok(!body.includes('alert('), 'deleteProject and helpers should not call alert()');
  });

  test('inline confirm HTML rendered in project card template', () => {
    assert.ok(
      html.includes('class="project-inline-confirm"'),
      'project card template should include .project-inline-confirm div'
    );
    assert.ok(
      html.includes('confirmDeleteProject('),
      'project card template should reference confirmDeleteProject'
    );
    assert.ok(
      html.includes('cancelDeleteProject('),
      'project card template should reference cancelDeleteProject'
    );
  });

  test('delete button calls deleteProject with btn reference', () => {
    assert.ok(
      html.includes("onclick=\"deleteProject('${esc(p.id)}', this)\""),
      'delete button should pass this as btn argument'
    );
  });

  test('project-inline-confirm-delete and project-inline-confirm-cancel CSS classes exist', () => {
    assert.ok(html.includes('.project-inline-confirm-delete{'), 'CSS for .project-inline-confirm-delete should exist');
    assert.ok(html.includes('.project-inline-confirm-cancel{'), 'CSS for .project-inline-confirm-cancel should exist');
  });
});
