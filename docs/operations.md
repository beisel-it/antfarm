# Operations Guide

How to monitor, debug, and manually unstick Antfarm workflow runs.

---

## Monitoring a Run

### Check Status

```bash
# By task substring
antfarm workflow status "OAuth"

# By run ID prefix
antfarm workflow status a1fdf5

# By run number
antfarm workflow status "#42"

# List all runs
antfarm workflow runs
```

Status output:
```
Run #42: a1fdf573-...
Workflow: feature-dev
Task: Add user authentication with OAuth
Status: running
Started: 2026-03-22 14:23:11

Steps:
  [done   ] plan (planner)          claimed 14:23:15  finished 14:31:02
  [done   ] setup (setup)           claimed 14:31:10  finished 14:38:44
  [running] implement (developer)   claimed 14:39:01  Stories: 3/7 done
  [pending] verify (verifier)
  [waiting] test (tester)
  [waiting] pr (developer)
  [waiting] review (reviewer)
```

### Step Status Meanings

| Status | Meaning | Action needed? |
|--------|---------|----------------|
| `waiting` | Earlier step not yet done | None — waiting on prerequisite |
| `pending` | Ready, waiting for agent to claim | None — agent will pick it up in ≤5 min |
| `running` | Agent is working | None — unless it's been running too long |
| `done` | Completed successfully | None |
| `failed` | Retries exhausted | Investigate → resume or stop |
| `skipped` | Bypassed by pipeline | None |

### Story Progress (for loop steps)

```bash
antfarm step stories <run-id>
```

Output:
```
S-1  Create database schema     done    retries: 0  claimed: 14:39:01  finished: 14:52:18
S-2  Add registration endpoint  done    retries: 1  claimed: 14:52:30  finished: 15:08:44
S-3  Add login form             running retries: 0  claimed: 15:09:02
S-4  Add OAuth callback         pending retries: 0
S-5  Write integration tests    pending retries: 0
```

### Event Log

```bash
antfarm logs <run-id>           # All events for this run
antfarm logs                    # Last 50 events across all runs
antfarm logs 100                # Last 100 events
```

Events show step transitions, context updates, story completions, and errors.

### Dashboard

```bash
antfarm dashboard               # Start web UI on :3333
```

Shows real-time step status, timing, story progress, and event log for all runs.

---

## Understanding Stuck States

There are three distinct stuck states, each with different causes and remediation.

### Stuck Step

**Symptom:** Step status = `running`, `claimed_at` is set, but no progress and no
`finished_at`. The agent that claimed it has stopped (crashed, timed out, lost session).

**Detection:**
- Step has been `running` for longer than the agent's role timeout + 5 min
- Medic's `checkStuckSteps` auto-detects this

**Auto-remediation:** Medic resets stuck steps to `pending` automatically (within the
next medic cron cycle). After 5 resets (`abandoned_count >= 5`), the step is permanently
failed.

**Manual check via SQL:**
```sql
SELECT s.step_id, s.agent_id, s.status, s.claimed_at, s.updated_at, s.abandoned_count,
       ROUND((julianday('now') - julianday(s.updated_at)) * 1440, 1) AS minutes_stuck
FROM steps s JOIN runs r ON r.id = s.run_id
WHERE s.status = 'running' AND r.status = 'running'
ORDER BY s.updated_at ASC;
```

---

### Stalled Run

**Symptom:** Run is `running`, all steps look fine (none obviously stuck), but nothing
is advancing. No step has transitioned in a long time.

**Common causes:**
- Cron jobs for the workflow's agents were deleted or are failing
- OpenClaw itself is down or not processing crons
- All agents are polling but getting `NO_WORK` (DB inconsistency)

**Medic behavior:** Detects and alerts but does NOT auto-fix. Requires human decision.

**Detection:** Medic flags stalled runs with severity `critical`.

---

### Dead Run

**Symptom:** Run status = `running`, but all steps are in terminal states (done, failed,
or skipped). The run never got marked done or failed.

**Cause:** Pipeline advancement failed silently after the last step completed.

**Auto-remediation:** Medic detects and marks the run done or failed automatically.

---

## Triage Checklist

When a workflow isn't progressing, work through these in order:

**1. Check run and step status**
```bash
antfarm workflow status "<task>"
```
Note which step is `running` or `pending`. Check `claimed_at` timestamps.

**2. Check event log**
```bash
antfarm logs <run-id>
```
Look for error events, unexpected transitions, or gaps in activity.

**3. Run Medic**
```bash
antfarm medic run
```
Medic will detect and fix stuck steps, dead runs, and orphaned crons. Read the output carefully.

**4. Check story status** (if a loop step is involved)
```bash
antfarm step stories <run-id>
```
Look for stories stuck in `running`, or high `retry_count`.

