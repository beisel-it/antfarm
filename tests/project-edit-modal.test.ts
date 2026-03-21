/**
 * US-008: Tests for inline project edit modal
 * Port: 14870
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDashboard } from '../dist/server/dashboard.js';

const PORT = 14870;
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

async function createProject(name: string, gitPath?: string, githubUrl?: string) {
  const res = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, git_repo_path: gitPath, github_repo_url: githubUrl })
  });
  return res.json() as Promise<{ id: string; name: string; git_repo_path?: string; github_repo_url?: string }>;
}

describe('US-008: Project Edit Modal', () => {
  it('should have an edit-project-modal-overlay element in HTML', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('edit-project-modal-overlay'), 'Modal overlay id should be present');
  });

  it('should have ep-name, ep-git-path, ep-github-url input fields', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('ep-name'), 'ep-name input should be present');
    assert.ok(html.includes('ep-git-path'), 'ep-git-path input should be present');
    assert.ok(html.includes('ep-github-url'), 'ep-github-url input should be present');
  });

  it('should have editProject function in HTML', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('function editProject('), 'editProject function should be present');
  });

  it('should have closeEditProjectModal function in HTML', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('function closeEditProjectModal('), 'closeEditProjectModal function should be present');
  });

  it('should have submitEditProjectForm function in HTML', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('function submitEditProjectForm('), 'submitEditProjectForm function should be present');
  });

  it('should have editingProjectId variable declared', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('editingProjectId'), 'editingProjectId variable should be present');
  });

  it('should call PATCH /api/projects/:id in submitEditProjectForm', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes("method: 'PATCH'"), 'PATCH method should be used in submitEditProjectForm');
    assert.ok(html.includes("'/api/projects/'"), 'should call /api/projects/ endpoint');
  });

  it('should call loadProjects() and rerenderProjectsColumn() after successful edit', async () => {
    const html = await fetchHTML();
    const idx = html.indexOf('function submitEditProjectForm(');
    assert.ok(idx !== -1, 'submitEditProjectForm should exist');
    const fnBody = html.slice(idx, idx + 900);
    assert.ok(fnBody.includes('loadProjects'), 'should call loadProjects() after edit');
    assert.ok(fnBody.includes('rerenderProjectsColumn'), 'should call rerenderProjectsColumn() after edit');
  });

  it('should call closeEditProjectModal() after successful edit', async () => {
    const html = await fetchHTML();
    const idx = html.indexOf('function submitEditProjectForm(');
    assert.ok(idx !== -1, 'submitEditProjectForm should exist');
    const fnBody = html.slice(idx, idx + 900);
    assert.ok(fnBody.includes('closeEditProjectModal'), 'should call closeEditProjectModal() after successful edit');
  });

  it('should have edit button calling editProject in renderProjectsBar', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes("editProject('"), 'edit button should call editProject with project id');
  });

  it('PATCH /api/projects/:id should update project name', async () => {
    const created = await createProject('EditTest Project');
    const res = await fetch(`${BASE}/api/projects/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' })
    });
    assert.equal(res.status, 200);
    const updated = await res.json() as { id: string; name: string };
    assert.equal(updated.name, 'Updated Name');
  });

  it('PATCH /api/projects/:id should update git_repo_path and github_repo_url', async () => {
    const created = await createProject('GitPathTest');
    const res = await fetch(`${BASE}/api/projects/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'GitPathTest',
        git_repo_path: '/repos/test',
        github_repo_url: 'https://github.com/test/repo'
      })
    });
    assert.equal(res.status, 200);
    const updated = await res.json() as { git_repo_path: string; github_repo_url: string };
    assert.equal(updated.git_repo_path, '/repos/test');
    assert.equal(updated.github_repo_url, 'https://github.com/test/repo');
  });

  it('PATCH /api/projects/:id with unknown id should return 404', async () => {
    const res = await fetch(`${BASE}/api/projects/nonexistent-id-us008`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' })
    });
    assert.equal(res.status, 404);
  });

  it('edit modal should have a Cancel button calling closeEditProjectModal', async () => {
    const html = await fetchHTML();
    assert.ok(html.includes('closeEditProjectModal()'), 'Cancel button should call closeEditProjectModal');
  });

  it('edit button on badge should call event.stopPropagation()', async () => {
    const html = await fetchHTML();
    // Find the edit button area in renderProjectsBar
    const idx = html.indexOf('function renderProjectsBar() {');
    assert.ok(idx !== -1, 'renderProjectsBar should exist');
    const fnBody = html.slice(idx, idx + 800);
    assert.ok(fnBody.includes('event.stopPropagation()'), 'edit button should stop propagation');
    assert.ok(fnBody.includes('editProject('), 'edit button should call editProject');
  });
});
