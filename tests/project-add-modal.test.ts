/**
 * Tests for US-010: Add New Project button and form in the projects bar
 * Port: 15090
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDashboard } from '../dist/server/dashboard.js';

const PORT = 15090;
const BASE = `http://localhost:${PORT}`;

let server: { close: () => void };

before(async () => {
  server = await startDashboard(PORT);
});

after(() => {
  server.close();
});

async function getHtml(): Promise<string> {
  const res = await fetch(`${BASE}/`);
  return res.text();
}

describe('US-010: Add New Project modal', () => {
  it('projects bar contains a + New button', async () => {
    const html = await getHtml();
    assert.ok(html.includes('project-badge-new-btn'), 'should have project-badge-new-btn class');
    assert.ok(html.includes('+ New'), 'should have + New text');
  });

  it('+ New button calls showProjectAddModal()', async () => {
    const html = await getHtml();
    assert.ok(
      html.includes("onclick='showProjectAddModal()'") || html.includes('onclick="showProjectAddModal()"'),
      'New button should call showProjectAddModal()'
    );
  });

  it('showProjectAddModal function is defined', async () => {
    const html = await getHtml();
    assert.ok(html.includes('function showProjectAddModal()'), 'showProjectAddModal should be defined');
  });

  it('closeAddProjectModal function is defined', async () => {
    const html = await getHtml();
    assert.ok(html.includes('function closeAddProjectModal()'), 'closeAddProjectModal should be defined');
  });

  it('submitAddProjectModal function is defined', async () => {
    const html = await getHtml();
    assert.ok(html.includes('function submitAddProjectModal()'), 'submitAddProjectModal should be defined');
  });

  it('add-project-modal-overlay exists in HTML', async () => {
    const html = await getHtml();
    assert.ok(html.includes('id="add-project-modal-overlay"'), 'add-project-modal-overlay should exist');
  });

  it('modal has ap-name input field', async () => {
    const html = await getHtml();
    assert.ok(html.includes('id="ap-name"'), 'ap-name input should exist');
  });

  it('modal has ap-git-path input field', async () => {
    const html = await getHtml();
    assert.ok(html.includes('id="ap-git-path"'), 'ap-git-path input should exist');
  });

  it('modal has ap-github-url input field', async () => {
    const html = await getHtml();
    assert.ok(html.includes('id="ap-github-url"'), 'ap-github-url input should exist');
  });

  it('modal has Create button calling submitAddProjectModal()', async () => {
    const html = await getHtml();
    assert.ok(html.includes('submitAddProjectModal()'), 'Create button should call submitAddProjectModal()');
  });

  it('modal has Cancel button calling closeAddProjectModal()', async () => {
    const html = await getHtml();
    assert.ok(html.includes('closeAddProjectModal()'), 'Cancel button should call closeAddProjectModal()');
  });

  it('modal shows validation error element (ap-name-error)', async () => {
    const html = await getHtml();
    assert.ok(html.includes('ap-name-error'), 'ap-name-error element should exist for validation');
  });

  it('submitAddProjectModal POSTs to /api/projects', async () => {
    const html = await getHtml();
    const fnStart = html.indexOf('function submitAddProjectModal()');
    assert.ok(fnStart !== -1, 'submitAddProjectModal should be defined');
    const fnBody = html.slice(fnStart, fnStart + 900);
    assert.ok(fnBody.includes('/api/projects'), 'should POST to /api/projects');
    assert.ok(fnBody.includes("'POST'") || fnBody.includes('"POST"'), 'should use POST method');
  });

  it('submitAddProjectModal calls loadProjects after success', async () => {
    const html = await getHtml();
    const fnStart = html.indexOf('function submitAddProjectModal()');
    const fnBody = html.slice(fnStart, fnStart + 1200);
    assert.ok(fnBody.includes('loadProjects()'), 'should call loadProjects() after success');
  });

  it('submitAddProjectModal validates empty name without submitting', async () => {
    const html = await getHtml();
    const fnStart = html.indexOf('function submitAddProjectModal()');
    const fnBody = html.slice(fnStart, fnStart + 900);
    assert.ok(fnBody.includes('ap-name-error') || fnBody.includes("if (!name)"), 'should validate empty name');
  });

  it('add-project-modal-overlay starts hidden', async () => {
    const html = await getHtml();
    const overlayIdx = html.indexOf('id="add-project-modal-overlay"');
    assert.ok(overlayIdx !== -1, 'overlay should exist');
    const overlaySnippet = html.slice(overlayIdx - 50, overlayIdx + 100);
    assert.ok(overlaySnippet.includes('display:none') || overlaySnippet.includes('display: none'), 'overlay should start hidden');
  });

  it('showProjectAddModal opens add-project-modal-overlay', async () => {
    const html = await getHtml();
    const fnStart = html.indexOf('function showProjectAddModal()');
    const fnBody = html.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes('add-project-modal-overlay'), 'showProjectAddModal should reference the overlay');
    assert.ok(fnBody.includes('flex') || fnBody.includes('display'), 'showProjectAddModal should show the overlay');
  });

  it('POST /api/projects creates a project', async () => {
    const res = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Modal Project' }),
    });
    assert.equal(res.status, 201);
    const data = await res.json() as { id: string; name: string };
    assert.equal(data.name, 'Test Modal Project');
    assert.ok(data.id, 'should have an id');
  });
});
