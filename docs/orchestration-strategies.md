# Orchestration Strategies

Design patterns for building reliable multi-agent workflows. This guide goes beyond YAML
syntax to cover the strategy behind effective workflow architecture.

See [creating-workflows.md](creating-workflows.md) for YAML reference and [cli-reference.md](cli-reference.md)
for command details.

---

## Pipeline Patterns

### Linear Pipeline

The simplest pattern: sequential steps where each passes output to the next.

```yaml
steps:
  - id: research
    agent: researcher
    input: Research {{task}}. Reply STATUS: done, FINDINGS: ...
    expects: "STATUS: done"

  - id: write
    agent: writer
    input: |
      Write based on: {{findings}}
      Original: {{task}}
      Reply STATUS: done, DRAFT: ...
    expects: "STATUS: done"

  - id: review
    agent: reviewer
    input: Review this draft: {{draft}}
    expects: "STATUS: done"
```

Use when: Tasks naturally decompose into sequential phases with no parallelism needed.

---

### Loop with Per-Story Verification (Recommended for Implementation Work)

The `feature-dev` pattern. Planner decomposes work into stories; each story is implemented
and immediately verified before moving to the next.

```yaml
steps:
  - id: plan
    agent: planner
    input: |
      Break {{task}} into ordered user stories.
      Reply STATUS: done, REPO: ..., STORIES_JSON: [...]
    expects: "STATUS: done"

  - id: implement
    agent: developer
    type: loop
    loop:
      over: stories
      completion: all_done
      fresh_session: true
      verify_each: true
      verify_step: verify      # Runs verify after each story
    input: |
      Implement {{current_story}}
      Context: {{repo}}, {{branch}}
      Reply STATUS: done, CHANGES: ...
    expects: "STATUS: done"
    max_retries: 2

  - id: verify
    agent: verifier
    input: |
      Verify: {{current_story}}
      Changes: {{changes}}
      Reply STATUS: done or STATUS: retry with ISSUES: ...
    expects: "STATUS: done"
    on_fail:
      retry_step: implement    # Failed verify re-runs implement with {{verify_feedback}}
      max_retries: 2
      on_exhausted:
        escalate_to: human
```

**How per-story verify works:**
1. Developer claims a story → implements → completes with `STATUS: done`
2. Verifier immediately claims and checks the story
3. If `STATUS: done` → story marked done, loop moves to next story
4. If `STATUS: retry` → `ISSUES:` content becomes `{{verify_feedback}}` → implement runs again for this story
5. After `max_retries` failed verifications → escalate to human

---

### Post-Loop Verification

Run a single verification step after all stories are complete. Simpler but gives less
targeted feedback — verifier sees the whole codebase, not one story at a time.

```yaml
steps:
  - id: plan
    agent: planner
    input: ...
    expects: "STATUS: done"

  - id: implement
    agent: developer
    type: loop
    loop:
      over: stories
      completion: all_done
      fresh_session: true
      # No verify_each here
    input: ...
    expects: "STATUS: done"

  - id: verify
    agent: verifier            # Runs once, after all stories complete
    input: |
      Verify the complete implementation:
      {{task}}
      Stories completed: {{completed_stories}}
      Reply STATUS: done or STATUS: retry with ISSUES: ...
    expects: "STATUS: done"
    on_fail:
      retry_step: implement    # Resets implement step to retry all pending stories
      max_retries: 2
      on_exhausted:
        escalate_to: human
```

Use when: Stories are highly interdependent and per-story verification doesn't make sense.

---

### Investigate → Fix Pattern (bug-fix pattern)

```yaml
steps:
  - id: triage
    agent: triager
    input: |
      Reproduce and analyze: {{task}}
      Reply STATUS: done, ROOT_CAUSE: ..., REPRODUCTION: ...
    expects: "STATUS: done"

  - id: fix
    agent: fixer
    input: |
      Fix: {{root_cause}}
      How to reproduce: {{reproduction}}
      Reply STATUS: done, CHANGES: ..., REGRESSION_TEST: ...
    expects: "STATUS: done"

  - id: verify
    agent: verifier
    input: |
      Verify fix for: {{task}}
      Changes: {{changes}}
      Regression test: {{regression_test}}
      Reply STATUS: done or STATUS: retry with ISSUES: ...
    expects: "STATUS: done"
    on_fail:
      retry_step: fix
      max_retries: 3
```

---

