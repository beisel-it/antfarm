# CLI Reference

Complete reference for all `antfarm` commands.

---

## Lifecycle

### `antfarm install`

Install all bundled workflows, provision agent workspaces, register agents in OpenClaw,
set up cron jobs, and install the Medic watchdog.

```bash
antfarm install
```

Run this once after first installing antfarm. Safe to re-run — skips already-installed workflows.

---

### `antfarm uninstall [--force]`

Full teardown: remove agent workspaces, delete cron jobs, deregister agents, optionally wipe DB.

```bash
antfarm uninstall           # Interactive — asks before deleting DB
antfarm uninstall --force   # Skip active-run check, wipe DB without prompting
```

---

## Workflow Commands

### `antfarm workflow list`

List all installed workflows.

```bash
antfarm workflow list
```

Output:
```
feature-dev    Feature Development Workflow     v5
bug-fix        Bug Fix Workflow                 v3
security-audit Security Audit Workflow          v2
```

---

### `antfarm workflow install <id>`

Install a single workflow: provision agents, register in OpenClaw, create cron jobs.

```bash
antfarm workflow install feature-dev
```

---

### `antfarm workflow uninstall <id> [--all] [--force]`

Remove a workflow and its agents, crons, and workspace files.

```bash
antfarm workflow uninstall feature-dev          # Remove one workflow
antfarm workflow uninstall --all                # Remove all workflows
antfarm workflow uninstall feature-dev --force  # Skip active-run check
```

---

### `antfarm workflow run <id> <task>`

Start a new workflow run for a given task.

```bash
antfarm workflow run feature-dev "Add user authentication with OAuth"
antfarm workflow run bug-fix "Login fails on mobile Safari when cookies are disabled"
```

Output:
```
Run: a1fdf573-...
Workflow: feature-dev
Task: Add user authentication with OAuth
Status: running
Run #: 42
```

**Options:**
```
--dry-run           Validate workflow spec without creating DB entries or starting agents
--project <id>      Associate run with a project (use project ID prefix)
--notify-url <url>  Webhook URL for run events
```

---

### `antfarm workflow status <query>`

Check the status of a run.

**Query formats:**
- Task substring: `"OAuth"` — matches if task contains "OAuth" (case-insensitive)
- Run ID prefix: `"a1fdf5"` — matches run whose UUID starts with this prefix
- Run number: `"#42"` — matches run number 42

```bash
antfarm workflow status "OAuth"
antfarm workflow status a1fdf5
antfarm workflow status "#42"
```

Output:
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

**Status values:**
| Status | Meaning |
|--------|---------|
| `waiting` | Not yet eligible — a prior step is still pending/running |
| `pending` | Ready to be claimed by an agent |
| `running` | Claimed by an agent, work in progress |
| `done` | Completed successfully |
| `failed` | Failed, retries exhausted |
| `skipped` | Bypassed by pipeline logic |

---

### `antfarm workflow runs`

List all runs across all workflows.

```bash
antfarm workflow runs
```

Output:
```
#42  feature-dev    running   Add user authentication with OAuth     2026-03-22 14:23
#41  bug-fix        done      Login fails on mobile Safari           2026-03-22 10:05
#40  feature-dev    failed    Refactor payment processing            2026-03-21 16:30
```

---

### `antfarm workflow resume <run-id>`

Resume a failed run from the failed step. Resets the failed step to `pending`.

```bash
antfarm workflow resume a1fdf573-...
antfarm workflow resume a1fdf5         # Prefix match
```

Use after fixing the underlying issue that caused the failure (e.g., fixing a broken
test, providing missing credentials, correcting a bad context variable).

---

### `antfarm workflow stop <run-id>`

Cancel a running workflow. Sets run to `cancelled`, marks all non-terminal steps as `failed`.

```bash
antfarm workflow stop a1fdf573-...
```

---

### `antfarm workflow ensure-crons <id>`

Recreate cron jobs for a workflow if they were accidentally deleted or never created.

```bash
antfarm workflow ensure-crons feature-dev
```

