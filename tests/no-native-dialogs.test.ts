import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression test: ensure no native alert()/confirm()/prompt() calls
 * remain in the built index.html script block.
 *
 * This is a fast string scan — no browser or DOM required.
 */
describe('no-native-dialogs', () => {
  let html: string;

  try {
    html = readFileSync(join(process.cwd(), 'dist/server/index.html'), 'utf-8');
  } catch {
    // If build artifact doesn't exist yet, fall back to src
    html = readFileSync(join(process.cwd(), 'src/server/index.html'), 'utf-8');
  }

  // Extract the <script> block content
  const scriptStart = html.indexOf('<script>');
  const scriptEnd = html.lastIndexOf('</script>');
  assert.ok(scriptStart !== -1, 'Expected a <script> block in index.html');
  assert.ok(scriptEnd !== -1, 'Expected closing </script> in index.html');
  const scriptContent = html.slice(scriptStart, scriptEnd);

  it('contains zero occurrences of native confirm( in script block', () => {
    // Allow showConfirmModal( and other "confirm"-containing strings that are not native confirm()
    // We need to ensure that bare `confirm(` (not preceded by alphanumeric or underscore) is absent
    const matches = [...scriptContent.matchAll(/(?<![a-zA-Z0-9_])confirm\s*\(/g)];
    assert.equal(
      matches.length,
      0,
      `Found ${matches.length} native confirm() call(s) in script block. ` +
      `Occurrences at positions: ${matches.map(m => m.index).join(', ')}`
    );
  });

  it('contains zero occurrences of native alert( in script block', () => {
    const matches = [...scriptContent.matchAll(/(?<![a-zA-Z0-9_])alert\s*\(/g)];
    assert.equal(
      matches.length,
      0,
      `Found ${matches.length} native alert() call(s) in script block. ` +
      `Occurrences at positions: ${matches.map(m => m.index).join(', ')}`
    );
  });

  it('contains zero occurrences of native prompt( in script block', () => {
    const matches = [...scriptContent.matchAll(/(?<![a-zA-Z0-9_])prompt\s*\(/g)];
    assert.equal(
      matches.length,
      0,
      `Found ${matches.length} native prompt() call(s) in script block. ` +
      `Occurrences at positions: ${matches.map(m => m.index).join(', ')}`
    );
  });

  it('uses showConfirmModal helper for confirmations', () => {
    assert.ok(
      scriptContent.includes('showConfirmModal('),
      'Expected showConfirmModal( to be present in script block (styled modal helper)'
    );
  });

  it('uses closeConfirmModal helper', () => {
    assert.ok(
      scriptContent.includes('closeConfirmModal('),
      'Expected closeConfirmModal( to be present in script block'
    );
  });
});
