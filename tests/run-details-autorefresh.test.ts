/**
 * US-007: Integration tests covering the full refresh-alignment and anti-flicker behaviour
 *
 * These tests mechanically verify all the changes introduced in US-001 through US-006
 * by reading src/server/index.html as a string and checking for expected patterns.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf-8');

// ─── US-001: GLOBAL_REFRESH_MS constant ────────────────────────────────────

test('GLOBAL_REFRESH_MS constant is declared in the script block', () => {
  assert.ok(html.includes('const GLOBAL_REFRESH_MS'), 'GLOBAL_REFRESH_MS constant must be declared');
});

test('GLOBAL_REFRESH_MS is set to 30000', () => {
  assert.ok(html.includes('const GLOBAL_REFRESH_MS = 30000'), 'GLOBAL_REFRESH_MS must equal 30000');
});

// ─── US-002: startOpenRunRefresh uses GLOBAL_REFRESH_MS ─────────────────────

test('startOpenRunRefresh uses GLOBAL_REFRESH_MS instead of hardcoded 5000', () => {
  const startIdx = html.indexOf('function startOpenRunRefresh()');
  assert.ok(startIdx !== -1, 'startOpenRunRefresh function must exist');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('GLOBAL_REFRESH_MS'), 'startOpenRunRefresh must reference GLOBAL_REFRESH_MS');
  assert.ok(!fnBody.includes('5000'), 'startOpenRunRefresh must not contain hardcoded 5000');
});

test('no hardcoded 5000ms interval remains anywhere in the HTML', () => {
  assert.ok(!html.includes(', 5000)'), 'No ", 5000)" pattern should exist in the HTML');
});

// ─── US-003: data-step-id attribute on step rows ────────────────────────────

test('renderStepRow template contains data-step-id attribute', () => {
  assert.ok(html.includes('data-step-id="${s.id}"'), 'step-row template must include data-step-id="${s.id}"');
});

test('data-step-id is on the .step-row element', () => {
  // The step-row div should have data-step-id inline
  assert.ok(
    html.includes('class="step-row" data-step-id="${s.id}"'),
    '.step-row div must have data-step-id="${s.id}" attribute'
  );
});

// ─── US-004 / US-006: scroll position preserved in refreshOpenRunPanel ───────

test('refreshOpenRunPanel calls saveScroll before re-rendering', () => {
  const startIdx = html.indexOf('async function refreshOpenRunPanel()');
  assert.ok(startIdx !== -1, 'refreshOpenRunPanel function must exist');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('saveScroll('), 'refreshOpenRunPanel must call saveScroll()');
});

test('refreshOpenRunPanel calls restoreScroll after re-rendering', () => {
  const startIdx = html.indexOf('async function refreshOpenRunPanel()');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('restoreScroll('), 'refreshOpenRunPanel must call restoreScroll()');
});

test('saveScroll returns panel.scrollTop', () => {
  const startIdx = html.indexOf('function saveScroll(');
  assert.ok(startIdx !== -1, 'saveScroll helper must exist');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('scrollTop'), 'saveScroll must reference scrollTop');
});

test('restoreScroll sets panel.scrollTop', () => {
  const startIdx = html.indexOf('function restoreScroll(');
  assert.ok(startIdx !== -1, 'restoreScroll helper must exist');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('scrollTop'), 'restoreScroll must reference scrollTop');
});

// ─── US-006: saveOpenStates / restoreOpenStates helpers ─────────────────────

test('saveOpenStates function is defined', () => {
  assert.ok(html.includes('function saveOpenStates('), 'saveOpenStates helper must be defined');
});

test('restoreOpenStates function is defined', () => {
  assert.ok(html.includes('function restoreOpenStates('), 'restoreOpenStates helper must be defined');
});

test('saveOpenStates queries step rows by data-step-id', () => {
  const startIdx = html.indexOf('function saveOpenStates(');
  assert.ok(startIdx !== -1, 'saveOpenStates must exist');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('.step-row[data-step-id]'), 'saveOpenStates must query .step-row[data-step-id]');
});

test('restoreOpenStates applies open state classes', () => {
  const startIdx = html.indexOf('function restoreOpenStates(');
  assert.ok(startIdx !== -1, 'restoreOpenStates must exist');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('step-open'), 'restoreOpenStates must apply step-open class');
});

test('refreshOpenRunPanel calls saveOpenStates before re-rendering', () => {
  const startIdx = html.indexOf('async function refreshOpenRunPanel()');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('saveOpenStates('), 'refreshOpenRunPanel must call saveOpenStates()');
});

test('refreshOpenRunPanel calls restoreOpenStates after re-rendering', () => {
  const startIdx = html.indexOf('async function refreshOpenRunPanel()');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes('restoreOpenStates('), 'refreshOpenRunPanel must call restoreOpenStates()');
});

// ─── US-005: opacity transition on .panel CSS ───────────────────────────────

test('.panel CSS rule includes transition for opacity', () => {
  // Find the .panel CSS rule
  const panelCssIdx = html.indexOf('.panel{');
  assert.ok(panelCssIdx !== -1, '.panel CSS rule must exist');
  const endIdx = html.indexOf('}', panelCssIdx);
  const cssRule = html.slice(panelCssIdx, endIdx + 1);
  assert.ok(cssRule.includes('transition'), '.panel CSS rule must include a transition property');
  assert.ok(cssRule.includes('opacity'), '.panel CSS transition must include opacity');
});

test('.panel uses opacity transition with ease timing', () => {
  assert.ok(
    html.includes('transition:opacity 0.1s ease'),
    '.panel CSS must have "transition:opacity 0.1s ease"'
  );
});

test('refreshOpenRunPanel dims the panel before fetching (opacity 0.85)', () => {
  const startIdx = html.indexOf('async function refreshOpenRunPanel()');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes("opacity = '0.85'"), 'refreshOpenRunPanel must set opacity to 0.85 before fetch');
});

test('refreshOpenRunPanel restores panel opacity to 1 after render', () => {
  const startIdx = html.indexOf('async function refreshOpenRunPanel()');
  const endIdx = html.indexOf('\n}', startIdx);
  const fnBody = html.slice(startIdx, endIdx + 2);
  assert.ok(fnBody.includes("opacity = '1'"), 'refreshOpenRunPanel must restore opacity to 1 after render');
});
