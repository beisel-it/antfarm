import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(import.meta.dirname, '../src/server/index.html'), 'utf8');

describe('Backlog modal lifecycle – openBacklogForm / closeBacklogModal', () => {
  it('openBacklogForm() function is defined', () => {
    assert.ok(html.includes('function openBacklogForm()'), 'openBacklogForm() not found in HTML');
  });

  it('closeBacklogModal() function is defined', () => {
    assert.ok(html.includes('function closeBacklogModal()'), 'closeBacklogModal() not found in HTML');
  });

  it('openBacklogForm sets display:flex on overlay', () => {
    // The function should set overlay.style.display = 'flex'
    assert.ok(html.includes("overlay.style.display = 'flex'"), "openBacklogForm should set display to 'flex'");
  });

  it('openBacklogForm sets editingBacklogId to null', () => {
    // In the function body, editingBacklogId = null should appear
    const fnMatch = html.match(/function openBacklogForm\(\)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
    assert.ok(fnMatch, 'Could not extract openBacklogForm function body');
    assert.ok(fnMatch[0].includes('editingBacklogId = null'), 'openBacklogForm should set editingBacklogId = null');
  });

  it('openBacklogForm sets modal title to New Backlog Entry', () => {
    assert.ok(
      html.includes("heading.textContent = 'New Backlog Entry'"),
      "openBacklogForm should set heading to 'New Backlog Entry'"
    );
  });

  it('openBacklogForm focuses bm-title', () => {
    assert.ok(
      html.includes("document.getElementById('bm-title').focus()"),
      'openBacklogForm should call focus() on bm-title'
    );
  });

  it('closeBacklogModal hides the overlay', () => {
    // Should set display to none or remove open class
    const fnStart = html.indexOf('function closeBacklogModal()');
    assert.ok(fnStart !== -1, 'closeBacklogModal not found');
    const fnBody = html.slice(fnStart, fnStart + 400);
    assert.ok(
      fnBody.includes("overlay.style.display = 'none'"),
      "closeBacklogModal should set overlay.style.display = 'none'"
    );
  });

  it('closeBacklogModal removes open class from overlay', () => {
    const fnStart = html.indexOf('function closeBacklogModal()');
    const fnBody = html.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes("overlay.classList.remove('open')"), "closeBacklogModal should remove 'open' class");
  });

  it('closeBacklogModal resets editingBacklogId to null', () => {
    const fnStart = html.indexOf('function closeBacklogModal()');
    const fnBody = html.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes('editingBacklogId = null'), 'closeBacklogModal should set editingBacklogId = null');
  });

  it('closeBacklogModal resets the form', () => {
    const fnStart = html.indexOf('function closeBacklogModal()');
    const fnBody = html.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes('form.reset()'), 'closeBacklogModal should call form.reset()');
  });

  it('module-level editingBacklogId variable is declared', () => {
    assert.ok(html.includes('let editingBacklogId = null'), 'editingBacklogId variable not declared at module level');
  });

  it('overlay onclick closes modal when clicking background', () => {
    assert.ok(
      html.includes("onclick=\"if(event.target===this)closeBacklogModal()\""),
      'Overlay background click should close modal'
    );
  });

  it('Cancel button wired to closeBacklogModal', () => {
    assert.ok(
      html.includes('onclick="closeBacklogModal()"') || html.includes("onclick='closeBacklogModal()'"),
      'Cancel button should call closeBacklogModal()'
    );
  });

  it('panel-close button wired to closeBacklogModal', () => {
    // Should find a panel-close button inside the backlog modal that calls closeBacklogModal
    const modalSection = html.slice(html.indexOf('id="backlog-modal-overlay"'), html.indexOf('id="backlog-modal-overlay"') + 2000);
    assert.ok(
      modalSection.includes('panel-close') && modalSection.includes('closeBacklogModal()'),
      'panel-close button in modal should call closeBacklogModal()'
    );
  });

  it('+ Add button wired to openBacklogForm', () => {
    assert.ok(
      html.includes('onclick="openBacklogForm()"'),
      '+ Add button should call openBacklogForm()'
    );
  });
});
