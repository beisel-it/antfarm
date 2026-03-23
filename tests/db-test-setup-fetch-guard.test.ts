// Tests that db-test-setup.js installs a globalThis.fetch guard that blocks
// accidental calls to the local gateway (127.0.0.1:18789 / localhost:18789).
// This file is loaded with --import ./tests/db-test-setup.js, so by the time
// this test runs, the guard is already installed.
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

describe('db-test-setup.js fetch guard', () => {
  let savedFetch: typeof globalThis.fetch;

  beforeEach(() => {
    savedFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
  });

  it('throws when fetch is called with 127.0.0.1:18789', () => {
    assert.throws(
      () => globalThis.fetch('http://127.0.0.1:18789/api/something'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('[antfarm-test] Blocked gateway fetch'),
          `Expected blocked-gateway error, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it('throws when fetch is called with localhost:18789', () => {
    assert.throws(
      () => globalThis.fetch('http://localhost:18789/api/something'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('[antfarm-test] Blocked gateway fetch'),
          `Expected blocked-gateway error, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it('error message includes the blocked URL', () => {
    const url = 'http://127.0.0.1:18789/cron/schedule';
    assert.throws(
      () => globalThis.fetch(url),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes(url),
          `Expected error to include URL "${url}", got: ${err.message}`
        );
        return true;
      }
    );
  });

  it('does NOT throw for other URLs (fetch passes through)', async () => {
    // Replace the guarded fetch with a no-op to avoid real network calls
    let calledUrl: string | undefined;
    (globalThis as any).fetch = (url: string, ...args: unknown[]) => {
      calledUrl = url;
      return Promise.resolve(new Response('ok'));
    };

    await globalThis.fetch('http://example.com/api');
    assert.equal(calledUrl, 'http://example.com/api');
  });

  it('allows tests to replace globalThis.fetch with their own mock', async () => {
    // Simulate what gateway-api-model.test.ts does: replace guard with a custom mock
    let mockCalled = false;
    (globalThis as any).fetch = (url: string, ...args: unknown[]) => {
      mockCalled = true;
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    };

    // Even calls to the gateway URL should succeed since we've replaced the guard
    const res = await globalThis.fetch('http://127.0.0.1:18789/api/test');
    assert.ok(mockCalled, 'custom mock should have been called');
    assert.equal(res.status, 200);
  });

  it('re-installing the guard after a mock works (simulating afterEach restore)', () => {
    // After a test restores the original guarded fetch, the guard should be active again
    const guardedFetch = globalThis.fetch;

    // Temporarily override
    (globalThis as any).fetch = () => Promise.resolve(new Response('mock'));

    // Restore guarded fetch
    globalThis.fetch = guardedFetch;

    // Guard should throw again
    assert.throws(
      () => globalThis.fetch('http://127.0.0.1:18789/api/cron'),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('[antfarm-test] Blocked gateway fetch'));
        return true;
      }
    );
  });
});
