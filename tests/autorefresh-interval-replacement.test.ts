import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '../src/server/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

describe('US-002: Replace dashboard refresh intervals with getAutorefreshMs()', () => {
  it('main board refresh setInterval uses getAutorefreshMs()', () => {
    assert.match(html, /setInterval\(\(\) => \{[\s\S]*if \(currentWf\) loadRuns\(\);[\s\S]*\}, getAutorefreshMs\(\)\);/);
  });

  it('openRunRefreshInterval inside startOpenRunRefresh uses getAutorefreshMs()', () => {
    const start = html.indexOf('function startOpenRunRefresh()');
    assert.ok(start !== -1, 'startOpenRunRefresh should exist');
    const end = html.indexOf('async function fetchJSON', start);
    const body = html.slice(start, end);
    assert.ok(body.includes('}, getAutorefreshMs());'), 'open run setInterval should use getAutorefreshMs()');
  });

  it('medic setInterval uses getAutorefreshMs() and not 30000', () => {
    assert.ok(html.includes('setInterval(loadMedicStatus, getAutorefreshMs());'));
    assert.ok(!html.includes('setInterval(loadMedicStatus, 30000);'));
  });

  it('next-refresh countdown computes total seconds from getAutorefreshMs()', () => {
    assert.ok(
      html.includes('const remaining = Math.floor(getAutorefreshMs() / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000);'),
      'countdown should use getAutorefreshMs() as total seconds source'
    );
  });

  it('refresh-note label uses getAutorefreshMs()', () => {
    assert.ok(
      html.includes("document.getElementById('refresh-note').textContent = `Auto-refresh: ${Math.floor(getAutorefreshMs() / 1000)}s`;")
    );
  });

  it('no setInterval call uses GLOBAL_REFRESH_MS or hardcoded 30000', () => {
    assert.ok(!html.includes('}, GLOBAL_REFRESH_MS);'));
    assert.ok(!html.includes(', 30000);'));
  });
});
