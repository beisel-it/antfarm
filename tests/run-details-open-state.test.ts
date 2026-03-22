import { test } from 'node:test';
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

test('renderRunPanel saves open step ids before replacing innerHTML', () => {
  assert.ok(
    renderRunPanelBody.includes('const openStepIds = new Set()'),
    'renderRunPanel must declare openStepIds Set before innerHTML assignment'
  );
  // Verify it collects from querySelectorAll
  assert.ok(
    renderRunPanelBody.includes('querySelectorAll(\'.step-row[data-step-id]\')'),
    'renderRunPanel must query .step-row[data-step-id] elements to collect open IDs'
  );
  // Verify it checks step-open class
  assert.ok(
    renderRunPanelBody.includes('step-open'),
    'renderRunPanel must check for step-open class when collecting open steps'
  );
});

test('renderRunPanel collects openStepIds before panel.innerHTML assignment', () => {
  const openStepIdsIdx = renderRunPanelBody.indexOf('const openStepIds = new Set()');
  const innerHtmlIdx = renderRunPanelBody.indexOf('panel.innerHTML = `');
  assert.ok(openStepIdsIdx !== -1, 'openStepIds must be defined');
  assert.ok(innerHtmlIdx !== -1, 'panel.innerHTML assignment must exist');
  assert.ok(
    openStepIdsIdx < innerHtmlIdx,
    'openStepIds must be collected before panel.innerHTML is set'
  );
});

test('renderRunPanel restores step-open class after innerHTML assignment', () => {
  const innerHtmlIdx = renderRunPanelBody.indexOf('panel.innerHTML = `');
  // Find restore logic after the innerHTML assignment
  const afterHtml = renderRunPanelBody.slice(innerHtmlIdx);
  assert.ok(
    afterHtml.includes('step-open'),
    'renderRunPanel must re-apply step-open class after innerHTML assignment'
  );
  assert.ok(
    afterHtml.includes('openStepIds.has(stepId)'),
    'renderRunPanel must check openStepIds.has() when restoring state'
  );
});

test('renderRunPanel restores step-chevron-open class after innerHTML assignment', () => {
  const innerHtmlIdx = renderRunPanelBody.indexOf('panel.innerHTML = `');
  const afterHtml = renderRunPanelBody.slice(innerHtmlIdx);
  assert.ok(
    afterHtml.includes('step-chevron-open'),
    'renderRunPanel must re-apply step-chevron-open class after innerHTML assignment'
  );
});

test('renderRunPanel sets open attribute on inner details element after re-render', () => {
  const innerHtmlIdx = renderRunPanelBody.indexOf('panel.innerHTML = `');
  const afterHtml = renderRunPanelBody.slice(innerHtmlIdx);
  assert.ok(
    afterHtml.includes('innerDetails') || afterHtml.includes('inner'),
    'renderRunPanel must restore inner <details> open attribute'
  );
  assert.ok(
    afterHtml.includes('.open = true'),
    'renderRunPanel must set .open = true on the inner <details> element'
  );
});

test('renderRunPanel only restores state when there are open steps', () => {
  const innerHtmlIdx = renderRunPanelBody.indexOf('panel.innerHTML = `');
  const afterHtml = renderRunPanelBody.slice(innerHtmlIdx);
  assert.ok(
    afterHtml.includes('openStepIds.size > 0'),
    'renderRunPanel must guard restore with openStepIds.size > 0 check'
  );
});
