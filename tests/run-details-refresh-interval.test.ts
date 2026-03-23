import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf-8');

test('startOpenRunRefresh uses getAutorefreshMs() for setInterval', () => {
  const startIdx = html.indexOf('function startOpenRunRefresh()');
  assert.ok(startIdx !== -1, 'startOpenRunRefresh function must exist');

  const snippet = html.slice(startIdx, startIdx + 320);
  assert.ok(snippet.includes('setInterval'), 'startOpenRunRefresh must call setInterval');
  assert.ok(snippet.includes('getAutorefreshMs()'), 'startOpenRunRefresh setInterval must use getAutorefreshMs()');
  assert.ok(!snippet.includes('GLOBAL_REFRESH_MS'), 'startOpenRunRefresh setInterval must not use GLOBAL_REFRESH_MS');
  assert.ok(!snippet.includes('30000'), 'startOpenRunRefresh setInterval must not use hardcoded 30000');
});

test('medic status polling interval is restarted from applyAutorefreshSetting()', () => {
  assert.ok(
    html.includes('function restartMedicRefreshInterval(ms) {'),
    'restartMedicRefreshInterval function must exist'
  );
  assert.ok(
    html.includes('medicRefreshInterval = setInterval(loadMedicStatus, ms);'),
    'Medic polling interval must use configured ms value'
  );
  assert.ok(
    html.includes('restartMedicRefreshInterval(ms);'),
    'applyAutorefreshSetting must restart medic polling'
  );
  assert.ok(
    !html.includes('setInterval(loadMedicStatus, 30000);'),
    'Medic polling interval must not use hardcoded 30000'
  );
});

test('no setInterval call uses GLOBAL_REFRESH_MS or hardcoded 30000', () => {
  assert.ok(!html.includes('}, GLOBAL_REFRESH_MS);'), 'No setInterval should use GLOBAL_REFRESH_MS directly');
  assert.ok(!html.includes(', 30000);'), 'No setInterval should use hardcoded 30000');
});

test('GLOBAL_REFRESH_MS constant remains defined as default fallback', () => {
  const constantIdx = html.indexOf('const GLOBAL_REFRESH_MS = 30000;');
  const fnIdx = html.indexOf('function getAutorefreshMs()');
  assert.ok(constantIdx !== -1, 'GLOBAL_REFRESH_MS constant must remain defined');
  assert.ok(fnIdx !== -1, 'getAutorefreshMs function must exist');
  assert.ok(constantIdx < fnIdx, 'GLOBAL_REFRESH_MS should be defined before getAutorefreshMs fallback usage');
});
