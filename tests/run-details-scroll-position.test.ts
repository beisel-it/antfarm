import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('src/server/index.html', 'utf-8');

describe('US-004: Preserve scroll position in Run Details panel', () => {
  test('refreshOpenRunPanel saves panel.scrollTop before rendering', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    assert.ok(fnStart !== -1, 'refreshOpenRunPanel function should exist');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);
    assert.ok(
      fnBody.includes('panel.scrollTop'),
      'refreshOpenRunPanel should reference panel.scrollTop'
    );
  });

  test('refreshOpenRunPanel reads scrollTop before renderRunPanel call', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);

    const scrollTopReadIdx = fnBody.indexOf('panel.scrollTop');
    const renderCallIdx = fnBody.indexOf('renderRunPanel(');

    assert.ok(scrollTopReadIdx !== -1, 'should read panel.scrollTop');
    assert.ok(renderCallIdx !== -1, 'should call renderRunPanel');
    assert.ok(
      scrollTopReadIdx < renderCallIdx,
      'should read scrollTop before calling renderRunPanel'
    );
  });

  test('refreshOpenRunPanel restores scrollTop after renderRunPanel call', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);

    const renderCallIdx = fnBody.indexOf('renderRunPanel(');
    const restoreIdx = fnBody.indexOf('panel.scrollTop = scrollTop');

    assert.ok(restoreIdx !== -1, 'should restore panel.scrollTop = scrollTop');
    assert.ok(
      restoreIdx > renderCallIdx,
      'should restore scrollTop after calling renderRunPanel'
    );
  });

  test('refreshOpenRunPanel uses getElementById to get panel element', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes("getElementById('panel')"),
      "should use getElementById('panel') to get the panel element"
    );
  });

  test('refreshOpenRunPanel saves scrollTop into a const variable', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('const scrollTop = panel'),
      'should save scrollTop via const scrollTop = panel...'
    );
  });

  test('refreshOpenRunPanel guards scrollTop restore with null check on panel', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);

    // Should have a null-check guard: `if (panel)` or `panel ?`
    assert.ok(
      fnBody.includes('if (panel)') || fnBody.includes('panel ?'),
      'should guard panel access with null check'
    );
  });
});
