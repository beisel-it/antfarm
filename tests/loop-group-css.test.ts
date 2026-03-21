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

  test('AC3: .loop-badge CSS class is removed (replaced by .loop-counter in header)', () => {
    // US-002: The circular badge was replaced by an inline counter in the header
    const cssSection = html.slice(html.indexOf('<style'), html.indexOf('</style>'));
    assert.ok(!cssSection.includes('.loop-badge{'), '.loop-badge CSS rule should be removed (replaced by .loop-counter)');
  });

  test('AC4: .loop-counter CSS class exists (replaces old conic-gradient badge)', () => {
    // US-002: Counter is now an inline span in the header, not a conic-gradient badge
    assert.ok(html.includes('.loop-counter'), '.loop-counter CSS class should exist');
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

  test('AC7: .loop-badge-wrapper CSS class is removed (no longer needed)', () => {
    // US-002: Badge wrapper between steps removed; counter is now in the header
    assert.ok(!html.includes('.loop-badge-wrapper'), '.loop-badge-wrapper CSS class should be removed');
  });

  test('US-001 AC1: .loop-group-label::before with content ↻ is removed', () => {
    assert.ok(
      !html.includes(".loop-group-label::before"),
      '.loop-group-label::before pseudo-element rule should be removed'
    );
  });

  test('US-001 AC2: .loop-counter CSS class exists with font-size, font-weight, and color', () => {
    assert.ok(html.includes('.loop-counter'), '.loop-counter class should exist');
    assert.ok(
      /\.loop-counter\{[^}]*font-size:/.test(html),
      '.loop-counter should have font-size property'
    );
    assert.ok(
      /\.loop-counter\{[^}]*font-weight:/.test(html),
      '.loop-counter should have font-weight property'
    );
    assert.ok(
      /\.loop-counter\{[^}]*color:/.test(html),
      '.loop-counter should have color property'
    );
  });

  test('US-001 AC3: .loop-counter is not display:block (renders inline)', () => {
    // Verify it does not use display:block
    assert.ok(
      !/\.loop-counter\{[^}]*display:block/.test(html),
      '.loop-counter should not use display:block'
    );
    // It should use inline, inline-flex, or inline-block
    const hasInlineDisplay =
      /\.loop-counter\{[^}]*display:inline/.test(html) ||
      !/\.loop-counter\{[^}]*display:/.test(html); // absence of display:block is also fine
    assert.ok(hasInlineDisplay, '.loop-counter should render inline');
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
