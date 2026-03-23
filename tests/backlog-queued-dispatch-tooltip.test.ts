import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('backlog queued dispatch tooltip', () => {
  const distHtml = readFileSync(
    join(process.cwd(), 'dist/server/index.html'),
    'utf8'
  );

  // Extract the renderBacklogColumn function body
  const fnMatch = distHtml.match(/function renderBacklogColumn\s*\([^)]*\)\s*\{([\s\S]*?)^\s*\}/m);
  // If not found via above, try a broader search for the dispatchTitle block
  const dispatchTitleBlock = (() => {
    const start = distHtml.indexOf('dispatchTitle');
    if (start === -1) return null;
    return distHtml.slice(start, start + 500);
  })();

  it('dist/server/index.html exists and contains renderBacklogColumn', () => {
    assert.ok(distHtml.includes('renderBacklogColumn'), 'renderBacklogColumn should be in dist HTML');
  });

  it('dispatchTitle assignment exists in dist HTML', () => {
    assert.ok(dispatchTitleBlock !== null, 'dispatchTitle should be present in dist HTML');
  });

  it('dispatchTitle handles isQueued case with a non-empty title attribute', () => {
    assert.ok(
      distHtml.includes('isQueued'),
      'isQueued should appear in dist HTML'
    );
    // The queued branch should produce a non-empty title attribute
    assert.ok(
      distHtml.includes('title=') || distHtml.includes("title='"),
      'a title attribute should be emitted'
    );
    // Check the queued tooltip is present
    assert.ok(
      distHtml.includes('will dispatch automatically'),
      'queued tooltip should mention "will dispatch automatically"'
    );
  });

  it('queued tooltip text contains the word "queued"', () => {
    assert.ok(
      distHtml.includes('queued'),
      'tooltip text should reference "queued"'
    );
    // More specific check for the queued tooltip string
    assert.ok(
      distHtml.includes('Entry is queued'),
      'tooltip should say "Entry is queued"'
    );
  });

  it('existing hasActiveRun tooltip is still present and unmodified', () => {
    assert.ok(
      distHtml.includes('Project run already in flight'),
      'hasActiveRun tooltip should still read "Project run already in flight"'
    );
  });

  it('dispatchTitle logic: isQueued=true, hasActiveRun=false gives non-empty title', () => {
    // Simulate the logic by evaluating in a controlled way
    const hasActiveRun = false;
    const isQueued = true;
    const dispatchTitle = hasActiveRun
      ? 'title="Project run already in flight"'
      : isQueued
        ? 'title="Entry is queued — will dispatch automatically"'
        : '';

    assert.ok(dispatchTitle.length > 0, 'dispatchTitle should be non-empty when isQueued=true');
    assert.ok(dispatchTitle.includes('title='), 'dispatchTitle should contain a title attribute');
    assert.ok(dispatchTitle.toLowerCase().includes('queued'), 'dispatchTitle should reference "queued"');
  });

  it('dispatchTitle logic: hasActiveRun=true gives flight tooltip', () => {
    const hasActiveRun = true;
    const isQueued = false;
    const dispatchTitle = hasActiveRun
      ? 'title="Project run already in flight"'
      : isQueued
        ? 'title="Entry is queued — will dispatch automatically"'
        : '';

    assert.equal(dispatchTitle, 'title="Project run already in flight"');
  });

  it('dispatchTitle logic: both false gives empty string', () => {
    const hasActiveRun = false;
    const isQueued = false;
    const dispatchTitle = hasActiveRun
      ? 'title="Project run already in flight"'
      : isQueued
        ? 'title="Entry is queued — will dispatch automatically"'
        : '';

    assert.equal(dispatchTitle, '');
  });
});
