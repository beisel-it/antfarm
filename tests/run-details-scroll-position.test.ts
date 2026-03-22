import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('src/server/index.html', 'utf-8');

// Extract refreshOpenRunPanel function body
const refreshFnStart = html.indexOf('async function refreshOpenRunPanel()');
const refreshFnEnd = html.indexOf('\n}', refreshFnStart) + 2;
const refreshFnBody = html.slice(refreshFnStart, refreshFnEnd);

// Extract saveScroll and restoreScroll bodies
const saveScrollStart = html.indexOf('function saveScroll(panel)');
const restoreScrollStart = html.indexOf('function restoreScroll(panel, top)');

describe('US-004/US-006: Preserve scroll position in Run Details panel', () => {
  test('saveScroll helper function exists', () => {
    assert.ok(saveScrollStart !== -1, 'saveScroll(panel) function must be defined');
  });

  test('restoreScroll helper function exists', () => {
    assert.ok(restoreScrollStart !== -1, 'restoreScroll(panel, top) function must be defined');
  });

  test('saveScroll returns panel.scrollTop or 0', () => {
    const fnEnd = html.indexOf('\n}', saveScrollStart) + 2;
    const body = html.slice(saveScrollStart, fnEnd);
    assert.ok(
      body.includes('scrollTop'),
      'saveScroll must reference scrollTop'
    );
  });

  test('restoreScroll sets panel.scrollTop', () => {
    const fnEnd = html.indexOf('\n}', restoreScrollStart) + 2;
    const body = html.slice(restoreScrollStart, fnEnd);
    assert.ok(
      body.includes('scrollTop'),
      'restoreScroll must set scrollTop'
    );
  });

  test('refreshOpenRunPanel calls saveScroll before renderRunPanel', () => {
    const saveScrollIdx = refreshFnBody.indexOf('saveScroll(');
    const renderCallIdx = refreshFnBody.indexOf('renderRunPanel(');
    assert.ok(saveScrollIdx !== -1, 'refreshOpenRunPanel should call saveScroll');
    assert.ok(renderCallIdx !== -1, 'refreshOpenRunPanel should call renderRunPanel');
    assert.ok(
      saveScrollIdx < renderCallIdx,
      'should call saveScroll before renderRunPanel'
    );
  });

  test('refreshOpenRunPanel calls restoreScroll after renderRunPanel', () => {
    const renderCallIdx = refreshFnBody.indexOf('renderRunPanel(');
    const restoreScrollIdx = refreshFnBody.indexOf('restoreScroll(');
    assert.ok(restoreScrollIdx !== -1, 'refreshOpenRunPanel should call restoreScroll');
    assert.ok(
      restoreScrollIdx > renderCallIdx,
      'should call restoreScroll after renderRunPanel'
    );
  });

  test('refreshOpenRunPanel uses getElementById to get panel element', () => {
    assert.ok(
      refreshFnBody.includes("getElementById('panel')"),
      "should use getElementById('panel') to get the panel element"
    );
  });
});