Use when agents stop polling (e.g., after `antfarm uninstall` of OpenClaw crons, or after
a cron system reset).

---

## Step Commands

These commands are called by agents inside their cron sessions. They are part of the
agent-to-orchestrator protocol, not intended for direct user invocation in normal operation.

### `antfarm step peek <agent-id>`

Lightweight check for pending work. Single COUNT query — fast, safe to call on every poll.

```bash
antfarm step peek feature-dev_developer
```

Output: `HAS_WORK` or `NO_WORK` (no other output)

Exit code: 0 in both cases (use output text to decide whether to claim).

---

### `antfarm step claim <agent-id>`

Claim the next pending step for this agent. Returns fully resolved JSON with the step
input (all `{{variables}}` filled in from run context).

```bash
antfarm step claim feature-dev_developer
```

Output (JSON):
```json
{
  "stepId": "9f2a8c1d-...",
  "runId": "a1fdf573-...",
  "stepType": "single",
  "input": "Implement the following user story...\n\nSTORY: S-3: Add login form\n...",
  "sessionKey": "7b3e4f1a-..."
}
```

Exit code 1 if no work available (agent should exit session).

**Notes:**
- Calling `claim` also runs `cleanupAbandonedSteps` — resets stuck running steps
  to pending if they've been running past the timeout threshold
- For loop steps, claim returns the next pending story
- The `input` field is the fully resolved prompt the agent should use as its task

---

### `antfarm step complete <step-id>`

Mark a step as done. Reads output from stdin.

```bash
echo "STATUS: done
REPO: /home/user/myproject
BRANCH: feature/oauth" | antfarm step complete 9f2a8c1d-...
```

Or from a file:
```bash
antfarm step complete 9f2a8c1d-... < /tmp/output.txt
```

The output is parsed for KEY: value pairs. Each key (lowercased) is merged into the
run context and becomes available as `{{key}}` in subsequent steps.

**Special key:** `STORIES_JSON` triggers story creation. Include it only in planner steps.

---

### `antfarm step fail <step-id> <error-message>`

Mark a step as failed with an error message.

```bash
antfarm step fail 9f2a8c1d-... "Build failed: TypeScript errors in src/auth.ts"
```

**Retry behavior:**
- If `retry_count < max_retries`: step resets to `pending` for another agent to claim
- If `retry_count >= max_retries`: triggers `on_fail` action (escalate or retry_step)

---

### `antfarm step stories <run-id>`

List all stories for a run with their current status, retry counts, and timing.

```bash
antfarm step stories a1fdf573-...
```

Output:
```
Stories for run a1fdf573-...:

S-1  Create database schema          done    retries: 0  claimed: 14:39:01  finished: 14:52:18
S-2  Add registration endpoint       done    retries: 1  claimed: 14:52:30  finished: 15:08:44
S-3  Add login form                  running retries: 0  claimed: 15:09:02
S-4  Add OAuth callback handler      pending retries: 0
S-5  Write integration tests         pending retries: 0
```

---

## Dashboard

### `antfarm dashboard [start] [--port N]`

Start the web dashboard as a background daemon.

```bash
antfarm dashboard            # Start on port 3333
antfarm dashboard start      # Same as above
antfarm dashboard --port 4000
```

Open browser to `http://localhost:3333` to view run status, step progress, timing, and logs.

---

### `antfarm dashboard stop`

Stop the dashboard daemon.

```bash
antfarm dashboard stop
```

---

### `antfarm dashboard status`

Show dashboard daemon status.

```bash
antfarm dashboard status
```

Output:
```
Dashboard: running
Port: 3333
PID: 12345
URL: http://localhost:3333
```

---

## Backlog

### `antfarm backlog list`

List all backlog items.

```bash
antfarm backlog list
```

---

### `antfarm backlog add <title> [options]`

Add a new backlog item.

```bash
antfarm backlog add "Implement dark mode" \
  --description "Add dark/light theme toggle to settings page" \
  --priority 2 \
  --workflow feature-dev \
  --project abc123
```

