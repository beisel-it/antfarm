// Preloaded via --import before any test files run.
// Redirects the database to a temp file so tests never touch the live DB.
import os from "node:os";
import path from "node:path";

const testDb = path.join(os.tmpdir(), `antfarm-test-${process.pid}.db`);
process.env.ANTFARM_DB_PATH = testDb;
process.env.ANTFARM_SKIP_CRON = '1'; // Prevent tests from creating real cron jobs in the production gateway

// Defence-in-depth: block any fetch call to the local gateway URL.
// This catches code paths that bypass ANTFARM_SKIP_CRON and would otherwise
// silently pollute the production gateway during tests.
// Tests that intentionally mock globalThis.fetch (e.g. gateway-api-model.test.ts)
// will replace this guard with their own mock and restore it in afterEach.
const originalFetch = globalThis.fetch;
globalThis.fetch = function guardedFetch(url, ...args) {
  const urlStr = typeof url === 'string' ? url : String(url);
  if (urlStr.includes('127.0.0.1:18789') || urlStr.includes('localhost:18789')) {
    throw new Error(
      `[antfarm-test] Blocked gateway fetch to ${urlStr}. Tests must not call the production gateway. Set ANTFARM_SKIP_CRON=1 or mock fetch.`
    );
  }
  return originalFetch.call(this, url, ...args);
};
