/**
 * Tests for US-002: Loop counter in the Repeating Loop header
 *
 * The loop counter (done/total fraction) is now rendered inside the
 * .loop-group-label header, not between step rows as a circular badge.
 *
 * Strategy: Extract renderRunPanel JS from dist/server/index.html and run it
 * in a minimal DOM-like environment using vm to verify the rendered HTML.
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
  assert.ok(start >= 0, `${name} should exist in HTML`);
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
  const panelSrc = extractFn(html, 'renderRunPanel');

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
    parseTS: (ts: string) => ts ? new Date(ts) : null,
    stepIcons: { pending: '○', running: '●', done: '✓', failed: '✗', waiting: '○' },
    retryStep: () => {},
    console,
  };

  const script = `${badgeSrc}\n${panelSrc}\nrenderRunPanel(run, stories)`;
  runInNewContext(script, { ...context, run, stories });
  return capturedHTML;
}

function makeLoopRun() {
  return {
    id: 'run-loop',
    workflow_id: 'feature-dev',
    task: 'Test task',
    status: 'running',
    created_at: null,
    updated_at: null,
    steps: [
      { id: 'uuid-impl', step_id: 'implement', agent_id: 'dev', status: 'done', output: null, step_index: 0 },
      { id: 'uuid-verify', step_id: 'verify', agent_id: 'verifier', status: 'pending', output: null, step_index: 1 },
    ],
    loopGroups: [
      { loopStepId: 'uuid-impl', verifyStepId: 'uuid-verify', stepIds: ['uuid-impl', 'uuid-verify'] },
    ],
  };
}

describe('US-002: loop counter in Repeating Loop header', () => {
  test('AC1: .loop-group-label contains a .loop-counter span', () => {
    const rendered = callRenderRunPanel(makeLoopRun(), []);
    assert.ok(rendered.includes('loop-group-label'), '.loop-group-label should be present');
    assert.ok(rendered.includes('loop-counter'), '.loop-counter span should be in the header');
    // Counter should be inside the label
    const labelIdx = rendered.indexOf('loop-group-label');
    const counterIdx = rendered.indexOf('loop-counter', labelIdx);
    assert.ok(counterIdx > labelIdx, '.loop-counter should appear after loop-group-label opens');
  });

  test('AC1: loop-counter has title attribute with fraction info', () => {
    const stories = [{ status: 'done' }, { status: 'pending' }];
    const rendered = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(rendered.includes('title="Loop progress: 1/2"'), 'counter should have title with done/total fraction');
  });

  test('AC1: loop-counter shows done/total fraction text', () => {
    const stories = [{ status: 'done' }, { status: 'done' }, { status: 'pending' }];
    const rendered = callRenderRunPanel(makeLoopRun(), stories);
    // Check fraction appears in the rendered HTML
    assert.ok(rendered.includes('2/3'), 'counter should show 2/3 fraction');
  });

  test('AC2: .loop-badge-wrapper is NOT injected between loop step rows', () => {
    const stories = [{ status: 'done' }, { status: 'pending' }];
    const rendered = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(!rendered.includes('loop-badge-wrapper'), '.loop-badge-wrapper should NOT be in rendered HTML');
  });

  test('AC4: verifyStepIds set is not used — no between-step badge injection', () => {
    // The counter should be in the label only, not between implement and verify
    const stories = [{ status: 'done' }, { status: 'pending' }];
    const rendered = callRenderRunPanel(makeLoopRun(), stories);
    const implIdx = rendered.indexOf('>implement<');
    const verifyIdx = rendered.indexOf('>verify<');
    // No loop-badge-wrapper between the two step rows
    const between = rendered.slice(implIdx, verifyIdx);
    assert.ok(!between.includes('loop-badge-wrapper'), 'No badge wrapper should appear between implement and verify step rows');
  });

  test('Edge: when stories is empty, counter shows 0/0', () => {
    const rendered = callRenderRunPanel(makeLoopRun(), []);
    assert.ok(rendered.includes('0/0'), 'counter should show 0/0 when stories is empty');
    assert.ok(rendered.includes('loop-counter'), '.loop-counter should still render');
  });

  test('Edge: when all stories are done, counter shows N/N', () => {
    const stories = [{ status: 'done' }, { status: 'done' }];
    const rendered = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(rendered.includes('2/2'), 'counter should show 2/2 when all done');
  });

  test('Edge: fraction 3/7 renders correctly', () => {
    const stories = Array.from({ length: 7 }, (_, i) => ({ status: i < 3 ? 'done' : 'pending' }));
    const rendered = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(rendered.includes('3/7'), 'counter should show 3/7 fraction');
  });

  test('AC3: CSS does not contain .loop-badge, .loop-badge-wrapper, .loop-badge-text', () => {
    // Verify these old CSS classes have been removed from the built HTML
    assert.ok(!html.includes('.loop-badge-wrapper'), '.loop-badge-wrapper CSS class should be removed');
    assert.ok(!html.includes('.loop-badge-text'), '.loop-badge-text CSS class should be removed');
    // .loop-badge might still appear in JS as a reference to the function renderLoopBadge
    // but the CSS class rule should be gone
    const cssSection = html.slice(html.indexOf('<style'), html.indexOf('</style>'));
    assert.ok(!cssSection.includes('.loop-badge{'), '.loop-badge CSS rule should be removed');
  });

  test('Non-loop steps do not get a counter', () => {
    const run = {
      id: 'run-single',
      workflow_id: 'feature-dev',
      task: 'Test',
      status: 'running',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'uuid-a', step_id: 'build', agent_id: 'ci', status: 'done', output: null, step_index: 0 },
        { id: 'uuid-b', step_id: 'deploy', agent_id: 'ci', status: 'pending', output: null, step_index: 1 },
      ],
      loopGroups: [],
    };
    const rendered = callRenderRunPanel(run, []);
    assert.ok(!rendered.includes('loop-counter'), 'no loop-counter for non-loop runs');
    assert.ok(!rendered.includes('loop-group'), 'no loop-group for non-loop runs');
  });
});