**Options:**
```
--description <text>   Detailed description
--priority <n>         Integer priority (higher = more important)
--workflow <id>        Target workflow for execution
--project <id>         Associate with a project
```

---

### `antfarm backlog update <id> [options]`

Update a backlog item.

```bash
antfarm backlog update b7f2a1 --status in_progress --priority 3
```

**Options:**
```
--title <t>
--description <d>
--status <s>     pending | in_progress | done
--priority <n>
--workflow <id>
```

---

### `antfarm backlog delete <id>`

Delete a backlog item.

```bash
antfarm backlog delete b7f2a1
```

---

## Projects

### `antfarm project list [--json]`

List all projects.

```bash
antfarm project list
antfarm project list --json
```

---

### `antfarm project add <name> [options]`

Create a new project.

```bash
antfarm project add "My App" \
  --git-repo-path /home/user/myapp \
  --github-repo-url https://github.com/user/myapp
```

**Options:**
```
--git-repo-path <path>     Local git repo path
--github-repo-url <url>    GitHub repository URL
```

---

### `antfarm project update <id-prefix> [options]`

Update a project.

```bash
antfarm project update abc123 --name "My Renamed App"
```

**Options:**
```
--name <n>
--git-repo-path <path>
--github-repo-url <url>
```

---

### `antfarm project delete <id-prefix>`

Delete a project.

```bash
antfarm project delete abc123
```

---

### `antfarm project show <id-prefix> [--json]`

Show project details with associated backlog items and runs.

```bash
antfarm project show abc123
antfarm project show abc123 --json
```

---

## Medic (Health Monitoring)

### `antfarm medic install`

Install the Medic as an OpenClaw cron job (runs on a schedule to catch stuck jobs).
Called automatically by `antfarm install`.

```bash
antfarm medic install
```

---

### `antfarm medic uninstall`

Remove the Medic cron.

```bash
antfarm medic uninstall
```

---

### `antfarm medic run [--json]`

Run a health check immediately. Detects and auto-remediates stuck steps, stalled runs,
dead runs, and orphaned/failing crons.

```bash
antfarm medic run
antfarm medic run --json
```

Output:
```
Medic check — 2026-03-22 15:42:11

Checks:
  Stuck steps:   0 found, 0 reset
  Stalled runs:  0 found
  Dead runs:     1 found, 1 resolved (marked done)
  Orphaned crons: 0 found
  Failing crons:  0 found

Status: healthy
```

With issues:
```
Medic check — 2026-03-22 15:42:11

Issues found:
  [STUCK STEP] feature-dev_developer / step "implement" stuck for 47 min
    → reset to pending (abandoned_count: 2)
  [DEAD RUN] run #38 marked as running but all steps terminal
    → marked as done

Status: 2 issues found, 2 resolved
```

**What Medic auto-fixes:**
- Stuck steps (running too long) → reset to pending (up to 5 times, then fail permanently)
- Dead runs (running status but all steps done/failed) → mark done or failed
- Orphaned crons (for deleted agents/workflows) → delete

**What Medic flags but does NOT fix:**
- Stalled runs (running with no progress for 2x timeout) → alert-only, requires human action

---

### `antfarm medic status`

Show summary of the last health check.

```bash
antfarm medic status
```

---

### `antfarm medic log [<count>]`

Show recent Medic check history.

```bash
antfarm medic log       # Last 10 checks
antfarm medic log 20    # Last 20 checks
```

---

## Utilities

### `antfarm logs [<lines>]`

Show recent activity from the event log.

```bash
antfarm logs         # Last 50 events
antfarm logs 100     # Last 100 events
antfarm logs <run-id>  # All events for a specific run
```

Events include step transitions, pipeline advancement, run completion, and errors.

---

### `antfarm version`

Show the installed antfarm version.

```bash
antfarm version
```

---

### `antfarm update`

Pull the latest antfarm from GitHub, rebuild, and reinstall workflows.

```bash
antfarm update
```