### Scan → Prioritize → Fix Loop (security-audit pattern)

```yaml
steps:
  - id: scan
    agent: scanner
    role: scanning             # Has web access for CVE lookups
    input: Scan {{repo}} for vulnerabilities. Reply STORIES_JSON: [...]
    expects: "STATUS: done"

  - id: fix
    agent: fixer
    type: loop
    loop:
      over: stories
      completion: all_done
      fresh_session: true
      verify_each: true
      verify_step: verify
    input: Fix vulnerability: {{current_story}}
    expects: "STATUS: done"
```

---

## Context Design

Context is the shared state that flows between steps. Design it carefully.

### Naming Conventions

Use ALL_CAPS with underscores. Keys become lowercase template variables:
- `REPO` → `{{repo}}`
- `BUILD_CMD` → `{{build_cmd}}`
- `CI_NOTES` → `{{ci_notes}}`

**Good keys:** Specific, descriptive, unambiguous
- `REPO: /home/user/myproject` — exact path
- `BUILD_CMD: npm run build` — exact command
- `TEST_CMD: npm test` — exact command
- `BRANCH: feature/oauth-login` — exact branch name

**Avoid:** Vague keys that collapse multiple pieces of info
- `NOTES: ...` — too vague
- `STATUS: done` — STATUS is consumed by the pipeline, not for data
- `OUTPUT: ...` — use a descriptive name

### What to Capture

Capture anything a subsequent step needs that it cannot discover itself:
- Repository paths and branch names (setup → all downstream steps)
- Build and test commands (setup → developer, verifier, tester)
- PR URLs (pr → reviewer)
- Identified root causes (investigator → fixer)
- Test results (tester → pr)

Do NOT capture:
- Large data blobs (file contents, full logs) — put these in files instead
- Information a step can easily re-derive itself
- Redundant copies of the task description (use `{{task}}` directly)

### Avoiding Context Bloat

Context is stored as a JSON blob in the `runs` table and included in every step's resolved
input. Keep values concise:

```
# Good
REPO: /home/user/myproject
BUILD_CMD: npm run build

# Avoid
FULL_BUILD_OUTPUT: [100 lines of build output...]
```

For large data (build logs, test output, analysis results), write to a file in the agent
workspace and pass the path via context.

### Multi-Line Values

Values can span multiple lines. Subsequent lines continue until the next KEY: pattern:

```
STATUS: done
ANALYSIS:
  - Authentication is handled in src/auth/middleware.ts
  - Sessions use JWT with 24h expiry
  - Refresh tokens not implemented yet
REPO: /home/user/myproject
```

The `ANALYSIS` key will contain the multi-line content. Use this for structured notes
that would be awkward to compress into one line.

---

## Story Decomposition

The quality of the planner step determines everything downstream.

### Planner Prompt Design

A good planner prompt instructs the agent to:
1. Explore the codebase before designing stories
2. Order stories by dependency (schema first, backend, frontend, integration)
3. Size each story to fit in one developer session
4. Write mechanically verifiable acceptance criteria

```yaml
- id: plan
  agent: planner
  input: |
    Decompose the following task into ordered user stories for autonomous execution.

    TASK:
    {{task}}

    Instructions:
    1. Explore the codebase to understand the stack, conventions, and patterns
    2. Break the task into small user stories (max 20)
    3. Order by dependency: schema/DB first, backend, frontend, integration
    4. Each story must fit in one developer session (one context window)
    5. Every acceptance criterion must be mechanically verifiable
    6. Always include "Typecheck passes" as the last criterion in every story
    7. Every story MUST include test criteria — "Tests for [feature] pass"

    Reply with:
    STATUS: done
    REPO: /path/to/repo
    BRANCH: feature-branch-name
    STORIES_JSON: [...]
  expects: "STATUS: done"
```

### Good vs. Bad Stories

**Good story — small, specific, verifiable:**
```json
{
  "id": "S-1",
  "title": "Add users table migration",
  "description": "Create database migration adding users table with email, password_hash, and created_at columns.",
  "acceptanceCriteria": [
    "Migration file exists in migrations/",
    "Table has email, password_hash, created_at columns",
    "Migration runs without errors",
    "Typecheck passes"
  ]
}
```

**Bad story — too large, vague criteria:**
```json
{
  "id": "S-1",
  "title": "Implement authentication",
  "description": "Add login, registration, password reset, and OAuth.",
  "acceptanceCriteria": [
    "Authentication works",
    "Tests pass"
  ]
}
```

