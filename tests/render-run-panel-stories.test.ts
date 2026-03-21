/**
 * Tests for US-006 (updated for US-002): Pass stories data into renderRunPanel for counter progress
 *
 * US-002 moved the loop counter from a circular conic-gradient badge between steps
 * to an inline .loop-counter span inside the .loop-group-label header.
 *
 * Strategy: Extract renderLoopBadge + renderRunPanel JS from dist/server/index.html
 * and run via node:vm. Verify that renderRunPanel accepts stories as 2nd arg
 * and uses them for the header counter (not window._lastStories).
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

function callRenderRunPanel(run: object, stories: object[] = [], windowStories: object[] = []): string {
  const badgeSrc = extractFn(html, 'renderLoopBadge');
  const panelSrc = extractFn(html, 'renderRunPanel');

  let capturedHTML = '';
  const fakeEl = {
    get innerHTML() { return capturedHTML; },
    set innerHTML(v: string) { capturedHTML = v; },
  };

  const context = {
    window: { _lastStories: windowStories },
    document: { getElementById: (_id: string) => fakeEl },
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

describe('US-006: renderRunPanel accepts stories as second argument (updated for US-002 counter-in-header)', () => {
  test('AC1: renderRunPanel signature accepts stories default []', () => {
    // Should not throw when called without second arg
    const result = callRenderRunPanel(makeLoopRun());
    assert.ok(typeof result === 'string', 'should return HTML string');
    assert.ok(result.includes('loop-counter'), 'counter should render in header with default empty stories');
    assert.ok(result.includes('0/0'), 'counter should show 0/0 with no stories');
  });

  test('AC2: Counter fraction is computed from stories passed to renderRunPanel', () => {
    const stories = [
      { status: 'done' },
      { status: 'done' },
      { status: 'pending' },
    ];
    // window._lastStories is empty — counter must use passed stories
    const result = callRenderRunPanel(makeLoopRun(), stories, []);
    assert.ok(result.includes('2/3'), 'counter should show 2/3 from passed stories');
    assert.ok(result.includes('loop-counter'), '.loop-counter element should exist');
  });

  test('AC2: Counter ignores window._lastStories and uses passed stories', () => {
    const passedStories = [{ status: 'done' }, { status: 'done' }];
    const windowStories = [{ status: 'pending' }, { status: 'pending' }, { status: 'pending' }];
    // If using window._lastStories: would show 0/3; if using passed: 2/2
    const result = callRenderRunPanel(makeLoopRun(), passedStories, windowStories);
    assert.ok(result.includes('2/2'), 'counter should use passed stories (2/2), not window (0/3)');
    assert.ok(!result.includes('0/3'), 'counter should NOT show 0/3 (window._lastStories)');
  });

  test('AC3: Stories panel (list of US-XXX items) still rendered correctly', () => {
    // The stories-panel div is injected via loadStories, not renderRunPanel
    // renderRunPanel should still include #stories-panel placeholder
    const result = callRenderRunPanel(makeLoopRun(), []);
    assert.ok(result.includes('id="stories-panel"'), '#stories-panel placeholder should exist in rendered HTML');
  });

  test('AC5: When stories is empty, counter shows 0/0 and no crash', () => {
    let threw = false;
    let result = '';
    try {
      result = callRenderRunPanel(makeLoopRun(), []);
    } catch (e) {
      threw = true;
    }
    assert.ok(!threw, 'should not throw with empty stories');
    assert.ok(result.includes('0/0'), 'counter should show 0/0');
  });

  test('AC6: renderRunPanel with stories arg renders correct counter fraction', () => {
    const stories = Array.from({ length: 5 }, (_, i) => ({ status: i < 3 ? 'done' : 'pending' }));
    const result = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(result.includes('3/5'), 'counter should show 3/5');
  });

  test('AC6: renderRunPanel with all stories done shows N/N', () => {
    const stories = [{ status: 'done' }, { status: 'done' }, { status: 'done' }];
    const result = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(result.includes('3/3'), 'counter should show 3/3 when all done');
    assert.ok(result.includes('Loop progress: 3/3'), 'counter title should show Loop progress: 3/3');
  });

  test('Non-loop run renders correctly with stories arg', () => {
    const run = {
      id: 'run-single',
      workflow_id: 'feature-dev',
      task: 'Test',
      status: 'done',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'uuid-a', step_id: 'build', agent_id: 'ci', status: 'done', output: null, step_index: 0 },
      ],
      loopGroups: [],
    };
    const stories = [{ status: 'done' }];
    const result = callRenderRunPanel(run, stories);
    assert.ok(!result.includes('loop-counter'), 'no counter for non-loop run');
    assert.ok(!result.includes('loop-group'), 'no loop-group for non-loop run');
    assert.ok(result.includes('build'), 'build step should still render');
  });
});