**5. Check crons** (if Medic doesn't resolve it)
```bash
antfarm medic status          # Shows if crons are failing
antfarm workflow ensure-crons <workflow-id>   # Recreate missing crons
```

**6. Try manual unstick** (see below)

---

## Unsticking via CLI

### Let Medic Fix It (preferred)

```bash
antfarm medic run
```

Handles: stuck steps, dead runs, orphaned crons.

### Resume a Failed Run

```bash
antfarm workflow resume <run-id>
```

Resets the most recently failed step to `pending`. Use after:
- Fixing the underlying cause of failure (broken test, missing credential)
- Manually inspecting and deciding the step should retry

### Stop a Run

```bash
antfarm workflow stop <run-id>
```

Cancels the run and marks all non-terminal steps as failed. Use when you want to
abandon a run entirely.

### Recreate Missing Crons

```bash
antfarm workflow ensure-crons <workflow-id>
```

Use if agents have stopped polling (cron jobs were deleted or never created).

---

## Manually Triggering an Agent

Agents poll every 5 minutes via cron. To force an immediate execution without waiting:

1. Identify the cron job name: `antfarm/<workflow-id>/<agent-id>`
   - Example: `antfarm/feature-dev/developer`

2. Use the OpenClaw `cron` tool with action `run` on that job name.

This fires the agent's polling session immediately. If work is pending, the agent will
claim and execute it.

---

## DB Diagnostic Queries

Connect to the database:
```bash
sqlite3 ~/.openclaw/antfarm/antfarm.db
```

Or override the path: `ANTFARM_DB_PATH=/custom/path/antfarm.db sqlite3 ...`

### All Active Runs
```sql
SELECT run_number, substr(id, 1, 8) as id, workflow_id, task, status, created_at
FROM runs
WHERE status NOT IN ('done', 'failed', 'cancelled')
ORDER BY created_at DESC;
```

### Steps for a Specific Run
```sql
SELECT step_index, step_id, agent_id, type, status,
       retry_count, max_retries, abandoned_count,
       claimed_at, finished_at,
       ROUND((julianday('now') - julianday(updated_at)) * 1440, 1) AS mins_since_update
FROM steps
WHERE run_id = '<run-uuid>'
ORDER BY step_index;
```

### Find Stuck Steps (running longer than 40 minutes)
```sql
SELECT r.run_number, s.step_id, s.agent_id, s.status,
       s.claimed_at, s.updated_at, s.abandoned_count,
       ROUND((julianday('now') - julianday(s.updated_at)) * 1440, 1) AS minutes_stuck
FROM steps s
JOIN runs r ON r.id = s.run_id
WHERE s.status = 'running'
  AND r.status NOT IN ('done', 'failed', 'cancelled')
  AND (julianday('now') - julianday(s.updated_at)) * 1440 > 40
ORDER BY s.updated_at ASC;
```

### Story Status for a Run
```sql
SELECT story_id, title, status, retry_count, max_retries,
       claimed_at, finished_at
FROM stories
WHERE run_id = '<run-uuid>'
ORDER BY story_index;
```

### Failed Stories
```sql
SELECT r.run_number, s.story_id, s.title, s.status,
       s.retry_count, s.max_retries,
       substr(s.output, 1, 200) AS output_preview
FROM stories s
JOIN runs r ON r.id = s.run_id
WHERE s.status = 'failed'
ORDER BY s.updated_at DESC;
```

### Run Context (accumulated variables)
```sql
SELECT json_pretty(context) AS context
FROM runs
WHERE id = '<run-uuid>';
```

### Recent Medic Check Results
```sql
SELECT checked_at, issues_found, actions_taken, summary
FROM medic_checks
ORDER BY checked_at DESC
LIMIT 10;
```

### Dead Runs (status=running but all steps terminal)
```sql
SELECT r.run_number, substr(r.id, 1, 8) as id, r.task, r.status
FROM runs r
WHERE r.status = 'running'
  AND NOT EXISTS (
    SELECT 1 FROM steps s
    WHERE s.run_id = r.id
      AND s.status NOT IN ('done', 'failed', 'skipped')
  );
```

---

## Manual DB Interventions

Use these only when CLI commands are insufficient. Always verify with a SELECT first.

### Reset a Stuck Step to Pending

```sql
-- Verify first
SELECT id, step_id, status, claimed_at, abandoned_count
FROM steps WHERE id = '<step-uuid>';

-- Then reset
UPDATE steps
SET status = 'pending',
    claimed_at = NULL,
    session_key = NULL,
    abandoned_count = abandoned_count + 1,
    updated_at = datetime('now')
WHERE id = '<step-uuid>'
  AND status = 'running';
```

### Force Fail a Step

```sql
UPDATE steps
SET status = 'failed',
    finished_at = datetime('now'),
    updated_at = datetime('now')
WHERE id = '<step-uuid>';
```

After doing this, mark the run appropriately (see below) or use `antfarm workflow resume`.

### Reset a Story to Pending

```sql
UPDATE stories
SET status = 'pending',
    claimed_at = NULL,
    retry_count = retry_count + 1,
    updated_at = datetime('now')
WHERE id = '<story-uuid>'
  AND status IN ('running', 'failed');
```

### Mark a Run Done

```sql
UPDATE runs
SET status = 'done',
    updated_at = datetime('now')
WHERE id = '<run-uuid>';
```

### Mark a Run Failed

```sql
UPDATE runs
SET status = 'failed',
    updated_at = datetime('now')
WHERE id = '<run-uuid>';
```

### Update Run Context (inject a missing variable)

```sql
-- Add or update a key in the context JSON
UPDATE runs
SET context = json_set(context, '$.my_key', 'my_value'),
    updated_at = datetime('now')
WHERE id = '<run-uuid>';
```

Useful when a step failed because a context variable was missing or wrong, and you want to
inject the correct value before resuming.

---

## Recovery Procedures

### Scenario: Step stuck in running, agent crashed

1. Run `antfarm medic run` — usually resolves automatically
2. If Medic doesn't pick it up (e.g., not within timeout threshold yet):
   ```sql
   UPDATE steps SET status = 'pending', claimed_at = NULL,
     abandoned_count = abandoned_count + 1, updated_at = datetime('now')
   WHERE id = '<step-uuid>' AND status = 'running';
   ```
3. Agent will re-claim on next poll cycle

---

### Scenario: Step repeatedly failing (abandoned_count approaching 5)

1. Read the step output to understand why it keeps failing:
   ```sql
   SELECT output FROM steps WHERE id = '<step-uuid>';
   ```
2. If it's a timeout issue: increase `timeoutSeconds` in workflow.yml and reinstall
3. If it's a code/environment issue: fix the underlying problem
4. If `abandoned_count` has reached 5 (permanently failed): use `antfarm workflow resume`
   after fixing the cause

---

### Scenario: Run blocked, awaiting human

Status = `blocked` means `escalate_to: human` was triggered.

1. Check which step triggered escalation:
   ```bash
   antfarm workflow status "<query>"
   ```
2. Read that step's output:
   ```sql
   SELECT step_id, output, retry_count FROM steps
   WHERE run_id = '<run-uuid>' AND status = 'failed';
   ```
3. Fix the underlying issue (review code, provide missing info, etc.)
4. Resume the run:
   ```bash
   antfarm workflow resume <run-id>
   ```

---

### Scenario: Crons not firing (agents not polling)

1. Run Medic to detect orphaned/failing crons:
   ```bash
   antfarm medic run
   ```
2. Recreate missing crons:
   ```bash
   antfarm workflow ensure-crons <workflow-id>
   ```
3. If OpenClaw cron system is down, restart OpenClaw and re-run ensure-crons

---

### Scenario: Context variable missing (step failing with [missing: key])

1. Check what variables are in context:
   ```sql
   SELECT json_pretty(context) FROM runs WHERE id = '<run-uuid>';
   ```
2. Identify which step should have produced the missing key
3. Check that step's output:
   ```sql
   SELECT step_id, output FROM steps
   WHERE run_id = '<run-uuid>' AND step_id = 'the-step-that-should-produce-it';
   ```
4. If the key is missing from output, the agent didn't emit it — inject manually:
   ```sql
   UPDATE runs SET context = json_set(context, '$.missing_key', 'correct_value'),
     updated_at = datetime('now') WHERE id = '<run-uuid>';
   ```
5. Resume the run:
   ```bash
   antfarm workflow resume <run-id>
   ```

---

### Scenario: Loop step stuck, one story in running forever

1. Find the stuck story:
   ```bash
   antfarm step stories <run-id>
   ```
2. Find its UUID:
   ```sql
   SELECT id, story_id, title, status, claimed_at
   FROM stories WHERE run_id = '<run-uuid>' AND status = 'running';
   ```
3. Reset the story:
   ```sql
   UPDATE stories SET status = 'pending', claimed_at = NULL,
     retry_count = retry_count + 1, updated_at = datetime('now')
   WHERE id = '<story-uuid>';
   ```
4. Also reset the loop step if needed:
   ```sql
   UPDATE steps SET status = 'pending', claimed_at = NULL,
     updated_at = datetime('now')
   WHERE run_id = '<run-uuid>' AND type = 'loop' AND status = 'running';
   ```
5. Agent will re-claim the story on next poll

---

## Dashboard for Operations

```bash
antfarm dashboard               # Start on :3333
antfarm dashboard --port 4000   # Custom port
antfarm dashboard status        # Check if running
antfarm dashboard stop          # Stop daemon
```

The dashboard provides:
- Live run list with status
- Step-by-step breakdown with timing (claimed_at, finished_at)
- Story progress for loop steps
- Event log per run

Use the dashboard alongside CLI for a real-time view while running medic or SQL queries.
