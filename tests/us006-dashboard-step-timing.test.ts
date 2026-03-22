/**
 * US-006: Display claimed_at and finished_at times in the dashboard step rows
 *
 * Tests that renderStepRow (inside renderRunPanel) shows timing info when
 * claimed_at / finished_at are set on a step.
 *
 * Strategy: Extract JS from dist/server/index.html and run it in a vm context,
 * using the same approach as loop-group-render.test.ts.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '../dist/server/index.html'), 'utf-8');

function extractFn(src: string, name: string): string {
  const start = src.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} should exist in dist/server/index.html`);
  let depth = 0;
  let i = start;
  let end = -1;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
    i++;
  }
  assert.ok(end > start, `Could not find end of ${name}`);
  return src.slice(start, end);
}

function callRenderRunPanel(run: object, stories: object[] = []): string {
  const badgeSrc = extractFn(html, 'renderLoopBadge');
  const fnSrc = extractFn(html, 'renderRunPanel');

  let capturedHTML = '';
  const fakeEl = {
    get innerHTML() { return capturedHTML; },
    set innerHTML(v: string) { capturedHTML = v; },
  };

  const context = {
    window: {},
    document: {
      getElementById: (_id: string) => fakeEl,
    },
    esc: (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    parseTS: (ts: string | null) => {
      if (!ts) return null;
      if (!ts.endsWith('Z') && !ts.includes('+')) ts = ts.replace(' ', 'T') + 'Z';
      return new Date(ts);
    },
    stepIcons: { pending: '○', running: '●', done: '✓', failed: '✗', waiting: '○' },
    retryStep: () => {},
    console,
  };

  const script = `${badgeSrc}\n${fnSrc}\nrenderRunPanel(run, stories)`;
  runInNewContext(script, { ...context, run, stories });
  return capturedHTML;
}

function makeRun(steps: object[]) {
  return {
    id: 'run-us006',
    workflow_id: 'test-wf',
    task: 'Test task',
    status: 'running',
    created_at: null,
    updated_at: null,
    steps,
    loopGroups: [],
  };
}

describe('US-006: Dashboard step timing display', () => {
  test('AC1: A step with claimed_at set shows "Claimed: HH:MM" in the step row', () => {
    const run = makeRun([
      {
        id: 's1', step_id: 'implement', agent_id: 'dev', status: 'running',
        output: null, step_index: 0,
        claimed_at: '2026-03-22 10:30:00',
        finished_at: null,
      },
    ]);
    const rendered = callRenderRunPanel(run);
    assert.ok(rendered.includes('Claimed:'), 'Should show "Claimed:" label');
    // Time should be present (HH:MM format — exact value depends on locale, just check "Claimed:" is there)
    const claimedIdx = rendered.indexOf('Claimed:');
    assert.ok(claimedIdx >= 0, 'Claimed: should appear in rendered HTML');
  });

  test('AC2: A step with finished_at set shows "Finished: HH:MM" in the step row', () => {
    const run = makeRun([
      {
        id: 's2', step_id: 'implement', agent_id: 'dev', status: 'done',
        output: null, step_index: 0,
        claimed_at: '2026-03-22 10:30:00',
        finished_at: '2026-03-22 10:45:00',
      },
    ]);
    const rendered = callRenderRunPanel(run);
    assert.ok(rendered.includes('Finished:'), 'Should show "Finished:" label');
  });

  test('AC3: A step with both null shows no timing text', () => {
    const run = makeRun([
      {
        id: 's3', step_id: 'implement', agent_id: 'dev', status: 'pending',
        output: null, step_index: 0,
        claimed_at: null,
        finished_at: null,
      },
    ]);
    const rendered = callRenderRunPanel(run);
    assert.ok(!rendered.includes('Claimed:'), 'Should NOT show "Claimed:" when claimed_at is null');
    assert.ok(!rendered.includes('Finished:'), 'Should NOT show "Finished:" when finished_at is null');
  });

  test('AC4: A running step shows claimed time but no finished time', () => {
    const run = makeRun([
      {
        id: 's4', step_id: 'implement', agent_id: 'dev', status: 'running',
        output: null, step_index: 0,
        claimed_at: '2026-03-22 11:00:00',
        finished_at: null,
      },
    ]);
    const rendered = callRenderRunPanel(run);
    assert.ok(rendered.includes('Claimed:'), 'Running step should show "Claimed:"');
    assert.ok(!rendered.includes('Finished:'), 'Running step should NOT show "Finished:" when finished_at is null');
  });

  test('AC5: Time format is consistent — Geist Mono monospace font applied', () => {
    const run = makeRun([
      {
        id: 's5', step_id: 'implement', agent_id: 'dev', status: 'done',
        output: null, step_index: 0,
        claimed_at: '2026-03-22 09:00:00',
        finished_at: '2026-03-22 09:15:00',
      },
    ]);
    const rendered = callRenderRunPanel(run);
    // Should use Geist Mono (same as .medic-check-time style)
    assert.ok(rendered.includes('Geist Mono'), 'Timing line should use Geist Mono monospace font');
    assert.ok(rendered.includes('text-secondary'), 'Timing line should use muted text-secondary color');
  });

  test('AC3b: A step with missing timing fields (undefined) shows no timing text', () => {
    const run = makeRun([
      {
        id: 's6', step_id: 'setup', agent_id: 'setup-agent', status: 'pending',
        output: null, step_index: 0,
        // No claimed_at or finished_at properties at all
      },
    ]);
    const rendered = callRenderRunPanel(run);
    assert.ok(!rendered.includes('Claimed:'), 'Should NOT show "Claimed:" when claimed_at is missing');
    assert.ok(!rendered.includes('Finished:'), 'Should NOT show "Finished:" when finished_at is missing');
  });

  test('Both times show when step is fully completed', () => {
    const run = makeRun([
      {
        id: 's7', step_id: 'implement', agent_id: 'dev', status: 'done',
        output: null, step_index: 0,
        claimed_at: '2026-03-22 14:00:00',
        finished_at: '2026-03-22 14:30:00',
      },
    ]);
    const rendered = callRenderRunPanel(run);
    assert.ok(rendered.includes('Claimed:'), 'Completed step should show Claimed:');
    assert.ok(rendered.includes('Finished:'), 'Completed step should show Finished:');
    // Verify they appear on the same line (both within the timing div)
    const claimedIdx = rendered.indexOf('Claimed:');
    const finishedIdx = rendered.indexOf('Finished:');
    assert.ok(claimedIdx >= 0 && finishedIdx >= 0, 'Both labels should be present');
  });

  test('Source HTML contains claimed_at and finished_at timing references', () => {
    assert.ok(html.includes('claimed_at'), 'HTML should reference claimed_at');
    assert.ok(html.includes('finished_at'), 'HTML should reference finished_at');
    assert.ok(html.includes('Claimed:'), 'HTML should contain "Claimed:" text');
    assert.ok(html.includes('Finished:'), 'HTML should contain "Finished:" text');
  });
});
