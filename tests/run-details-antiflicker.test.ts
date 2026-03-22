import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf-8');

describe('US-005: Anti-flicker opacity handling for Run Details panel', () => {
  it('CSS .panel rule includes transition property for opacity', () => {
    const panelCssStart = html.indexOf('.panel{');
    assert(panelCssStart !== -1, 'Should find .panel CSS rule');
    const panelCssEnd = html.indexOf('}', panelCssStart);
    const panelCss = html.slice(panelCssStart, panelCssEnd + 1);
    assert(panelCss.includes('transition:opacity 0.1s ease'), `Expected transition:opacity 0.1s ease in .panel CSS, got: ${panelCss}`);
  });

  it('CSS .panel transition is short (0.1s or less)', () => {
    const panelCssStart = html.indexOf('.panel{');
    const panelCssEnd = html.indexOf('}', panelCssStart);
    const panelCss = html.slice(panelCssStart, panelCssEnd + 1);
    // Extract the transition duration value
    const match = panelCss.match(/transition:opacity\s+([\d.]+)s/);
    assert(match, 'Should find opacity transition duration');
    const duration = parseFloat(match[1]);
    assert(duration <= 0.1, `Transition should be <= 0.1s to avoid sluggishness, got: ${duration}s`);
  });

  it('refreshOpenRunPanel sets panel opacity to 0.85 before re-rendering', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    assert(fnStart !== -1, 'Should find refreshOpenRunPanel function');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);
    assert(fnBody.includes("panel.style.opacity = '0.85'"), `Expected panel opacity set to 0.85 before render, got: ${fnBody}`);
  });

  it('refreshOpenRunPanel restores panel opacity to 1 after re-rendering', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);
    assert(fnBody.includes("panel.style.opacity = '1'"), `Expected panel opacity restored to 1 after render, got: ${fnBody}`);
  });

  it('opacity is set before renderRunPanel call and restored after', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);
    const dimIdx = fnBody.indexOf("panel.style.opacity = '0.85'");
    const renderIdx = fnBody.indexOf('renderRunPanel(');
    const restoreIdx = fnBody.indexOf("panel.style.opacity = '1'");
    assert(dimIdx !== -1, 'Should find dim opacity line');
    assert(renderIdx !== -1, 'Should find renderRunPanel call');
    assert(restoreIdx !== -1, 'Should find restore opacity line');
    assert(dimIdx < renderIdx, 'Opacity dim should come before renderRunPanel');
    assert(renderIdx < restoreIdx, 'renderRunPanel should come before opacity restore');
  });

  it('opacity changes are guarded with null checks on panel', () => {
    const fnStart = html.indexOf('async function refreshOpenRunPanel()');
    const fnEnd = html.indexOf('\n}', fnStart);
    const fnBody = html.slice(fnStart, fnEnd);
    // Both opacity lines should be wrapped in `if (panel)`
    const dimGuard = fnBody.includes("if (panel) panel.style.opacity = '0.85'");
    const restoreGuard = fnBody.includes("if (panel) panel.style.opacity = '1'");
    assert(dimGuard, 'Dim opacity should be guarded with null check on panel');
    assert(restoreGuard, 'Restore opacity should be guarded with null check on panel');
  });

  it('dist/server/index.html also contains transition property after build', () => {
    // dist is built from src — verify build copies the updated file
    // This test checks the source which is copied verbatim; the build must be run to sync dist
    // We test the source here — same pattern as other dist tests
    const distHtml = readFileSync(join(import.meta.dirname, '../dist/server/index.html'), 'utf-8');
    assert(distHtml.includes('transition:opacity 0.1s ease'), 'dist/.panel CSS should include transition after build');
  });
});
