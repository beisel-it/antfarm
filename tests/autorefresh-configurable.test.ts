/**
 * US-005: Full integration test for the configurable autorefresh feature
 *
 * Verifies that all pieces of the configurable-autorefresh feature are present
 * in src/server/index.html: constants, helper functions, dropdown element, options,
 * change event wiring, and on-load initialization.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf-8');

// ─── Constants ───────────────────────────────────────────────────────────────

test('AUTOREFRESH_STORAGE_KEY constant is present in HTML', () => {
  assert.ok(
    html.includes('AUTOREFRESH_STORAGE_KEY'),
    'AUTOREFRESH_STORAGE_KEY constant must be declared in index.html'
  );
});

// ─── Helper functions ─────────────────────────────────────────────────────────

test('getAutorefreshMs function is declared', () => {
  assert.ok(
    html.includes('function getAutorefreshMs()'),
    'getAutorefreshMs function must be declared in index.html'
  );
});

test('setAutorefreshMs function is declared', () => {
  assert.ok(
    html.includes('function setAutorefreshMs('),
    'setAutorefreshMs function must be declared in index.html'
  );
});

test('applyAutorefreshSetting function is declared', () => {
  assert.ok(
    html.includes('function applyAutorefreshSetting('),
    'applyAutorefreshSetting function must be declared in index.html'
  );
});

// ─── Dropdown element ────────────────────────────────────────────────────────

test('#refresh-interval-select element exists in HTML', () => {
  assert.ok(
    html.includes('id="refresh-interval-select"'),
    '#refresh-interval-select select element must exist in index.html'
  );
});

test('select has option with value "0" (Off)', () => {
  assert.ok(
    html.includes('value="0"'),
    'Select must have an option with value="0" (Off)'
  );
});

test('select has option with value "30000" (30s)', () => {
  assert.ok(
    html.includes('value="30000"'),
    'Select must have an option with value="30000" (30s)'
  );
});

test('select has option with value "10000" (10s)', () => {
  assert.ok(
    html.includes('value="10000"'),
    'Select must have an option with value="10000" (10s)'
  );
});

test('select has option with value "60000" (1min)', () => {
  assert.ok(
    html.includes('value="60000"'),
    'Select must have an option with value="60000" (1min)'
  );
});

test('select has option with value "300000" (5min)', () => {
  assert.ok(
    html.includes('value="300000"'),
    'Select must have an option with value="300000" (5min)'
  );
});

// ─── Change event wiring ──────────────────────────────────────────────────────

test('change event listener references setAutorefreshMs', () => {
  // Find the change event listener block for refreshIntervalSelect
  const changeListenerIdx = html.indexOf("refreshIntervalSelect.addEventListener('change'");
  assert.ok(changeListenerIdx !== -1, "refreshIntervalSelect change event listener must exist");
  // Check the listener body (within ~300 chars)
  const listenerBody = html.slice(changeListenerIdx, changeListenerIdx + 300);
  assert.ok(
    listenerBody.includes('setAutorefreshMs'),
    'change event listener must call setAutorefreshMs'
  );
});

test('change event listener references applyAutorefreshSetting', () => {
  const changeListenerIdx = html.indexOf("refreshIntervalSelect.addEventListener('change'");
  assert.ok(changeListenerIdx !== -1, "refreshIntervalSelect change event listener must exist");
  const listenerBody = html.slice(changeListenerIdx, changeListenerIdx + 300);
  assert.ok(
    listenerBody.includes('applyAutorefreshSetting'),
    'change event listener must call applyAutorefreshSetting'
  );
});

// ─── On-load initialization ───────────────────────────────────────────────────

test('applyAutorefreshSetting is called on page load', () => {
  // After the refreshIntervalSelect block, applyAutorefreshSetting should be called
  // at the top level (not inside a function) to apply the setting on page load
  assert.ok(
    html.includes('applyAutorefreshSetting(getAutorefreshMs())'),
    'applyAutorefreshSetting(getAutorefreshMs()) must be called at page load'
  );
});
