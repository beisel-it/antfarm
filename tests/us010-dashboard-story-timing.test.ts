/**
 * US-010: Display claimed_at and finished_at times in the dashboard story rows
 *
 * Tests that the stories panel in renderRunPanel shows timing info when
 * claimed_at / finished_at are set on a story.
 *
 * Strategy: Extract the story row rendering template from dist/server/index.html
 * and evaluate it in a vm context with stub functions, similar to us006.
 * The story rows are rendered inside loadStories() — we mock fetchJSON to supply
 * story data synchronously and capture innerHTML.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '../dist/server/index.html'), 'utf-8');

/** Build a renderStoryRow function from the stories.map template in the HTML */
function makeStoryRenderer(): (story: object, openRunId?: string) => string {
  // Extract the callback body from stories.map((s, i) => { ... }) inside loadStories
  const mapStart = html.indexOf('${stories.map((s, i) => {');
  assert.ok(mapStart >= 0, 'stories.map block should exist in dist/server/index.html');

  // Find the return template literal inside the map callback
  // We'll extract the full content and wrap it as a standalone function
  // Approach: find the full body from "const st = s.status" to "}).join('')}"
  const bodyStart = html.indexOf('const st = s.status || \'pending\';', mapStart);
  assert.ok(bodyStart >= 0, 'stories.map body start not found');

  // Find end of map: "}).join('')}" which marks end of stories.map
  const mapEnd = html.indexOf("}).join('')}", bodyStart);
  assert.ok(mapEnd >= 0, 'stories.map end not found');

  const body = html.slice(bodyStart, mapEnd);

  const fnSrc = `
function renderStoryRow(s, openRunId) {
  openRunId = openRunId || 'run-test';
  ${body}
}
`;
  return (story: object, openRunId = 'run-test') => {
    const result = runInNewContext(`${fnSrc}\nrenderStoryRow(s, openRunId)`, {
      s: story,
      openRunId,
      esc: (v: string) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      parseTS: (ts: string | null) => {
        if (!ts) return null;
        const normalized = (!ts.endsWith('Z') && !ts.includes('+')) ? ts.replace(' ', 'T') + 'Z' : ts;
        return new Date(normalized);
      },
      stepIcons: { pending: '○', running: '●', done: '✓', failed: '✗', waiting: '○' },
      console,
    });
    return result as string;
  };
}

function makeStory(overrides: object = {}): object {
  return {
    id: 'story-1',
    run_id: 'run-us010',
    story_id: 'US-001',
    story_index: 0,
    title: 'Test story',
    description: '',
    acceptance_criteria: '[]',
    status: 'pending',
    retry_count: 0,
    max_retries: 3,
    output: null,
    claimed_at: null,
    finished_at: null,
    created_at: '2026-03-22 10:00:00',
    updated_at: '2026-03-22 10:00:00',
    ...overrides,
  };
}

let renderStoryRow: (story: object, openRunId?: string) => string;

describe('US-010: Dashboard story timing display', () => {
  test('setup: build renderStoryRow from dist HTML', () => {
    renderStoryRow = makeStoryRenderer();
    assert.ok(typeof renderStoryRow === 'function', 'renderStoryRow should be a function');
  });

  test('AC1: A story with claimed_at set shows "Claimed: HH:MM" in the story row', () => {
    const story = makeStory({ status: 'running', claimed_at: '2026-03-22 10:30:00', finished_at: null });
    const rendered = renderStoryRow(story);
    assert.ok(rendered.includes('Claimed:'), 'Should show "Claimed:" label when claimed_at is set');
  });

  test('AC2: A story with finished_at set shows "Finished: HH:MM" in the story row', () => {
    const story = makeStory({ status: 'done', claimed_at: '2026-03-22 10:30:00', finished_at: '2026-03-22 10:45:00' });
    const rendered = renderStoryRow(story);
    assert.ok(rendered.includes('Finished:'), 'Should show "Finished:" label when finished_at is set');
  });

  test('AC3: A story with both null shows no timing text', () => {
    const story = makeStory({ claimed_at: null, finished_at: null });
    const rendered = renderStoryRow(story);
    assert.ok(!rendered.includes('Claimed:'), 'Should NOT show "Claimed:" when claimed_at is null');
    assert.ok(!rendered.includes('Finished:'), 'Should NOT show "Finished:" when finished_at is null');
  });

  test('AC4: A running story shows claimed time but no finished time', () => {
    const story = makeStory({ status: 'running', claimed_at: '2026-03-22 11:00:00', finished_at: null });
    const rendered = renderStoryRow(story);
    assert.ok(rendered.includes('Claimed:'), 'Running story should show "Claimed:"');
    assert.ok(!rendered.includes('Finished:'), 'Running story should NOT show "Finished:" when finished_at is null');
  });

  test('Both times shown when story is fully completed', () => {
    const story = makeStory({ status: 'done', claimed_at: '2026-03-22 14:00:00', finished_at: '2026-03-22 14:30:00' });
    const rendered = renderStoryRow(story);
    assert.ok(rendered.includes('Claimed:'), 'Completed story should show Claimed:');
    assert.ok(rendered.includes('Finished:'), 'Completed story should show Finished:');
  });

  test('Timing uses Geist Mono monospace font (consistent style with step rows)', () => {
    const story = makeStory({ status: 'done', claimed_at: '2026-03-22 09:00:00', finished_at: '2026-03-22 09:15:00' });
    const rendered = renderStoryRow(story);
    assert.ok(rendered.includes('Geist Mono'), 'Timing line should use Geist Mono monospace font');
    assert.ok(rendered.includes('text-secondary'), 'Timing line should use muted text-secondary color');
  });

  test('Story with no claimed_at or finished_at properties (missing fields) shows no timing', () => {
    const story = makeStory();
    // Remove the timing fields entirely
    const minimalStory = {
      id: 'story-1', run_id: 'run-us010', story_id: 'US-001', story_index: 0,
      title: 'Minimal story', description: '', acceptance_criteria: '[]',
      status: 'pending', retry_count: 0, max_retries: 3, output: null,
    };
    const rendered = renderStoryRow(minimalStory);
    assert.ok(!rendered.includes('Claimed:'), 'Should NOT show "Claimed:" when field is missing');
    assert.ok(!rendered.includes('Finished:'), 'Should NOT show "Finished:" when field is missing');
  });

  test('Source HTML contains story claimed_at and finished_at timing references', () => {
    assert.ok(html.includes('claimed_at'), 'HTML should reference claimed_at');
    assert.ok(html.includes('finished_at'), 'HTML should reference finished_at');
    assert.ok(html.includes('Claimed:'), 'HTML should contain "Claimed:" text');
    assert.ok(html.includes('Finished:'), 'HTML should contain "Finished:" text');
  });
});
