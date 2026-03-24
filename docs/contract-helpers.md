# Contract helper CLIs

Structured wrappers for the contract-aware commands used by the feature-dev workflow. They emit human-readable lines plus a final JSON line so downstream agents can parse results without scraping logs.

---

## `antfarm contract commit`

Wraps `git commit` and returns structured success/error output. Use this instead of invoking `git` directly so the verifier can reason about what happened.

**Usage**

```bash
antfarm contract commit --message "feat: add login flow"
```

**Behavior**
- Requires staged changes and a commit message (`--message`).
- On success, exits `0`, prints a summary plus JSON containing the commit SHA, message, and staged file count.
- On error (missing message, no staged changes, git failure), emits an `error` status and exits `1`.

**Sample output (success)**

```
Status: ok
Summary: Commit created
Data: {"sha":"1a2b3c4d5e","message":"feat: add login flow","stagedFiles":3}
{"status":"ok","summary":"Commit created","data":{"sha":"1a2b3c4d5e","message":"feat: add login flow","stagedFiles":3}}
```

**Sample output (no staged changes)**

```
Status: error
Summary: No staged changes to commit
Error: Stage files before committing
{"status":"error","summary":"No staged changes to commit","error":"Stage files before committing"}
(exit code 1)
```

---

## `antfarm contract verify-criteria`

Verifies acceptance criteria one-by-one with explicit decisions. Designed for verifiers to log every criterion and gate progression unless all pass.

**Inputs**
- Criteria: `--file <path>` (JSON5 file) **or** `--criteria <json>` (JSON5 string)
- Decisions: optional `--decisions <json>` (JSON5). If omitted, the CLI prompts interactively.

**Options**
- `--log` — print per-criterion outcomes as they are processed.
- `--json` — echo the structured results (overall + per-criterion) before the contract output line.
- `--json-output <path>` — save the structured results to a file.

**Example (all pass)**

```bash
antfarm contract verify-criteria \
  --criteria '[{"id":"AC1","text":"Login button shows"},{"id":"AC2","text":"Redirects after submit"}]' \
  --decisions '[{"id":"AC1","status":"pass"},{"id":"AC2","status":"pass"}]' \
  --log --json --json-output decisions.json
```

Output (abbreviated):
```
AC1: pass — Login button shows
AC2: pass — Redirects after submit
{
  "overall": "pass",
  "criteria": [
    {"id":"AC1","status":"pass","text":"Login button shows"},
    {"id":"AC2","status":"pass","text":"Redirects after submit"}
  ]
}
Saved decisions to decisions.json
Status: ok
Summary: All criteria passed
Data: {"overall":"pass","criteria":[{"id":"AC1","status":"pass","text":"Login button shows"},{"id":"AC2","status":"pass","text":"Redirects after submit"}]}
{"status":"ok","summary":"All criteria passed","data":{"overall":"pass","criteria":[{"id":"AC1","status":"pass","text":"Login button shows"},{"id":"AC2","status":"pass","text":"Redirects after submit"}]}}
(exit code 0)
```

**Example (needs work)**

```
antfarm contract verify-criteria --file criteria.json --decisions '[{"id":"AC1","status":"needs-work","notes":"Missing empty state"}]'
```

Output ends with an `error` status and exit code `1` to block progression until the issues are addressed:
```
Status: error
Summary: Criteria need attention
Data: {"overall":"needs-work","criteria":[{"id":"AC1","status":"needs-work","notes":"Missing empty state"}]}
{"status":"error","summary":"Criteria need attention","data":{"overall":"needs-work","criteria":[{"id":"AC1","status":"needs-work","notes":"Missing empty state"}]}}
(exit code 1)
```

---

## Interpreting contract output

Both commands:
- Emit human-readable lines followed by a final JSON line for machine parsing.
- Default to exit code `0` on `ok` status and `1` on `error` status. The JSON line is the source of truth for downstream agents/log parsing.
- Support JSON5 inputs so you can include comments or trailing commas in inline or file-based payloads.
