import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf-8');

// Extract renderStepRow function body
const stepRowFnStart = html.indexOf('function renderStepRow(s)');
assert.ok(stepRowFnStart !== -1, 'renderStepRow must exist');
const stepRowFnEnd = html.indexOf('\n  }', stepRowFnStart) + 4;
const renderStepRowBody = html.slice(stepRowFnStart, stepRowFnEnd);

// Extract renderRunPanel function body
const renderRunPanelStart = html.indexOf('function renderRunPanel(run, stories)');
assert.ok(renderRunPanelStart !== -1, 'renderRunPanel must exist');
const renderRunPanelEnd = html.indexOf('\n}', renderRunPanelStart) + 2;
const renderRunPanelBody = html.slice(renderRunPanelStart, renderRunPanelEnd);

// Extract saveOpenStates function body
const saveOpenStatesFnStart = html.indexOf('function saveOpenStates(panel)');
const restoreOpenStatesFnStart = html.indexOf('function restoreOpenStates(panel, openIds)');
const saveScrollFnStart = html.indexOf('function saveScroll(panel)');
const restoreScrollFnStart = html.indexOf('function restoreScroll(panel, top)');

// Extract refreshOpenRunPanel function body
const refreshFnStart = html.indexOf('async function refreshOpenRunPanel()');
const refreshFnEnd = html.indexOf('\n}', refreshFnStart) + 2;
const refreshFnBody = html.slice(refreshFnStart, refreshFnEnd);

// Extract openRun function body
const openRunFnStart = html.indexOf('async function openRun(id)');
const openRunFnEnd = html.indexOf('\n}', openRunFnStart) + 2;
const openRunFnBody = html.slice(openRunFnStart, openRunFnEnd);

test('renderStepRow includes data-step-id attribute with step id', () => {
  assert.ok(
    renderStepRowBody.includes('data-step-id="${s.id}"'),
    'renderStepRow must include data-step-id="${s.id}" on the step-row div'
  );
});

test('renderStepRow data-step-id is on the .step-row element', () => {
  // The data-step-id should appear on the div with class step-row
  assert.ok(
    renderStepRowBody.includes('class="step-row" data-step-id="${s.id}"'),
    'data-step-id must be on the .step-row div element'
  );
});

describe('US-006: saveOpenStates helper function', () => {
  test('saveOpenStates function is defined', () => {
    assert.ok(
      saveOpenStatesFnStart !== -1,
      'saveOpenStates(panel) function must be defined in index.html'
    );
  });

  test('saveOpenStates queries .step-row[data-step-id] elements', () => {
    const fnEnd = html.indexOf('\n}', saveOpenStatesFnStart) + 2;
    const body = html.slice(saveOpenStatesFnStart, fnEnd);
    assert.ok(
      body.includes('.step-row[data-step-id]'),
      'saveOpenStates must query .step-row[data-step-id] elements'
    );
  });

  test('saveOpenStates returns a Set', () => {
    const fnEnd = html.indexOf('\n}', saveOpenStatesFnStart) + 2;
    const body = html.slice(saveOpenStatesFnStart, fnEnd);
    assert.ok(
      body.includes('new Set()'),
      'saveOpenStates must return a Set'
    );
    assert.ok(
      body.includes('return'),
      'saveOpenStates must return a value'
    );
  });

  test('saveOpenStates checks step-open class to detect open state', () => {
    const fnEnd = html.indexOf('\n}', saveOpenStatesFnStart) + 2;
    const body = html.slice(saveOpenStatesFnStart, fnEnd);
    assert.ok(
      body.includes('step-open'),
      'saveOpenStates must check for step-open class'
    );
  });
});

describe('US-006: restoreOpenStates helper function', () => {
  test('restoreOpenStates function is defined', () => {
    assert.ok(
      restoreOpenStatesFnStart !== -1,
      'restoreOpenStates(panel, openIds) function must be defined in index.html'
    );
  });

  test('restoreOpenStates applies step-open class', () => {
    const fnEnd = html.indexOf('\n}', restoreOpenStatesFnStart) + 2;
    const body = html.slice(restoreOpenStatesFnStart, fnEnd);
    assert.ok(
      body.includes('step-open'),
      'restoreOpenStates must apply step-open class'
    );
  });

  test('restoreOpenStates applies step-chevron-open class', () => {
    const fnEnd = html.indexOf('\n}', restoreOpenStatesFnStart) + 2;
    const body = html.slice(restoreOpenStatesFnStart, fnEnd);
    assert.ok(
      body.includes('step-chevron-open'),
      'restoreOpenStates must apply step-chevron-open class'
    );
  });

  test('restoreOpenStates sets innerDetails.open = true', () => {
    const fnEnd = html.indexOf('\n}', restoreOpenStatesFnStart) + 2;
    const body = html.slice(restoreOpenStatesFnStart, fnEnd);
    assert.ok(
      body.includes('.open = true'),
      'restoreOpenStates must set .open = true on inner <details>'
    );
  });

  test('restoreOpenStates guards against null/empty openIds', () => {
    const fnEnd = html.indexOf('\n}', restoreOpenStatesFnStart) + 2;
    const body = html.slice(restoreOpenStatesFnStart, fnEnd);
    assert.ok(
      body.includes('if (!panel') || body.includes('if (!openIds') || body.includes('openIds.size === 0'),
      'restoreOpenStates must guard against null panel or empty openIds'
    );
  });
});

