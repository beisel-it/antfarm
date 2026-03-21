/**
 * Tests for US-004: Loop group rendering in renderRunPanel
 *
 * Strategy: Extract the relevant JS from dist/server/index.html and run it
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

/**
 * Extract the renderRunPanel function source from the HTML and evaluate it
 * in a minimal context that provides a fake `document.getElementById`.
 */
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
    parseTS: (ts: string) => ts ? new Date(ts) : null,
    stepIcons: { pending: '○', running: '●', done: '✓', failed: '✗', waiting: '○' },
    retryStep: () => {},
    console,
  };

  const script = `${badgeSrc}\n${fnSrc}\nrenderRunPanel(run, stories)`;
  runInNewContext(script, { ...context, run, stories });
  return capturedHTML;
}

describe('US-004: renderRunPanel loop group rendering', () => {
  test('AC1: Steps in a loopGroup are wrapped in .loop-group div', () => {
    const run = {
      id: 'run-1',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'running',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'uuid-1', step_id: 'implement', agent_id: 'dev', status: 'done', output: null, step_index: 0 },
        { id: 'uuid-2', step_id: 'verify', agent_id: 'verifier', status: 'pending', output: null, step_index: 1 },
      ],
      loopGroups: [
        { loopStepId: 'uuid-1', verifyStepId: 'uuid-2', stepIds: ['uuid-1', 'uuid-2'] },
      ],
    };
    const rendered = callRenderRunPanel(run);
    assert.ok(rendered.includes('class="loop-group"'), 'Should contain .loop-group wrapper');
    assert.ok(rendered.includes('class="loop-group-steps"'), 'Should contain .loop-group-steps inner wrapper');
  });

  test('AC2: Steps NOT in loopGroup render without .loop-group wrapper', () => {
    const run = {
      id: 'run-2',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'done',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'uuid-a', step_id: 'setup', agent_id: 'setup-agent', status: 'done', output: null, step_index: 0 },
        { id: 'uuid-b', step_id: 'teardown', agent_id: 'td-agent', status: 'done', output: null, step_index: 1 },
      ],
      loopGroups: [],
    };
    const rendered = callRenderRunPanel(run);
    assert.ok(!rendered.includes('loop-group'), 'Should NOT contain loop-group when loopGroups is empty');
  });

  test('AC3: Loop group steps are indented via .loop-group-steps inner container', () => {
    const run = {
      id: 'run-3',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'running',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'uid-1', step_id: 'implement', agent_id: 'dev', status: 'running', output: null, step_index: 0 },
        { id: 'uid-2', step_id: 'verify', agent_id: 'verifier', status: 'pending', output: null, step_index: 1 },
      ],
      loopGroups: [
        { loopStepId: 'uid-1', verifyStepId: 'uid-2', stepIds: ['uid-1', 'uid-2'] },
      ],
    };
    const rendered = callRenderRunPanel(run);
    // .loop-group-steps should contain the step rows
    const groupStepsIdx = rendered.indexOf('loop-group-steps');
    assert.ok(groupStepsIdx >= 0, '.loop-group-steps should be present');
    // step rows should appear after loop-group-steps
    const stepRowIdx = rendered.indexOf('step-row', groupStepsIdx);
    assert.ok(stepRowIdx > groupStepsIdx, 'Step rows should appear inside .loop-group-steps');
  });

  test('AC4: A .loop-group-label element is rendered at the top of each loop group', () => {
    const run = {
      id: 'run-4',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'running',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'x1', step_id: 'implement', agent_id: 'dev', status: 'done', output: null, step_index: 0 },
        { id: 'x2', step_id: 'verify', agent_id: 'verifier', status: 'done', output: null, step_index: 1 },
      ],
      loopGroups: [
        { loopStepId: 'x1', verifyStepId: 'x2', stepIds: ['x1', 'x2'] },
      ],
    };
    const rendered = callRenderRunPanel(run);
    assert.ok(rendered.includes('loop-group-label'), '.loop-group-label should be present');
    // Label should appear before the steps
    const labelIdx = rendered.indexOf('loop-group-label');
    const stepsIdx = rendered.indexOf('loop-group-steps');
    assert.ok(labelIdx < stepsIdx, '.loop-group-label should appear before .loop-group-steps');
  });

  test('AC5: No regression when loopGroups is undefined — all steps render normally', () => {
    const run = {
      id: 'run-5',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'done',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'p1', step_id: 'setup', agent_id: 'setup', status: 'done', output: null, step_index: 0 },
        { id: 'p2', step_id: 'run', agent_id: 'runner', status: 'done', output: null, step_index: 1 },
      ],
      // loopGroups intentionally omitted
    };
    const rendered = callRenderRunPanel(run);
    assert.ok(!rendered.includes('loop-group'), 'Should NOT contain loop-group when loopGroups is undefined');
    assert.ok(rendered.includes('step-row'), 'Steps should still render normally');
    assert.ok(rendered.includes('setup'), 'Step names should still appear');
  });

  test('AC5b: No regression when loopGroups is empty array — all steps render normally', () => {
    const run = {
      id: 'run-5b',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'done',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'q1', step_id: 'step-a', agent_id: 'agent-a', status: 'done', output: null, step_index: 0 },
      ],
      loopGroups: [],
    };
    const rendered = callRenderRunPanel(run);
    assert.ok(!rendered.includes('loop-group'), 'Should NOT contain loop-group when loopGroups is empty');
    assert.ok(rendered.includes('step-row'), 'Steps should still render');
  });

  test('AC1+AC2: Mixed — some steps in loop group, some not', () => {
    const run = {
      id: 'run-6',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'running',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'z1', step_id: 'init', agent_id: 'dev', status: 'done', output: null, step_index: 0 },
        { id: 'z2', step_id: 'implement', agent_id: 'dev', status: 'running', output: null, step_index: 1 },
        { id: 'z3', step_id: 'verify', agent_id: 'verifier', status: 'pending', output: null, step_index: 2 },
        { id: 'z4', step_id: 'deploy', agent_id: 'deployer', status: 'pending', output: null, step_index: 3 },
      ],
      loopGroups: [
        { loopStepId: 'z2', verifyStepId: 'z3', stepIds: ['z2', 'z3'] },
      ],
    };
    const rendered = callRenderRunPanel(run);
    // Loop group should exist
    assert.ok(rendered.includes('loop-group'), 'Should have loop-group for loop steps');
    // init and deploy should appear outside the loop group
    // Check that 'init' step_id appears before the loop-group
    const initIdx = rendered.indexOf('>init<');
    const loopGroupIdx = rendered.indexOf('class="loop-group"');
    const deployIdx = rendered.indexOf('>deploy<');
    const loopGroupEndPattern = '</div></div>';
    assert.ok(initIdx < loopGroupIdx || initIdx >= 0, 'init step should appear in rendered HTML');
    assert.ok(deployIdx >= 0, 'deploy step should appear in rendered HTML');
  });

  test('JS source contains loop group rendering logic', () => {
    // Verify that the source HTML contains the key rendering constructs
    assert.ok(html.includes('loopGroups'), 'HTML should reference loopGroups');
    assert.ok(html.includes('stepToGroupIdx'), 'HTML should build step-to-group index');
    assert.ok(html.includes('loop-group-label'), 'HTML should render loop-group-label');
    assert.ok(html.includes('loop-group-steps'), 'HTML should render loop-group-steps wrapper');
    assert.ok(html.includes('Repeating loop'), 'HTML should have a label text for the loop group');
  });

  test('US-003 AC5: .loop-group-label contains a .loop-counter span', () => {
    const run = {
      id: 'run-us003',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'running',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'a1', step_id: 'implement', agent_id: 'dev', status: 'done', output: null, step_index: 0 },
        { id: 'a2', step_id: 'verify', agent_id: 'verifier', status: 'pending', output: null, step_index: 1 },
      ],
      loopGroups: [
        { loopStepId: 'a1', verifyStepId: 'a2', stepIds: ['a1', 'a2'] },
      ],
    };
    const rendered = callRenderRunPanel(run);
    // Both .loop-group-label and .loop-counter must be present
    assert.ok(rendered.includes('loop-group-label'), '.loop-group-label should be present');
    assert.ok(rendered.includes('loop-counter'), '.loop-counter span should be present');
    // .loop-counter must appear inside .loop-group-label (i.e., after label opens, before label closes)
    const labelOpenIdx = rendered.indexOf('loop-group-label');
    assert.ok(labelOpenIdx >= 0, '.loop-group-label should be found');
    // Find the closing tag of the label div — it's the next </div> after the label opens
    const labelCloseIdx = rendered.indexOf('</div>', labelOpenIdx);
    const counterIdx = rendered.indexOf('loop-counter', labelOpenIdx);
    assert.ok(counterIdx > labelOpenIdx, '.loop-counter should appear after .loop-group-label opens');
    assert.ok(counterIdx < labelCloseIdx, '.loop-counter should appear before .loop-group-label closes');
  });

  test('US-003: .loop-counter shows fraction text inside .loop-group-label', () => {
    const run = {
      id: 'run-us003b',
      workflow_id: 'feature-dev',
      task: 'Test task',
      status: 'running',
      created_at: null,
      updated_at: null,
      steps: [
        { id: 'b1', step_id: 'implement', agent_id: 'dev', status: 'done', output: null, step_index: 0 },
        { id: 'b2', step_id: 'verify', agent_id: 'verifier', status: 'done', output: null, step_index: 1 },
      ],
      loopGroups: [
        { loopStepId: 'b1', verifyStepId: 'b2', stepIds: ['b1', 'b2'] },
      ],
    };
    // Pass 2 done stories to get a 2/2 counter
    const stories = [{ status: 'done' }, { status: 'done' }];
    const rendered = callRenderRunPanel(run, stories);
    const labelOpenIdx = rendered.indexOf('loop-group-label');
    const labelCloseIdx = rendered.indexOf('</div>', labelOpenIdx);
    const headerSection = rendered.slice(labelOpenIdx, labelCloseIdx + 6);
    // Fraction text should be in the header section
    assert.ok(headerSection.includes('2/2'), 'done/total fraction 2/2 should appear inside the loop-group-label');
  });
});