### Story Sizing Guidelines

- One story = one developer context window (~30-60 min of work)
- If you're not sure, err smaller — two small stories is better than one story that times out
- Database migrations are always their own story
- Schema changes and API implementation should be separate stories
- Frontend and backend implementations should be separate stories

### Acceptance Criteria Patterns

Good acceptance criteria are mechanically verifiable — an agent can confirm them by
running commands or reading files:

| Pattern | Example |
|---------|---------|
| File existence | "Migration file exists at `migrations/001_users.sql`" |
| Command success | "Tests pass: `npm test` exits 0" |
| Behavior assertion | "Endpoint returns 401 for unauthenticated requests" |
| Code presence | "JWT validation logic exists in `src/auth/middleware.ts`" |
| Typecheck | "Typecheck passes: `npm run typecheck` exits 0" |

Avoid subjective criteria:
- "Code is clean" — not verifiable
- "Performance is acceptable" — not verifiable without benchmarks
- "Well tested" — specify what tests

---

## Verification Strategies

### Per-Story (verify_each: true)

Best for independent stories. Each story is verified immediately after implementation:
- Tighter feedback loop — developer gets `{{verify_feedback}}` while context is fresh
- Failures isolated to one story — other stories unaffected
- More agent sessions (cost) but faster overall time to completion

Use when: Stories are independent (no shared state between them).

### Post-Loop Verification

One verification step after all stories complete:
- Single verifier session — cheaper
- Can check cross-story concerns (integration, consistency)
- Slower feedback — developer has moved on by the time verify runs

Use when: Stories build on each other and only make sense verified together.

### Verify → Retry Loop Design

The `ISSUES:` key in the verifier's output becomes `{{verify_feedback}}` in the next
implement attempt. Write verifier prompts to produce actionable, specific issues:

```yaml
# Good verifier output format
On failure, reply:
STATUS: retry
ISSUES:
- src/auth/login.ts:42 - Missing error handling for invalid credentials
- tests/auth.test.ts - No test for 401 response on bad password
- Typecheck fails: Property 'userId' does not exist on type 'Session'
```

The developer receives this verbatim as `{{verify_feedback}}`. Vague issues = vague fixes.

### Reviewer as Final Gate

Include a code review step after PR creation for a quality gate:

```yaml
- id: review
  agent: reviewer
  on_fail:
    retry_step: implement    # Full re-implementation if reviewer is unsatisfied
    max_retries: 3
```

The reviewer can `STATUS: retry` + `FEEDBACK:` to send specific change requests back
through the implement → verify → test → pr loop.

---

## Retry and Escalation Design

### When to Retry

