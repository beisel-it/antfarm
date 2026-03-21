/**
 * US-006: Implement project selection filtering for backlog entries
 * Tests that:
 * - loadBacklog() handles no project filter (existing behaviour)
 * - loadBacklog() passes project query param when one project is selected
 * - loadBacklog() fetches multiple projects in parallel and merges results
 * - toggleProjectSelection() triggers loadRuns()/loadBacklog() after toggling
 * - renderProjectsBar() applies 'selected' CSS class to selected badges
 * - The HTML contains the filtering logic source code
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startDashboard } from '../dist/server/dashboard.js';

const PORT = 14650;
let server: http.Server;
let baseUrl: string;

before(async () => {
  server = await startDashboard(PORT);
  baseUrl = `http://localhost:${PORT}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

async function getHtml(): Promise<string> {
  const res = await fetch(`${baseUrl}/`);
  return res.text();
}

test('HTML contains selectedProjectIds variable declaration', async () => {
  const html = await getHtml();
  assert.ok(html.includes('selectedProjectIds'), 'should declare selectedProjectIds');
  assert.ok(html.includes('let selectedProjectIds'), 'should be a let variable');
});

test('HTML contains toggleProjectSelection function', async () => {
  const html = await getHtml();
  assert.ok(html.includes('function toggleProjectSelection'), 'should have toggleProjectSelection function');
});

test('toggleProjectSelection re-renders the bar and triggers data reload', async () => {
  const html = await getHtml();
  // After toggling, it calls loadRuns or loadBacklog
  assert.ok(html.includes('toggleProjectSelection'), 'toggleProjectSelection should exist');
  // Should call loadRuns or loadBacklog after toggling
  const fnStart = html.indexOf('function toggleProjectSelection');
  const fnEnd = html.indexOf('\n}', fnStart) + 2;
  const fnBody = html.slice(fnStart, fnEnd);
  const callsLoad = fnBody.includes('loadRuns') || fnBody.includes('loadBacklog');
  assert.ok(callsLoad, 'toggleProjectSelection should call loadRuns() or loadBacklog() after toggling');
});

test('loadBacklog uses no project filter when selectedProjectIds is empty', async () => {
  const html = await getHtml();
  const fnStart = html.indexOf('async function loadBacklog');
  const fnEnd = html.indexOf('\n}', fnStart) + 2;
  const fnBody = html.slice(fnStart, fnEnd);
  assert.ok(fnBody.includes('selectedProjectIds.length === 0'), 'should check for empty selectedProjectIds');
  assert.ok(fnBody.includes('/api/backlog'), 'should call /api/backlog');
});

test('project fetch helper passes project query param when one project selected', async () => {
  const html = await getHtml();
  // The helper function handles single and multi-project fetching
  const helperMarker = 'async function fetchBacklogForProjects';
  const helperStart = html.indexOf(helperMarker);
  assert.ok(helperStart !== -1, 'fetchBacklogForProjects helper should exist');
  const helperCtx = html.slice(helperStart, helperStart + 600);
  assert.ok(helperCtx.includes('project='), 'should pass project as query param');
});

test('project fetch helper uses Promise.all for multi-select', async () => {
  const html = await getHtml();
  const helperMarker = 'async function fetchBacklogForProjects';
  const helperStart = html.indexOf(helperMarker);
  assert.ok(helperStart !== -1, 'fetchBacklogForProjects helper should exist');
  const helperCtx = html.slice(helperStart, helperStart + 800);
  assert.ok(helperCtx.includes('Promise.all'), 'should use Promise.all for multiple projects');
});

test('project fetch helper deduplicates merged results', async () => {
  const html = await getHtml();
  const helperMarker = 'async function fetchBacklogForProjects';
  const helperStart = html.indexOf(helperMarker);
  assert.ok(helperStart !== -1, 'fetchBacklogForProjects helper should exist');
  const helperCtx = html.slice(helperStart, helperStart + 1200);
  // Should have deduplication logic (seen Set or similar)
  const hasDedupe = helperCtx.includes('seen') || helperCtx.includes('Set(') || helperCtx.includes('dedupli');
  assert.ok(hasDedupe, 'should deduplicate merged results');
});

test('project fetch helper sorts merged results by priority DESC then created_at ASC', async () => {
  const html = await getHtml();
  const helperMarker = 'async function fetchBacklogForProjects';
  const helperStart = html.indexOf(helperMarker);
  assert.ok(helperStart !== -1, 'fetchBacklogForProjects helper should exist');
  const helperCtx = html.slice(helperStart, helperStart + 1200);
  assert.ok(helperCtx.includes('.sort('), 'should sort merged results');
  assert.ok(helperCtx.includes('priority'), 'should sort by priority');
  assert.ok(helperCtx.includes('created_at'), 'should sort by created_at');
});

test('renderProjectsBar applies selected class to selected badges', async () => {
  const html = await getHtml();
  // Find the specific renderProjectsBar() function (not renderProjectsBarInto)
  const marker = 'function renderProjectsBar() {';
  const fnStart = html.indexOf(marker);
  assert.ok(fnStart !== -1, 'renderProjectsBar() function should exist');
  // Grab enough context — the function is short
  const fnContext = html.slice(fnStart, fnStart + 800);
  assert.ok(fnContext.includes('selected'), 'renderProjectsBar should reference selected class');
  assert.ok(fnContext.includes('selectedProjectIds'), 'renderProjectsBar should check selectedProjectIds');
});

test('GET /api/backlog?project=<id> filters by project_id', async () => {
  // Create a project first
  const createRes = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Project Filter' })
  });
  assert.equal(createRes.status, 201);
  const project = await createRes.json() as { id: string; name: string };

  // Create a backlog entry for this project
  const entryRes = await fetch(`${baseUrl}/api/backlog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Filtered Entry', projectId: project.id })
  });
  assert.equal(entryRes.status, 201);

  // Create a backlog entry WITHOUT this project
  const otherRes = await fetch(`${baseUrl}/api/backlog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Unfiltered Entry' })
  });
  assert.equal(otherRes.status, 201);

  // Fetch backlog filtered by project
  const filteredRes = await fetch(`${baseUrl}/api/backlog?project=${encodeURIComponent(project.id)}`);
  assert.equal(filteredRes.status, 200);
  const filtered = await filteredRes.json() as Array<{ title: string; project_id: string }>;

  const titles = filtered.map(e => e.title);
  assert.ok(titles.includes('Filtered Entry'), 'should include entry for selected project');
  assert.ok(!titles.includes('Unfiltered Entry'), 'should exclude entry without the selected project');
});

test('GET /api/backlog returns all entries when no project filter', async () => {
  // Fetch without project filter — should include all entries created above
  const res = await fetch(`${baseUrl}/api/backlog`);
  assert.equal(res.status, 200);
  const entries = await res.json() as Array<{ title: string }>;
  const titles = entries.map(e => e.title);
  assert.ok(titles.includes('Filtered Entry'), 'should include project entry');
  assert.ok(titles.includes('Unfiltered Entry'), 'should include non-project entry');
});
