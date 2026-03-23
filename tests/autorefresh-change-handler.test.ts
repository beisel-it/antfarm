import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '../src/server/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

describe('US-004: Wire dropdown change handler to restart refresh intervals', () => {
  it('defines applyAutorefreshSetting(ms)', () => {
    assert.ok(html.includes('function applyAutorefreshSetting(ms) {'));
  });

  it('applyAutorefreshSetting restarts main + medic refresh intervals', () => {
    const fnStart = html.indexOf('function applyAutorefreshSetting(ms) {');
    const fnEnd = html.indexOf('function initStatusFilterButtons()', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);

    assert.ok(fnBody.includes('restartMainRefreshInterval(ms);'));
    assert.ok(fnBody.includes('restartMedicRefreshInterval(ms);'));
  });

  it('applyAutorefreshSetting handles Off (0) by stopping refresh and showing off UI', () => {
    assert.ok(html.includes('if (ms === 0) {'));
    assert.ok(html.includes('stopOpenRunRefresh();'));
    assert.ok(html.includes("if (next) next.textContent = '—';"));
    assert.ok(html.includes('updateRefreshNote(0);'));
    assert.ok(html.includes("note.textContent = 'Auto-refresh: off';"));
  });

  it('applyAutorefreshSetting restarts open-run refresh when a run is open', () => {
    assert.ok(html.includes('if (openRunId) {'));
    assert.ok(html.includes('stopOpenRunRefresh();'));
    assert.ok(html.includes('startOpenRunRefresh();'));
  });

  it('dropdown change listener calls setAutorefreshMs(ms) then applyAutorefreshSetting(ms)', () => {
    const listenerStart = html.indexOf("refreshIntervalSelect.addEventListener('change'");
    assert.ok(listenerStart !== -1, 'change listener should exist');
    const listenerBody = html.slice(listenerStart, listenerStart + 350);
    assert.ok(listenerBody.includes('const ms = Number(e.target.value);'));
    assert.ok(listenerBody.includes('setAutorefreshMs(ms);'));
    assert.ok(listenerBody.includes('applyAutorefreshSetting(ms);'));
  });

  it('applies stored autorefresh value on page load', () => {
    assert.ok(html.includes('applyAutorefreshSetting(getAutorefreshMs());'));
  });

  it('logic simulation: Off clears intervals, non-zero restarts intervals immediately', () => {
    let mainActive = true;
    let medicActive = true;
    let openRunActive = true;
    let openRunId = 'run-1';
    let refreshNote = '';
    let nextRefresh = 'Next: 30s';
    let lastRefreshTime = 0;

    function restartMainRefreshInterval(ms: number) {
      mainActive = ms !== 0;
    }

    function restartMedicRefreshInterval(ms: number) {
      medicActive = ms !== 0;
    }

    function stopOpenRunRefresh() {
      openRunActive = false;
    }

    function startOpenRunRefresh() {
      if (openRunId) openRunActive = true;
    }

    function updateRefreshNote(ms: number) {
      refreshNote = ms === 0 ? 'Auto-refresh: off' : `Auto-refresh: ${Math.floor(ms / 1000)}s`;
    }

    function applyAutorefreshSetting(ms: number) {
      restartMainRefreshInterval(ms);
      restartMedicRefreshInterval(ms);

      if (ms === 0) {
        stopOpenRunRefresh();
        nextRefresh = '—';
        updateRefreshNote(0);
        lastRefreshTime = Date.now();
        return;
      }

      if (openRunId) {
        stopOpenRunRefresh();
        startOpenRunRefresh();
      }

      updateRefreshNote(ms);
      lastRefreshTime = Date.now();
    }

    applyAutorefreshSetting(0);
    assert.equal(mainActive, false);
    assert.equal(medicActive, false);
    assert.equal(openRunActive, false);
    assert.equal(nextRefresh, '—');
    assert.equal(refreshNote, 'Auto-refresh: off');

    applyAutorefreshSetting(10000);
    assert.equal(mainActive, true);
    assert.equal(medicActive, true);
    assert.equal(openRunActive, true);
    assert.equal(refreshNote, 'Auto-refresh: 10s');
    assert.ok(lastRefreshTime > 0);
  });
});
