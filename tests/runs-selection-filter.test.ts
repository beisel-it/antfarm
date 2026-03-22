/**
 * US-007: Project selection filtering for runs
 * Tests that:
 * 1. fetchRunsForProjects() function exists with correct structure in HTML
 * 2. loadRuns() uses project filtering logic
 * 3. API correctly filters runs by project (integration check)
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startDashboard } from '../dist/server/dashboard.js';
import { getDb } from '../dist/db.js';
import { addProject, deleteProject } from '../dist/projects/index.js';
import { randomUUID } from 'node:crypto';

const PORT = 14760;
const BASE = `http://localhost:${PORT}`;

let server: http.Server;

const WORKFLOW_ID = 'test-wf-runs-selection-filter';
let projectAId: string;
let projectBId: string;
let runProjectA: string;
let runProjectB: string;
let runNoProject: string;

function seedRun(id: string, workflowId: string, projId: string | null) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO runs (id, run_number, workflow_id, task, status, context, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, \'{}\', ?, ?, ?)'
  ).run(id, 1, workflowId, 'test task', 'done', projId, now, now);
}

before(async () => {
  const db = getDb();

  const pa = addProject({ name: 'runs-sel-proj-A', description: '' });
  projectAId = pa.id;

  const pb = addProject({ name: 'runs-sel-proj-B', description: '' });
  projectBId = pb.id;

  db.prepare('DELETE FROM runs WHERE workflow_id = ?').run(WORKFLOW_ID);

  runProjectA = randomUUID();
  seedRun(runProjectA, WORKFLOW_ID, projectAId);

  runProjectB = randomUUID();
  seedRun(runProjectB, WORKFLOW_ID, projectBId);

  runNoProject = randomUUID();
  seedRun(runNoProject, WORKFLOW_ID, null);

  server = startDashboard(PORT);
  await new Promise<void>((resolve) => server.once('listening', resolve));
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const db = getDb();
  db.prepare('DELETE FROM runs WHERE id IN (?, ?, ?)').run(runProjectA, runProjectB, runNoProject);
  deleteProject(projectAId);
  deleteProject(projectBId);
});

async function fetchJSON(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: 'localhost', port: PORT, path, method: 'GET' },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch { resolve(null); }
        });
      }
    );
    r.on('error', reject);
    r.end();
  });
}

describe('US-007: runs selection filter — HTML structure checks', () => {
  it('fetchRunsForProjects function exists in HTML', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    assert.ok(html.includes('function fetchRunsForProjects('), 'fetchRunsForProjects function should exist');
  });

  it('fetchRunsForProjects uses /api/runs with project= param', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const idx = html.indexOf('function fetchRunsForProjects(');
    assert.ok(idx !== -1, 'function must exist');
    const snippet = html.slice(idx, idx + 600);
    assert.ok(snippet.includes('/api/runs'), 'should call /api/runs');
    assert.ok(snippet.includes('project='), 'should include project= query param');
  });

  it('fetchRunsForProjects handles single project as fast path', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const idx = html.indexOf('function fetchRunsForProjects(');
    assert.ok(idx !== -1, 'function must exist');
    const snippet = html.slice(idx, idx + 400);
    assert.ok(snippet.includes('pids.length === 1') || snippet.includes('pids.length==1'),
      'should have single-project fast path');
  });

  it('fetchRunsForProjects uses Promise.all for multiple projects', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const idx = html.indexOf('function fetchRunsForProjects(');
    assert.ok(idx !== -1, 'function must exist');
    const snippet = html.slice(idx, idx + 700);
    assert.ok(snippet.includes('Promise.all'), 'should use Promise.all for multi-project parallel fetch');
  });

  it('fetchRunsForProjects deduplicates merged runs', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const idx = html.indexOf('function fetchRunsForProjects(');
    assert.ok(idx !== -1, 'function must exist');
    const snippet = html.slice(idx, idx + 800);
    assert.ok(snippet.includes('seen'), 'should use seen Set for deduplication');
  });

  it('loadRuns uses fetchRunsForProjects when selectedProjectIds is non-empty', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const idx = html.indexOf('async function loadRuns()');
    assert.ok(idx !== -1, 'loadRuns must exist');
    const snippet = html.slice(idx, idx + 600);
    assert.ok(snippet.includes('fetchRunsForProjects'), 'loadRuns should delegate to fetchRunsForProjects');
    assert.ok(snippet.includes('selectedProjectIds'), 'loadRuns should check selectedProjectIds');
  });

  it('loadRuns falls back to unfiltered fetch when selectedProjectIds is empty', async () => {
    const res = await fetch(`${BASE}/`);
    const html = await res.text();
    const idx = html.indexOf('async function loadRuns()');
    assert.ok(idx !== -1, 'loadRuns must exist');
    const snippet = html.slice(idx, idx + 600);
    assert.ok(
      snippet.includes('selectedProjectIds.length === 0') || snippet.includes('selectedProjectIds.length==0'),
      'loadRuns should check empty selectedProjectIds for fallback'
    );
  });
});

describe('US-007: runs selection filter — API integration', () => {
  it('AC1: no project selected → all runs returned (unfiltered)', async () => {
    const all = await fetchJSON(`/api/runs?workflow=${WORKFLOW_ID}`);
    const ids = all.map((r: any) => r.id);
    assert.ok(ids.includes(runProjectA), 'should include project A run');
    assert.ok(ids.includes(runProjectB), 'should include project B run');
    assert.ok(ids.includes(runNoProject), 'should include run with no project');
  });

  it('AC2: one project selected → only that project\'s runs returned', async () => {
    const filtered = await fetchJSON(`/api/runs?workflow=${WORKFLOW_ID}&project=${projectAId}`);
    const ids = filtered.map((r: any) => r.id);
    assert.ok(ids.includes(runProjectA), 'should include project A run');
    assert.ok(!ids.includes(runProjectB), 'should NOT include project B run');
    assert.ok(!ids.includes(runNoProject), 'should NOT include run with no project');
  });

  it('AC3: two projects selected → runs from both projects shown', async () => {
    // Simulate multi-select by fetching both and merging (as the client does)
    const [resA, resB] = await Promise.all([
      fetchJSON(`/api/runs?workflow=${WORKFLOW_ID}&project=${projectAId}`),
      fetchJSON(`/api/runs?workflow=${WORKFLOW_ID}&project=${projectBId}`),
    ]);
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const run of [...resA, ...resB]) {
      if (!seen.has(run.id)) { seen.add(run.id); merged.push(run); }
    }
    const ids = merged.map((r: any) => r.id);
    assert.ok(ids.includes(runProjectA), 'merged should include project A run');
    assert.ok(ids.includes(runProjectB), 'merged should include project B run');
    assert.ok(!ids.includes(runNoProject), 'merged should NOT include run with no project');
  });

  it('AC4: deselect all projects → back to unfiltered (no project param)', async () => {
    const all = await fetchJSON(`/api/runs?workflow=${WORKFLOW_ID}`);
    const ids = all.map((r: any) => r.id);
    assert.ok(ids.includes(runProjectA), 'unfiltered should include project A run');
    assert.ok(ids.includes(runProjectB), 'unfiltered should include project B run');
    assert.ok(ids.includes(runNoProject), 'unfiltered should include run with no project');
  });

  it('AC5: project filter returns run with correct project_id', async () => {
    const filtered = await fetchJSON(`/api/runs?workflow=${WORKFLOW_ID}&project=${projectAId}`);
    assert.ok(filtered.length > 0, 'should return at least one run');
    for (const run of filtered) {
      assert.equal(run.project_id, projectAId, 'all returned runs should have matching project_id');
    }
  });
});
