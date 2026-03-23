// Preloaded via --import before any test files run.
// Redirects the database to a temp file so tests never touch the live DB.
import os from "node:os";
import path from "node:path";

const testDb = path.join(os.tmpdir(), `antfarm-test-${process.pid}.db`);
process.env.ANTFARM_DB_PATH = testDb;
process.env.ANTFARM_SKIP_CRON = '1'; // Prevent tests from creating real cron jobs in the production gateway