describe('US-006: saveScroll helper function', () => {
  test('saveScroll function is defined', () => {
    assert.ok(
      saveScrollFnStart !== -1,
      'saveScroll(panel) function must be defined in index.html'
    );
  });

  test('saveScroll returns panel.scrollTop', () => {
    const fnEnd = html.indexOf('\n}', saveScrollFnStart) + 2;
    const body = html.slice(saveScrollFnStart, fnEnd);
    assert.ok(
      body.includes('scrollTop'),
      'saveScroll must reference scrollTop'
    );
    assert.ok(
      body.includes('return'),
      'saveScroll must return a value'
    );
  });
});

describe('US-006: restoreScroll helper function', () => {
  test('restoreScroll function is defined', () => {
    assert.ok(
      restoreScrollFnStart !== -1,
      'restoreScroll(panel, top) function must be defined in index.html'
    );
  });

  test('restoreScroll sets panel.scrollTop', () => {
    const fnEnd = html.indexOf('\n}', restoreScrollFnStart) + 2;
    const body = html.slice(restoreScrollFnStart, fnEnd);
    assert.ok(
      body.includes('scrollTop'),
      'restoreScroll must set scrollTop'
    );
  });
});

describe('US-006: refreshOpenRunPanel uses shared helpers', () => {
  test('refreshOpenRunPanel calls saveOpenStates', () => {
    assert.ok(
      refreshFnBody.includes('saveOpenStates('),
      'refreshOpenRunPanel must call saveOpenStates()'
    );
  });

  test('refreshOpenRunPanel calls restoreOpenStates', () => {
    assert.ok(
      refreshFnBody.includes('restoreOpenStates('),
      'refreshOpenRunPanel must call restoreOpenStates()'
    );
  });

  test('refreshOpenRunPanel calls saveScroll', () => {
    assert.ok(
      refreshFnBody.includes('saveScroll('),
      'refreshOpenRunPanel must call saveScroll()'
    );
  });

  test('refreshOpenRunPanel calls restoreScroll', () => {
    assert.ok(
      refreshFnBody.includes('restoreScroll('),
      'refreshOpenRunPanel must call restoreScroll()'
    );
  });

  test('refreshOpenRunPanel calls saveOpenStates before renderRunPanel', () => {
    const saveIdx = refreshFnBody.indexOf('saveOpenStates(');
    const renderIdx = refreshFnBody.indexOf('renderRunPanel(');
    assert.ok(saveIdx !== -1 && renderIdx !== -1, 'both calls must exist');
    assert.ok(saveIdx < renderIdx, 'saveOpenStates must be called before renderRunPanel');
  });

  test('refreshOpenRunPanel calls restoreOpenStates after renderRunPanel', () => {
    const renderIdx = refreshFnBody.indexOf('renderRunPanel(');
    const restoreIdx = refreshFnBody.indexOf('restoreOpenStates(');
    assert.ok(restoreIdx !== -1 && renderIdx !== -1, 'both calls must exist');
    assert.ok(restoreIdx > renderIdx, 'restoreOpenStates must be called after renderRunPanel');
  });
});

describe('US-006: openRun uses shared helpers', () => {
  test('openRun calls saveOpenStates', () => {
    assert.ok(
      openRunFnBody.includes('saveOpenStates('),
      'openRun must call saveOpenStates()'
    );
  });

  test('openRun calls restoreOpenStates', () => {
    assert.ok(
      openRunFnBody.includes('restoreOpenStates('),
      'openRun must call restoreOpenStates()'
    );
  });

  test('openRun calls saveScroll', () => {
    assert.ok(
      openRunFnBody.includes('saveScroll('),
      'openRun must call saveScroll()'
    );
  });

  test('openRun calls restoreScroll', () => {
    assert.ok(
      openRunFnBody.includes('restoreScroll('),
      'openRun must call restoreScroll()'
    );
  });

  test('openRun calls saveOpenStates before renderRunPanel', () => {
    const saveIdx = openRunFnBody.indexOf('saveOpenStates(');
    const renderIdx = openRunFnBody.indexOf('renderRunPanel(');
    assert.ok(saveIdx !== -1 && renderIdx !== -1, 'both calls must exist');
    assert.ok(saveIdx < renderIdx, 'saveOpenStates must be called before renderRunPanel in openRun');
  });

  test('openRun calls restoreOpenStates after renderRunPanel', () => {
    const renderIdx = openRunFnBody.indexOf('renderRunPanel(');
    const restoreIdx = openRunFnBody.indexOf('restoreOpenStates(');
    assert.ok(restoreIdx !== -1 && renderIdx !== -1, 'both calls must exist');
    assert.ok(restoreIdx > renderIdx, 'restoreOpenStates must be called after renderRunPanel in openRun');
  });
});

describe('US-006: renderRunPanel no longer contains inline save/restore logic', () => {
  test('renderRunPanel does not contain inline openStepIds save logic', () => {
    // The save logic was moved to saveOpenStates() helper
    assert.ok(
      !renderRunPanelBody.includes('const openStepIds = new Set()'),
      'renderRunPanel must NOT contain inline openStepIds collection (moved to saveOpenStates helper)'
    );
  });
});
