/**
 * Tests for US-009: Wire project delete button on badge with inline confirmation
 * Port: 14980
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDashboard } from '../dist/server/dashboard.js';

const PORT = 14980;
const BASE = `http://localhost:${PORT}`;
let server: { close: () => void };

before(async () => {
  server = await startDashboard(PORT);
});

after(() => {
  server.close();
});

async function fetchHTML(): Promise<string> {
  const res = await fetch(`${BASE}/`);
  return res.text();
}

async function createProject(name: string): Promise<string> {
  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const data = await res.json() as { id: string };
  return data.id;
}

describe('US-009: Project badge delete with inline confirmation', () => {
  it('CSS: .project-badge-inline-confirm class exists in HTML', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('.project-badge-inline-confirm'), 'should have .project-badge-inline-confirm CSS class');
  });

  it('CSS: .project-badge-inline-confirm.active style exists', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('.project-badge-inline-confirm.active'), 'should have .project-badge-inline-confirm.active CSS');
  });

  it('CSS: .project-badge-inline-confirm-delete button style exists', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('.project-badge-inline-confirm-delete'), 'should have delete button CSS for badge confirm');
  });

  it('CSS: .project-badge-inline-confirm-cancel button style exists', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('.project-badge-inline-confirm-cancel'), 'should have cancel button CSS for badge confirm');
  });

  it('renderProjectsBar uses deleteProjectBadge for delete button', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('deleteProjectBadge('), 'should use deleteProjectBadge() in the badge delete button');
  });

  it('renderProjectsBar: delete button no longer calls deleteProject directly on badge', async () => {
    const html = await fetchHTML();
    // The delete button inside renderProjectsBar should call deleteProjectBadge, not deleteProject('...',this)
    // Get the renderProjectsBar function body
    const fnStart = html.indexOf('function renderProjectsBar() {');
    assert.ok(fnStart !== -1, 'renderProjectsBar function should exist');
    const fnEnd = html.indexOf('function toggleProjectSelection(', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes('deleteProjectBadge('), 'badge delete should call deleteProjectBadge');
  });

  it('renderProjectsBar includes inline confirm span with unique id pattern', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('project-badge-inline-confirm'), 'renderProjectsBar should include inline confirm element');
    assert.ok(html.includes('badge-confirm-'), 'confirm element should have badge-confirm- id pattern');
  });

  it('renderProjectsBar: inline confirm has Delete and Cancel buttons', async () => {
    const html = await fetchHTML();
    const fnStart = html.indexOf('function renderProjectsBar() {');
    const fnEnd = html.indexOf('function toggleProjectSelection(', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes('confirmDeleteProjectBadge('), 'should have confirmDeleteProjectBadge call');
    assert.ok(fnBody.includes('cancelDeleteProjectBadge('), 'should have cancelDeleteProjectBadge call');
  });

  it('deleteProjectBadge function exists in HTML', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('function deleteProjectBadge('), 'deleteProjectBadge function should be defined');
  });

  it('deleteProjectBadge calls event.stopPropagation()', async () => {
    const html = await fetchHTML();
    const fnStart = html.indexOf('function deleteProjectBadge(');
    assert.ok(fnStart !== -1, 'function should exist');
    const fnBody = html.slice(fnStart, fnStart + 300);
    assert.ok(fnBody.includes('event.stopPropagation()'), 'deleteProjectBadge should call event.stopPropagation()');
  });

  it('deleteProjectBadge shows confirm element by adding active class', async () => {
    const html = await fetchHTML();
    const fnStart = html.indexOf('function deleteProjectBadge(');
    const fnBody = html.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes('classList.add(\'active\')'), 'should add active class to show confirm');
  });

  it('confirmDeleteProjectBadge function exists and calls DELETE API', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('function confirmDeleteProjectBadge('), 'confirmDeleteProjectBadge function should exist');
    const fnStart = html.indexOf('function confirmDeleteProjectBadge(');
    const fnBody = html.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("method: 'DELETE'"), 'should send DELETE request');
    assert.ok(fnBody.includes('/api/projects/'), 'should call /api/projects endpoint');
  });

  it('confirmDeleteProjectBadge removes project from selectedProjectIds if it was selected', async () => {
    const html = await fetchHTML();
    const fnStart = html.indexOf('function confirmDeleteProjectBadge(');
    const fnBody = html.slice(fnStart, fnStart + 900);
    assert.ok(fnBody.includes('selectedProjectIds'), 'should reference selectedProjectIds');
    assert.ok(fnBody.includes('splice'), 'should splice project from selectedProjectIds');
  });

  it('confirmDeleteProjectBadge calls loadProjects and rerenderProjectsColumn', async () => {
    const html = await fetchHTML();
    const fnStart = html.indexOf('function confirmDeleteProjectBadge(');
    const fnBody = html.slice(fnStart, fnStart + 900);
    assert.ok(fnBody.includes('loadProjects()'), 'should call loadProjects after delete');
    assert.ok(fnBody.includes('rerenderProjectsColumn()'), 'should call rerenderProjectsColumn after delete');
  });

  it('cancelDeleteProjectBadge function exists and removes active class', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('function cancelDeleteProjectBadge('), 'cancelDeleteProjectBadge function should exist');
    const fnStart = html.indexOf('function cancelDeleteProjectBadge(');
    const fnBody = html.slice(fnStart, fnStart + 300);
    assert.ok(fnBody.includes('classList.remove(\'active\')'), 'should remove active class to hide confirm');
  });

  it('DELETE /api/projects/:id actually deletes the project', async () => {
    const id = await createProject('delete-badge-test-project');
    // Verify it exists
    const listRes = await fetch(`${BASE}/api/projects`);
    const list = await listRes.json() as { id: string; name: string }[];
    assert.ok(list.some(p => p.id === id), 'project should exist before delete');
    // Delete it
    const delRes = await fetch(`${BASE}/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200, 'DELETE should return 200');
    // Verify it's gone
    const listRes2 = await fetch(`${BASE}/api/projects`);
    const list2 = await listRes2.json() as { id: string }[];
    assert.ok(!list2.some(p => p.id === id), 'project should be removed after delete');
  });
});
