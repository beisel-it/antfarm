/**
 * US-006: Tests verifying the helper-function refactor for open state and scroll preservation.
 * saveOpenStates(), restoreOpenStates(), saveScroll(), restoreScroll() are defined as
 * standalone helpers and used by both openRun() and refreshOpenRunPanel().
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('src/server/index.html', 'utf-8');

// Find all helper functions
const saveOpenStatesIdx = html.indexOf('function saveOpenStates(panel)');
const restoreOpenStatesIdx = html.indexOf('function restoreOpenStates(panel, openIds)');
const saveScrollIdx = html.indexOf('function saveScroll(panel)');
const restoreScrollIdx = html.indexOf('function restoreScroll(panel, top)');

// openRun function
const openRunStart = html.indexOf('async function openRun(id)');
const openRunEnd = html.indexOf('\n}', openRunStart) + 2;
const openRunBody = html.slice(openRunStart, openRunEnd);

// refreshOpenRunPanel function
const refreshStart = html.indexOf('async function refreshOpenRunPanel()');
const refreshEnd = html.indexOf('\n}', refreshStart) + 2;
const refreshBody = html.slice(refreshStart, refreshEnd);

describe('US-006: Helper functions exist', () => {
  test('saveOpenStates(panel) is defined', () => {
    assert.ok(saveOpenStatesIdx !== -1, 'saveOpenStates helper must exist');
  });

  test('restoreOpenStates(panel, openIds) is defined', () => {
    assert.ok(restoreOpenStatesIdx !== -1, 'restoreOpenStates helper must exist');
  });

  test('saveScroll(panel) is defined', () => {
    assert.ok(saveScrollIdx !== -1, 'saveScroll helper must exist');
  });

  test('restoreScroll(panel, top) is defined', () => {
    assert.ok(restoreScrollIdx !== -1, 'restoreScroll helper must exist');
  });

  test('helpers are defined before openRun', () => {
    assert.ok(
      saveOpenStatesIdx < openRunStart,
      'helper functions must be defined before openRun()'
    );
  });
});

describe('US-006: openRun() uses helpers consistently', () => {
  test('openRun calls all four helpers', () => {
    assert.ok(openRunBody.includes('saveOpenStates('), 'openRun must call saveOpenStates');
    assert.ok(openRunBody.includes('restoreOpenStates('), 'openRun must call restoreOpenStates');
    assert.ok(openRunBody.includes('saveScroll('), 'openRun must call saveScroll');
    assert.ok(openRunBody.includes('restoreScroll('), 'openRun must call restoreScroll');
  });

  test('openRun saves state before renderRunPanel', () => {
    const saveIdx = openRunBody.indexOf('saveOpenStates(');
    const renderIdx = openRunBody.indexOf('renderRunPanel(');
    assert.ok(saveIdx < renderIdx, 'must save state before render');
  });

  test('openRun restores state after renderRunPanel', () => {
    const renderIdx = openRunBody.indexOf('renderRunPanel(');
    const restoreIdx = openRunBody.indexOf('restoreOpenStates(');
    assert.ok(restoreIdx > renderIdx, 'must restore state after render');
  });
});

describe('US-006: refreshOpenRunPanel() uses helpers consistently', () => {
  test('refreshOpenRunPanel calls all four helpers', () => {
    assert.ok(refreshBody.includes('saveOpenStates('), 'refreshOpenRunPanel must call saveOpenStates');
    assert.ok(refreshBody.includes('restoreOpenStates('), 'refreshOpenRunPanel must call restoreOpenStates');
    assert.ok(refreshBody.includes('saveScroll('), 'refreshOpenRunPanel must call saveScroll');
    assert.ok(refreshBody.includes('restoreScroll('), 'refreshOpenRunPanel must call restoreScroll');
  });

  test('refreshOpenRunPanel saves state before renderRunPanel', () => {
    const saveIdx = refreshBody.indexOf('saveOpenStates(');
    const renderIdx = refreshBody.indexOf('renderRunPanel(');
    assert.ok(saveIdx < renderIdx, 'must save state before render');
  });

  test('refreshOpenRunPanel restores state after renderRunPanel', () => {
    const renderIdx = refreshBody.indexOf('renderRunPanel(');
    const restoreIdx = refreshBody.indexOf('restoreOpenStates(');
    assert.ok(restoreIdx > renderIdx, 'must restore state after render');
  });
});

describe('US-006: Code paths are symmetric', () => {
  test('both openRun and refreshOpenRunPanel use the same helper names', () => {
    const helpers = ['saveOpenStates(', 'restoreOpenStates(', 'saveScroll(', 'restoreScroll('];
    for (const h of helpers) {
      assert.ok(openRunBody.includes(h), `openRun must use ${h}`);
      assert.ok(refreshBody.includes(h), `refreshOpenRunPanel must use ${h}`);
    }
  });
});
