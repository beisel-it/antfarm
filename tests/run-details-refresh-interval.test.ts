import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf-8');

test('startOpenRunRefresh uses GLOBAL_REFRESH_MS instead of hardcoded 5000', () => {
  // Find the startOpenRunRefresh function and verify it uses GLOBAL_REFRESH_MS
  const fnMatch = html.match(/function startOpenRunRefresh\(\)[^}]*\{[^]*?^\}/m);
  // Extract the relevant setInterval call within startOpenRunRefresh
  const startIdx = html.indexOf('function startOpenRunRefresh()');
  assert.ok(startIdx !== -1, 'startOpenRunRefresh function must exist');

  // Find the setInterval inside startOpenRunRefresh
  const snippet = html.slice(startIdx, startIdx + 300);
  assert.ok(snippet.includes('GLOBAL_REFRESH_MS'), 'startOpenRunRefresh must use GLOBAL_REFRESH_MS');
  assert.ok(!snippet.includes('5000'), 'startOpenRunRefresh must not use hardcoded 5000');
});

test('no hardcoded 5000 magic number in run-details refresh interval code', () => {
  assert.ok(!html.includes(', 5000)'), 'No hardcoded 5000ms interval should remain in the HTML');
});

test('GLOBAL_REFRESH_MS constant is defined before startOpenRunRefresh', () => {
  const constantIdx = html.indexOf('const GLOBAL_REFRESH_MS');
  const fnIdx = html.indexOf('function startOpenRunRefresh()');
  assert.ok(constantIdx !== -1, 'GLOBAL_REFRESH_MS must be defined');
  assert.ok(fnIdx !== -1, 'startOpenRunRefresh must be defined');
  assert.ok(constantIdx < fnIdx, 'GLOBAL_REFRESH_MS must be defined before startOpenRunRefresh');
});

test('startOpenRunRefresh function body contains setInterval with GLOBAL_REFRESH_MS', () => {
  // Find the setInterval call near startOpenRunRefresh
  const startIdx = html.indexOf('function startOpenRunRefresh()');
  const endIdx = html.indexOf('\n}', startIdx) + 2;
  const fnBody = html.slice(startIdx, endIdx);
  assert.ok(fnBody.includes('setInterval'), 'startOpenRunRefresh must call setInterval');
  assert.ok(fnBody.includes('GLOBAL_REFRESH_MS'), 'setInterval must use GLOBAL_REFRESH_MS');
});
