import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '../dist/server/index.html'), 'utf-8');

describe('Loop group CSS classes in dist/server/index.html', () => {
  test('AC1: .loop-group CSS class exists with border and border-radius', () => {
    assert.ok(html.includes('.loop-group'), '.loop-group class should exist');
    assert.ok(
      /\.loop-group\{[^}]*border:[^}]*var\(--accent-teal\)/.test(html) ||
      /\.loop-group\{[^}]*border-color:[^}]*var\(--accent-teal\)/.test(html),
      '.loop-group should have border using var(--accent-teal)'
    );
    assert.ok(
      /\.loop-group\{[^}]*border-radius:/.test(html),
      '.loop-group should have border-radius'
    );
  });

  test('AC2: .loop-group-steps CSS class exists with left indent', () => {
    assert.ok(html.includes('.loop-group-steps'), '.loop-group-steps class should exist');
    const hasIndent =
      /\.loop-group-steps\{[^}]*padding-left:\s*\d+/.test(html) ||
      /\.loop-group-steps\{[^}]*margin-left:\s*\d+/.test(html);
    assert.ok(hasIndent, '.loop-group-steps should have padding-left or margin-left indent');
  });

  test('AC3: .loop-badge CSS class exists and produces a circular element', () => {
    assert.ok(html.includes('.loop-badge'), '.loop-badge class should exist');
    assert.ok(
      /\.loop-badge\{[^}]*border-radius:50%/.test(html),
      '.loop-badge should be circular (border-radius: 50%)'
    );
  });

  test('AC4: Loop badge uses conic-gradient or SVG for filling arc', () => {
    // The badge uses SVG inline approach (conic-gradient applied via SVG or inline)
    // We check that the badge wrapper exists and badge uses a fill approach
    const hasConic = html.includes('conic-gradient');
    const hasSvg = html.includes('.loop-badge svg') || html.includes('loop-badge') && html.includes('<svg');
    assert.ok(
      hasConic || hasSvg,
      'Loop badge should use conic-gradient or SVG to show filling arc'
    );
  });

  test('AC5: Loop group uses CSS custom properties that work in dark theme (accent-teal token)', () => {
    // Check that --loop-border is defined in :root
    assert.ok(
      html.includes('--loop-border'),
      '--loop-border custom property should be defined'
    );
    // Check that loop-group uses var(--accent-teal) — which is redefined in dark theme
    assert.ok(
      html.includes('var(--accent-teal)') && html.includes('.loop-group'),
      'Loop group should reference var(--accent-teal) which adapts to dark theme'
    );
    // Verify dark theme redefines --accent-teal
    const darkSection = html.indexOf('[data-theme="dark"]');
    assert.ok(darkSection > 0, 'Dark theme section should exist');
    const darkContent = html.slice(darkSection, darkSection + 1200);
    assert.ok(
      darkContent.includes('--accent-teal'),
      '--accent-teal should be redefined in dark theme'
    );
  });

  test('AC6: .loop-group-label CSS class exists', () => {
    assert.ok(html.includes('.loop-group-label'), '.loop-group-label class should exist');
  });

  test('AC7: .loop-badge-wrapper CSS class exists for positioning', () => {
    assert.ok(html.includes('.loop-badge-wrapper'), '.loop-badge-wrapper class should exist');
  });

  test('--loop-border custom property is defined in :root', () => {
    const rootIdx = html.indexOf(':root {');
    const rootEnd = html.indexOf('}', rootIdx);
    const rootBlock = html.slice(rootIdx, rootEnd + 1);
    assert.ok(
      rootBlock.includes('--loop-border'),
      '--loop-border should be declared in :root block'
    );
  });
});
