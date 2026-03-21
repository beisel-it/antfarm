import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf8');

describe('US-010: Backlog modal visual alignment with run detail panel', () => {
  it('backlog modal uses .panel class (border-radius:12px, padding:24px, max-width:640px)', () => {
    // The panel is wrapped in a div with class="panel" id="backlog-modal"
    assert.ok(html.includes('class="panel" id="backlog-modal"'), 'Backlog modal must use .panel class');
    // .panel CSS must specify border-radius:12px
    const panelRule = html.match(/\.panel\{[^}]+\}/);
    assert.ok(panelRule, 'Missing .panel CSS rule');
    assert.ok(panelRule![0].includes('border-radius:12px'), '.panel must have border-radius:12px');
    assert.ok(panelRule![0].includes('padding:24px'), '.panel must have padding:24px');
    assert.ok(panelRule![0].includes('max-width:640px'), '.panel must have max-width:640px');
    assert.ok(panelRule![0].includes('box-shadow'), '.panel must have box-shadow');
  });

  it('form inputs use var(--bg-surface) background matching .project-add-form input', () => {
    const fieldInputRule = html.match(/\.backlog-modal-field input,[^{]*\{([^}]+)\}/);
    assert.ok(fieldInputRule, 'Missing .backlog-modal-field input rule');
    assert.ok(fieldInputRule![1].includes('background:var(--bg-surface)'), 'Input background must be var(--bg-surface)');
  });

  it('form inputs use border-radius:4px matching .project-add-form input', () => {
    const fieldInputRule = html.match(/\.backlog-modal-field input,[^{]*\{([^}]+)\}/);
    assert.ok(fieldInputRule, 'Missing .backlog-modal-field input rule');
    assert.ok(fieldInputRule![1].includes('border-radius:4px'), 'Input border-radius must be 4px');
  });

  it('form inputs use font-size:12px matching .project-add-form input', () => {
    const fieldInputRule = html.match(/\.backlog-modal-field input,[^{]*\{([^}]+)\}/);
    assert.ok(fieldInputRule, 'Missing .backlog-modal-field input rule');
    assert.ok(fieldInputRule![1].includes('font-size:12px'), 'Input font-size must be 12px');
  });

  it('form inputs use padding:5px 8px matching .project-add-form input', () => {
    const fieldInputRule = html.match(/\.backlog-modal-field input,[^{]*\{([^}]+)\}/);
    assert.ok(fieldInputRule, 'Missing .backlog-modal-field input rule');
    assert.ok(fieldInputRule![1].includes('padding:5px 8px'), 'Input padding must be 5px 8px');
  });

  it('form inputs have focus style using var(--accent-teal) border', () => {
    assert.ok(
      html.includes('.backlog-modal-field input:focus,.backlog-modal-field textarea:focus{border-color:var(--accent-teal)}'),
      'Focus style must use var(--accent-teal)'
    );
  });

  it('form labels have font-weight:500', () => {
    assert.ok(
      html.includes('.backlog-modal-field label{') && html.includes('font-weight:500'),
      'Label must have font-weight:500'
    );
    // Make sure it's in the label rule
    const labelRule = html.match(/\.backlog-modal-field label\{([^}]+)\}/);
    assert.ok(labelRule, 'Missing .backlog-modal-field label rule');
    assert.ok(labelRule![1].includes('font-weight:500'), 'Label font-weight must be 500');
  });

  it('form labels use var(--text-secondary) color', () => {
    const labelRule = html.match(/\.backlog-modal-field label\{([^}]+)\}/);
    assert.ok(labelRule, 'Missing .backlog-modal-field label rule');
    assert.ok(labelRule![1].includes('color:var(--text-secondary)'), 'Label color must be var(--text-secondary)');
  });

  it('actions row has justify-content:flex-end', () => {
    const actionsRule = html.match(/\.backlog-modal-actions\{([^}]+)\}/);
    assert.ok(actionsRule, 'Missing .backlog-modal-actions rule');
    assert.ok(actionsRule![1].includes('justify-content:flex-end'), 'Actions row must be justify-content:flex-end');
  });

  it('actions row has gap:8px', () => {
    const actionsRule = html.match(/\.backlog-modal-actions\{([^}]+)\}/);
    assert.ok(actionsRule, 'Missing .backlog-modal-actions rule');
    assert.ok(actionsRule![1].includes('gap:8px'), 'Actions row must have gap:8px');
  });

  it('save button matches .project-form-submit (accent-green, white, font-weight:600)', () => {
    const saveRule = html.match(/\.backlog-modal-save-btn\{([^}]+)\}/);
    assert.ok(saveRule, 'Missing .backlog-modal-save-btn rule');
    assert.ok(saveRule![1].includes('background:var(--accent-green)'), 'Save button must use var(--accent-green)');
    assert.ok(saveRule![1].includes('color:#fff'), 'Save button must have white text');
    assert.ok(saveRule![1].includes('font-weight:600'), 'Save button must have font-weight:600');
    assert.ok(saveRule![1].includes('border-radius:4px'), 'Save button must have border-radius:4px matching project-form-submit');
  });

  it('cancel button matches .project-form-cancel (no fill, border, secondary color)', () => {
    const cancelRule = html.match(/\.backlog-modal-cancel-btn\{([^}]+)\}/);
    assert.ok(cancelRule, 'Missing .backlog-modal-cancel-btn rule');
    assert.ok(cancelRule![1].includes('background:none'), 'Cancel button must have no background fill');
    assert.ok(cancelRule![1].includes('border:1px solid var(--border)'), 'Cancel button must have border');
    assert.ok(cancelRule![1].includes('color:var(--text-secondary)'), 'Cancel button must use var(--text-secondary)');
  });

  it('no hardcoded color values in backlog modal CSS rules', () => {
    // Check save btn only uses CSS vars for colors (not hardcoded hex/rgb) except #fff (white)
    const saveRule = html.match(/\.backlog-modal-save-btn\{([^}]+)\}/);
    assert.ok(saveRule, 'Missing .backlog-modal-save-btn rule');
    // #fff is acceptable as a standard white constant
    const saveWithoutWhite = saveRule![1].replace('#fff', '');
    assert.ok(!saveWithoutWhite.match(/#[0-9a-fA-F]{3,6}/), 'No hardcoded hex colors in save btn (besides #fff)');

    const cancelRule = html.match(/\.backlog-modal-cancel-btn\{([^}]+)\}/);
    assert.ok(cancelRule, 'Missing .backlog-modal-cancel-btn rule');
    assert.ok(!cancelRule![1].match(/#[0-9a-fA-F]{3,6}/), 'No hardcoded hex colors in cancel btn');
  });

  it('panel shadow uses var(--shadow-heavy)', () => {
    const panelRule = html.match(/\.panel\{[^}]+\}/);
    assert.ok(panelRule, 'Missing .panel CSS rule');
    assert.ok(panelRule![0].includes('var(--shadow-heavy)'), '.panel must use var(--shadow-heavy)');
  });
});
