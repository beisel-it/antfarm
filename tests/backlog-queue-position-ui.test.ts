/**
 * US-007: Show queue position indicator on queued backlog cards
 * Tests that the Q#N badge is rendered when entry.status === 'queued' and queue_order is set
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load the built HTML (UI tests check dist/server/index.html)
const html = readFileSync(join(process.cwd(), 'dist/server/index.html'), 'utf8');

// Extract renderBacklogColumn function body
const fnStart = html.indexOf('function renderBacklogColumn(');
assert.ok(fnStart !== -1, 'renderBacklogColumn function must exist');

// Find the end of the function by finding the next top-level function
const fnBody = html.slice(fnStart, fnStart + 6000);

describe('US-007: Queue position indicator', () => {

  describe('AC1: GET /api/backlog includes queue_order', () => {
    it('renderBacklogColumn accesses entry.queue_order', () => {
      assert.ok(fnBody.includes('entry.queue_order'), 'renderBacklogColumn must reference entry.queue_order');
    });
  });

  describe('AC2: When status === queued, render Q#N indicator', () => {
    it('queuePosHTML variable is defined', () => {
      assert.ok(fnBody.includes('queuePosHTML'), 'queuePosHTML variable must exist');
    });

    it('Q# prefix is used in the badge', () => {
      assert.ok(fnBody.includes('Q#'), 'Q# prefix must be used in the queue position badge');
    });

    it('queue_order is used in Q# badge', () => {
      assert.ok(
        fnBody.includes('entry.queue_order') && fnBody.includes('Q#'),
        'Queue position badge must use entry.queue_order with Q# prefix'
      );
    });

    it('badge-queue-pos class is used for the position badge', () => {
      assert.ok(fnBody.includes('badge-queue-pos'), 'badge-queue-pos CSS class must be used');
    });
  });

  describe('AC3: Queue position is derived from entry.queue_order', () => {
    it('queuePosHTML uses entry.queue_order != null check', () => {
      assert.ok(
        fnBody.includes('entry.queue_order != null') || fnBody.includes('entry.queue_order !== null'),
        'queuePosHTML must check that queue_order is not null'
      );
    });

    it('queuePosHTML is included in queuedIndicatorHTML', () => {
      // queuedIndicatorHTML should include ${queuePosHTML}
      assert.ok(
        fnBody.includes('${queuePosHTML}'),
        'queuedIndicatorHTML must include queuePosHTML template'
      );
    });
  });

  describe('AC4: CSS for queue position badge exists', () => {
    it('CSS rule .badge-queue-pos exists in the style block', () => {
      assert.ok(html.includes('.badge-queue-pos'), 'CSS class .badge-queue-pos must exist');
    });

    it('.badge-queue-pos has basic styling', () => {
      // Should have border-radius, font-size, or similar
      const cssIdx = html.indexOf('.badge-queue-pos');
      assert.ok(cssIdx !== -1, '.badge-queue-pos must be in CSS');
      const cssRule = html.slice(cssIdx, cssIdx + 200);
      // Check it has some visual styling properties
      const hasStyle = cssRule.includes('border-radius') || cssRule.includes('font-size') || cssRule.includes('padding');
      assert.ok(hasStyle, '.badge-queue-pos must have visual CSS properties (border-radius, font-size, or padding)');
    });
  });

  describe('AC5: Functional verification', () => {
    it('queuePosHTML is only shown when isQueued is true', () => {
      // The condition uses isQueued check
      assert.ok(
        fnBody.includes('isQueued && entry.queue_order'),
        'queuePosHTML must be conditioned on isQueued'
      );
    });

    it('queuedIndicatorHTML includes queuePosHTML before badge-queued', () => {
      const queuedIndicatorIdx = fnBody.indexOf('queuedIndicatorHTML = isQueued');
      assert.ok(queuedIndicatorIdx !== -1, 'queuedIndicatorHTML assignment must exist');
      const afterAssign = fnBody.slice(queuedIndicatorIdx, queuedIndicatorIdx + 300);
      const posBadgeIdx = afterAssign.indexOf('queuePosHTML');
      const queuedBadgeIdx = afterAssign.indexOf('badge-queued');
      assert.ok(posBadgeIdx !== -1, 'queuedIndicatorHTML must include queuePosHTML');
      assert.ok(queuedBadgeIdx !== -1, 'queuedIndicatorHTML must include badge-queued span');
      // Q# position badge should appear before the Queued ✓ badge
      assert.ok(posBadgeIdx < queuedBadgeIdx, 'Q# position badge must appear before Queued badge');
    });
  });

});
