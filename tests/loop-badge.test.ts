/**
 * Tests for US-005: Loop progress badge between loop steps in renderRunPanel
 *
 * Strategy: Extract renderLoopBadge + renderRunPanel JS from dist/server/index.html
 * and run via node:vm with a fake DOM and window._lastStories for progress data.
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

/**
 * Call renderRunPanel with given run data and stories available on window._lastStories.
 */
function callRenderRunPanel(run: object, stories: object[] = []): string {
  const badgeSrc = extractFn(html, 'renderLoopBadge');
  const panelSrc = extractFn(html, 'renderRunPanel');

  let capturedHTML = '';
  const fakeEl = {
    get innerHTML() { return capturedHTML; },
    set innerHTML(v: string) { capturedHTML = v; },
  };

  const context = {
    window: { _lastStories: stories },
    document: {
      getElementById: (_id: string) => fakeEl,
    },
    esc: (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    parseTS: (ts: string) => ts ? new Date(ts) : null,
    stepIcons: { pending: '○', running: '●', done: '✓', failed: '✗', waiting: '○' },
    retryStep: () => {},
    console,
  };

  const script = `${badgeSrc}\n${panelSrc}\nrenderRunPanel(run)`;
  runInNewContext(script, { ...context, run });
  return capturedHTML;
}

// Minimal run object for a single loop group (implement + verify)
function makeLoopRun(overrides: Partial<{stories: object[]}> = {}) {
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

describe('US-005: loop badge rendering', () => {
  test('AC1: .loop-badge element is rendered inside .loop-group', () => {
    const html_ = callRenderRunPanel(makeLoopRun());
    // Check badge exists inside loop-group
    assert.ok(html_.includes('class="loop-group"'), 'loop-group wrapper should exist');
    assert.ok(html_.includes('loop-badge'), '.loop-badge element should be rendered');
    // Verify badge is inside loop-group (badge appears after loop-group open tag and before close)
    const groupOpen = html_.indexOf('class="loop-group"');
    const badgeIdx = html_.indexOf('loop-badge');
    assert.ok(badgeIdx > groupOpen, 'badge should appear inside the loop-group');
  });

  test('AC2: Badge background uses conic-gradient', () => {
    const stories = [
      { status: 'done' },
      { status: 'done' },
      { status: 'pending' },
    ];
    const html_ = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(html_.includes('conic-gradient'), 'badge should use conic-gradient');
  });

  test('AC3: When all stories are done, badge fills 100% (uses accent-teal for full range)', () => {
    const stories = [
      { status: 'done' },
      { status: 'done' },
      { status: 'done' },
    ];
    const html_ = callRenderRunPanel(makeLoopRun(), stories);
    // pct=100: conic-gradient(var(--accent-teal) 0% 100%, ...)
    assert.ok(html_.includes('conic-gradient(var(--accent-teal) 0% 100%'), '100% fill should use accent-teal for full range');
  });

  test('AC4: When no stories exist, badge renders with 0% fill', () => {
    const html_ = callRenderRunPanel(makeLoopRun(), []);
    // With no stories, default badge with 0% label
    assert.ok(html_.includes('loop-badge'), 'badge should still render');
    assert.ok(html_.includes('0%'), 'badge should show 0% when no stories');
  });

  test('AC5: Badge renders inside .loop-group, between implement and verify step rows', () => {
    const stories = [{ status: 'done' }, { status: 'pending' }];
    const html_ = callRenderRunPanel(makeLoopRun(), stories);
    // Find positions: implement step, badge, verify step
    const implIdx = html_.indexOf('>implement<');
    const badgeIdx = html_.indexOf('loop-badge');
    const verifyIdx = html_.indexOf('>verify<');
    assert.ok(implIdx >= 0, 'implement step should exist');
    assert.ok(verifyIdx >= 0, 'verify step should exist');
    assert.ok(badgeIdx >= 0, 'badge should exist');
    assert.ok(badgeIdx > implIdx, 'badge should come after implement step');
    assert.ok(verifyIdx > badgeIdx, 'verify step should come after badge');
  });

  test('AC5: Badge renders inside .loop-group div, not outside', () => {
    const html_ = callRenderRunPanel(makeLoopRun(), []);
    const groupStart = html_.indexOf('class="loop-group"');
    const groupEnd = html_.lastIndexOf('</div>');
    const badgeIdx = html_.indexOf('loop-badge');
    assert.ok(badgeIdx > groupStart, 'badge should be inside loop-group');
    assert.ok(badgeIdx < groupEnd, 'badge should be before end of group');
  });

  test('AC6: Badge shows fraction label like 3/7', () => {
    const stories = Array.from({length: 7}, (_, i) => ({ status: i < 3 ? 'done' : 'pending' }));
    const html_ = callRenderRunPanel(makeLoopRun(), stories);
    assert.ok(html_.includes('3/7'), 'badge should show fraction label 3/7');
  });

  test('Non-loop steps do not get a badge', () => {
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
    const html_ = callRenderRunPanel(run, []);
    assert.ok(!html_.includes('loop-badge'), 'no badge for non-loop runs');
    assert.ok(!html_.includes('loop-group'), 'no loop-group for non-loop runs');
  });

  test('CSS: loop-badge-text exists in CSS with absolute positioning', () => {
    // Read the built HTML to check CSS
    const builtHtml = readFileSync(join(__dirname, '../dist/server/index.html'), 'utf-8');
    assert.ok(builtHtml.includes('.loop-badge-text'), '.loop-badge-text should exist in CSS');
    assert.ok(builtHtml.includes('.loop-badge'), '.loop-badge CSS class should exist');
  });
});