Retry is appropriate when:
- The failure is likely due to incomplete implementation
- The error message gives the agent enough info to fix it
- The step is idempotent (re-running won't make things worse)

```yaml
max_retries: 2              # Most steps: 2 retries is enough
on_fail:
  retry_step: implement     # Which step to re-run
```

### When to Escalate

Escalate to human when:
- Retries are exhausted and the issue requires judgment
- The failure indicates a problem the agent cannot solve (missing credentials, broken environment)
- A decision is needed that wasn't anticipated in the workflow design

```yaml
on_fail:
  escalate_to: human
```

Run status becomes `blocked`. Use `antfarm workflow resume <run-id>` after manually resolving.

### Retry Budget Design

| Step type | Recommended max_retries | Why |
|-----------|------------------------|-----|
| Planner | 2 | Story decomposition is mostly deterministic |
| Setup | 2 | Environment setup failures are often fixable by retry |
| Developer (per story) | 2 | Fresh session may succeed where previous timed out |
| Verifier | 2 | If verify fails 3 times, the implementation has a real problem |
| PR creation | 1 | PR creation failures are usually auth/config issues |

### Using on_exhausted

```yaml
on_fail:
  retry_step: implement
  max_retries: 3
  on_exhausted:
    escalate_to: human    # After 3 verify failures → human intervention
```

Without `on_exhausted`, the run fails when retries are exhausted. With it, the run
pauses and waits for a human to `resume` after investigation.

---

## Role Assignment

Assign roles deliberately — they control what tools agents can use.

### Role Decision Tree

```
Does the agent write code or files?
  YES → coding
  NO  → Does it verify/audit code without writing?
          YES → verification (no write access — preserves review integrity)
          NO  → Does it need to run tests or executables?
                  YES → Does it need a browser?
                          YES → testing
                          NO  → verification
                  NO  → Does it need web search?
                          YES → scanning
                          NO  → analysis
```

### Why Role Integrity Matters

- `verification` agents cannot write files — ensures a verifier checking work cannot
  "fix" what it's reviewing (which would defeat the purpose of verification)
- `analysis` agents cannot execute code — a planner reading the codebase cannot
  accidentally run build commands or modify files
- `testing` agents cannot write files — prevents a tester from "fixing" tests to make
  them pass

### Timeout by Role

Default timeouts per role:
- `analysis`: 20 minutes (read-only, usually fast)
- `coding`: 30 minutes (implementation takes longer)
- `verification`: 20 minutes (read + run tests)
- `testing`: 30 minutes (E2E tests can be slow)

Override for slow agents:
```yaml
agents:
  - id: developer
    role: coding
    timeoutSeconds: 3600    # 1 hour for complex implementations
```

---

## Shared Agents

Antfarm includes shared agents in `agents/shared/` that implement common patterns.

### Setup Agent (`agents/shared/setup/`)

Creates a git branch, establishes build and test baselines, reports environment status.

**Output keys:** `BUILD_CMD`, `TEST_CMD`, `CI_NOTES`, `BASELINE`

```yaml
- id: setup
  agent: setup
  workspace:
    files:
      AGENTS.md: ../../agents/shared/setup/AGENTS.md
      SOUL.md: ../../agents/shared/setup/SOUL.md
      IDENTITY.md: ../../agents/shared/setup/IDENTITY.md
```

Use whenever: A workflow creates a branch and runs code. The setup agent discovers the
correct build/test commands so you don't hardcode them in workflow.yml.

### Verifier Agent (`agents/shared/verifier/`)

Verifies implementation against acceptance criteria. Checks: code exists (not TODOs),
each criterion is met, tests written and passing, typecheck passing.

```yaml
- id: verifier
  agent: verifier
  workspace:
    skills:
      - agent-browser      # For frontend visual verification
    files:
      AGENTS.md: ../../agents/shared/verifier/AGENTS.md
```

### When Not to Use Shared Agents

Customize the agent when:
- The verification logic is domain-specific (e.g., security-specific checks)
- The setup process differs significantly from the standard git + build + test flow
- You need different output keys or behavior

---

## Timeout Tuning

### Default Timeout Hierarchy

1. Role default (20 or 30 min)
2. Agent `timeoutSeconds` override
3. Polling `timeoutSeconds` (separate — controls the polling session, not the work session)

### Estimating Timeouts

| Agent type | Typical work | Recommended timeout |
|------------|-------------|---------------------|
| Planner | Explore + plan | 600–1200s (10–20 min) |
| Setup | Branch + build + test | 600s (10 min) |
| Developer | Implementation + tests | 1800–3600s (30–60 min) |
| Verifier | Read + run tests | 600–900s (10–15 min) |
| Tester | E2E test suite | 1800s (30 min) |
| PR creator | `gh pr create` | 300s (5 min) |
| Reviewer | Read PR + review | 600s (10 min) |

### Signs of Timeout Issues

- Steps repeatedly hit `abandoned_count > 0` in the DB
- Medic logs show stuck steps at or near the role timeout threshold
- Step status oscillates between `running` and `pending` (Medic keeps resetting it)

Fix: Increase `timeoutSeconds` on the agent, or split the story into smaller pieces.

---

## Workflow Composition Patterns

### Reusing Steps Across Workflows

The `on_fail: retry_step` mechanism allows non-linear pipelines. Common composition:

```
plan → setup → implement ↔ verify → test ↔ implement → pr → review ↔ implement
```

Each `↔` is a `retry_step` relationship. The right side can send the left side back
for more work via `STATUS: retry` + feedback.

### Multiple Loop Steps

You can have multiple loop steps in one workflow. Each operates independently on stories.
However, only one loop step should be `running` at a time in the pipeline (sequential by
`step_index`).

### Handoff Pattern

Pass structured context between phases using well-named keys:

```
Phase 1 → REPO, BRANCH, BUILD_CMD, TEST_CMD
Phase 2 → CHANGES, TESTS (per story, accumulated)
Phase 3 → PR (URL to pull request)
Phase 4 → DECISION, FEEDBACK
```

Design your key names to tell the story of the workflow.
