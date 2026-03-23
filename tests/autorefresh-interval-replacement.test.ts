import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '../src/server/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

describe('US-002: Replace dashboard refresh intervals with getAutorefreshMs()', () => {
  it('main board refresh is restarted via applyAutorefreshSetting()', () => {
    assert.ok(html.includes('function restartMainRefreshInterval(ms) {'));
    assert.ok(html.includes('mainRefreshInterval = setInterval(() => {'));
    assert.ok(html.includes('function applyAutorefreshSetting(ms) {'));
    assert.ok(html.includes('restartMainRefreshInterval(ms);'));
  });

  it('openRunRefreshInterval inside startOpenRunRefresh uses getAutorefreshMs()', () => {
    const start = html.indexOf('function startOpenRunRefresh()');
    assert.ok(start !== -1, 'startOpenRunRefresh should exist');
    const end = html.indexOf('async function fetchJSON', start);
    const body = html.slice(start, end);
    assert.ok(body.includes('}, getAutorefreshMs());'), 'open run setInterval should use getAutorefreshMs()');
  });

  it('medic refresh is restarted via applyAutorefreshSetting()', () => {
    assert.ok(html.includes('function restartMedicRefreshInterval(ms) {'));
    assert.ok(html.includes('medicRefreshInterval = setInterval(loadMedicStatus, ms);'));
    assert.ok(html.includes('restartMedicRefreshInterval(ms);'));
  });

  it('countdown computes total seconds from getAutorefreshMs()', () => {
    assert.ok(
      html.includes('const remaining = Math.floor(getAutorefreshMs() / 1000) - Math.floor((Date.now() - lastRefreshTime) / 1000);'),
      'countdown should use getAutorefreshMs() as total seconds source'
    );
  });

  it('refresh-note label is updated via updateRefreshNote()', () => {
    assert.ok(html.includes('function updateRefreshNote(ms) {'));
    assert.ok(html.includes("note.textContent = `Auto-refresh: ${Math.floor(ms / 1000)}s`"));
  });

  it('no active setInterval call uses hardcoded 30000', () => {
    assert.ok(!html.includes(', 30000);'));
  });
});
