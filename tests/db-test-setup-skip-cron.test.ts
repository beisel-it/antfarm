// Tests that db-test-setup.js sets ANTFARM_SKIP_CRON=1
// This file is loaded with --import ./tests/db-test-setup.js, so by the time
// this test runs, the preload has already executed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('db-test-setup.js preload', () => {
  it('sets ANTFARM_SKIP_CRON to "1"', () => {
    assert.equal(process.env.ANTFARM_SKIP_CRON, '1');
  });

  it('sets ANTFARM_DB_PATH to a temp path', () => {
    assert.ok(process.env.ANTFARM_DB_PATH, 'ANTFARM_DB_PATH should be set');
    assert.ok(
      process.env.ANTFARM_DB_PATH.includes('antfarm-test-'),
      `ANTFARM_DB_PATH should contain "antfarm-test-", got: ${process.env.ANTFARM_DB_PATH}`
    );
  });

  it('ANTFARM_DB_PATH does not point to the live database', () => {
    const dbPath = process.env.ANTFARM_DB_PATH ?? '';
    assert.ok(!dbPath.includes('.openclaw/workspace/antfarm'), 
      'DB path should not point to the live database location');
  });
});
