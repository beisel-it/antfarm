import { createAgentCronJob, deleteAgentCronJobs, listCronJobs, checkCronToolAvailable } from "./gateway-api.js";
import type { WorkflowSpec } from "./types.js";
import { resolveAntfarmCli } from "./paths.js";
import { getDb } from "../db.js";
import { readOpenClawConfig } from "./openclaw-config.js";
import { getRoleTimeoutSeconds, inferRole } from "./install.js";

const DEFAULT_EVERY_MS = 300_000; // 5 minutes
const DEFAULT_AGENT_TIMEOUT_SECONDS = 30 * 60; // 30 minutes

function buildAgentPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveAntfarmCli();

  return `You are an Antfarm workflow agent. Check for pending work and execute it.

⚠️ CRITICAL: Success means calling "step complete" with parseable required keys. If you cannot produce the required output shape, call "step fail" with the reason. If you end the session without reporting, the workflow will be stuck forever.

Step 1 — Check for pending work:
\`\`\`
node ${cli} step claim "${fullAgentId}"
\`\`\`

If output is "NO_WORK", reply HEARTBEAT_OK and stop.

Step 2 — If JSON is returned, it contains: {"stepId": "...", "runId": "...", "input": "..."}
Save the stepId — you'll need it to report completion.
The "input" field contains your FULLY RESOLVED task instructions. Read it carefully and DO the work.

Step 3 — Do the work described in the input.
Step-specific schema in the input overrides generic wrapper templates.
Use the agent step's required output contract. Only use CHANGES/TESTS if no contract is specified.
For feature-dev_planner, completion must carry STORIES_JSON exactly as valid JSON array.

Step 4 — Pre-complete validation gate:
- Before calling step complete, verify the output contains every required key for this step.
- For planner steps, this includes STATUS and STORIES_JSON, plus REPO and BRANCH when the input expects them.
- If any required key is missing or not parseable, call step fail instead of step complete.

Step 5 — MANDATORY: Report completion (do this IMMEDIATELY after finishing the work):
\`\`\`
cat <<'ANTFARM_EOF' > /tmp/antfarm-step-output.txt
STATUS: done
CHANGES: what you did
TESTS: what tests you ran
ANTFARM_EOF
cat /tmp/antfarm-step-output.txt | node ${cli} step complete "<stepId>"
\`\`\`

Example completion format only. Use this only when no schema is provided by the input.

If the work FAILED:
\`\`\`
node ${cli} step fail "<stepId>" "description of what went wrong"
\`\`\`

RULES:
1. NEVER end your session without calling step complete or step fail
2. Write output to a file first, then pipe via stdin (shell escaping breaks direct args)
3. If required keys are missing, malformed, or unparseable, call step fail with an explanation
4. Wrapper examples are fallback guidance only; the claimed step input is the source of truth

The workflow cannot advance until you report. Your session ending without reporting = broken pipeline.`;
}

export function buildWorkPrompt(workflowId: string, agentId: string): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveAntfarmCli();

  return `You are an Antfarm workflow agent. Execute the pending work below.

⚠️ CRITICAL: Success means calling "step complete" with parseable required keys. If you cannot produce the required output shape, call "step fail" with the reason. If you end the session without reporting, the workflow will be stuck forever.

The claimed step JSON is provided below. It contains: {"stepId": "...", "runId": "...", "input": "..."}
Save the stepId — you'll need it to report completion.
The "input" field contains your FULLY RESOLVED task instructions. Read it carefully and DO the work.

Do the work described in the input.
Step-specific schema in the input overrides generic wrapper templates.
Use the agent step's required output contract. Only use CHANGES/TESTS if no contract is specified.
For feature-dev_planner, completion must carry STORIES_JSON exactly as valid JSON array.

Pre-complete validation gate:
- Before calling step complete, verify the output contains every required key for this step.
- For planner steps, this includes STATUS and STORIES_JSON, plus REPO and BRANCH when the input expects them.
- If any required key is missing or not parseable, call step fail instead of step complete.

MANDATORY: Report completion (do this IMMEDIATELY after finishing the work):
\`\`\`
cat <<'ANTFARM_EOF' > /tmp/antfarm-step-output.txt
STATUS: done
CHANGES: what you did
TESTS: what tests you ran
ANTFARM_EOF
cat /tmp/antfarm-step-output.txt | node ${cli} step complete "<stepId>"
\`\`\`

Example completion format only. Use this only when no schema is provided by the input.

If the work FAILED:
\`\`\`
node ${cli} step fail "<stepId>" "description of what went wrong"
\`\`\`

RULES:
1. NEVER end your session without calling step complete or step fail
2. Write output to a file first, then pipe via stdin (shell escaping breaks direct args)
3. If required keys are missing, malformed, or unparseable, call step fail with an explanation
4. Wrapper examples are fallback guidance only; the claimed step input is the source of truth

The workflow cannot advance until you report. Your session ending without reporting = broken pipeline.`;
}

const DEFAULT_POLLING_TIMEOUT_SECONDS = 7200;
const DEFAULT_POLLING_MODEL = "openai-codex/gpt-5.1-codex-max";
const DEFAULT_WORK_RUN_TIMEOUT_SECONDS = 1800;

function extractModel(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const primary = (value as { primary?: unknown }).primary;
    if (typeof primary === "string") return primary;
  }
  return undefined;
}

async function resolveAgentCronModel(agentId: string, requestedModel?: string): Promise<string | undefined> {
  if (requestedModel && requestedModel !== "default") {
    return requestedModel;
  }

  try {
    const { config } = await readOpenClawConfig();
    const agents = config.agents?.list;
    if (Array.isArray(agents)) {
      const entry = agents.find((a: any) => a?.id === agentId);
      const configured = extractModel(entry?.model);
      if (configured) return configured;
    }

    const defaults = config.agents?.defaults;
    const fallback = extractModel(defaults?.model);
    if (fallback) return fallback;
  } catch {
    // best-effort — fallback below
  }

  return requestedModel;
}

function resolveWorkRunTimeoutSeconds(agent: Pick<WorkflowSpec["agents"][number], "id" | "role" | "timeoutSeconds">): number {
  if (typeof agent.timeoutSeconds === "number") return agent.timeoutSeconds;
  if (agent.role) return getRoleTimeoutSeconds(agent.role);
  if (agent.id) return getRoleTimeoutSeconds(inferRole(agent.id));
  return DEFAULT_WORK_RUN_TIMEOUT_SECONDS;
}

export function buildPollingPrompt(
  workflowId: string,
  agentId: string,
  workModel?: string,
  workRunTimeoutSeconds = DEFAULT_WORK_RUN_TIMEOUT_SECONDS,
): string {
  const fullAgentId = `${workflowId}_${agentId}`;
  const cli = resolveAntfarmCli();
  const model = workModel ?? "default";
  const workPrompt = buildWorkPrompt(workflowId, agentId);

  return `Step 1 — Quick check for pending work (lightweight, no side effects):
\`\`\`
node ${cli} step peek "${fullAgentId}"
\`\`\`
If output is "NO_WORK", reply HEARTBEAT_OK and stop immediately. Do NOT run step claim.

Step 2 — If "HAS_WORK", claim the step:
\`\`\`
node ${cli} step claim "${fullAgentId}"
\`\`\`
If output is "NO_WORK", reply HEARTBEAT_OK and stop.

If JSON is returned, parse it to extract stepId, runId, and input fields.
Then call sessions_spawn with these parameters:
- agentId: "${fullAgentId}"
- model: "${model}"
- runTimeoutSeconds: ${workRunTimeoutSeconds}
- task: The full work prompt below, followed by "\\n\\nCLAIMED STEP JSON:\\n" and the exact JSON output from step claim.

Immediately after calling sessions_spawn, check whether the session was spawned successfully. If sessions_spawn returns an error or does not return a session ID, retry the call up to three times before giving up.

Full work prompt to include in the spawned task:
---START WORK PROMPT---
${workPrompt}
---END WORK PROMPT---

Reply with a short summary of what you spawned.`;
}

export async function setupAgentCrons(workflow: WorkflowSpec): Promise<void> {
  const agents = workflow.agents;
  // Allow per-workflow cron interval via cron.interval_ms in workflow.yml
  const everyMs = (workflow as any).cron?.interval_ms ?? DEFAULT_EVERY_MS;

  // Resolve polling model: per-agent > workflow-level > default
  const workflowPollingModel = workflow.polling?.model ?? DEFAULT_POLLING_MODEL;
  const workflowPollingTimeout = workflow.polling?.timeoutSeconds ?? DEFAULT_POLLING_TIMEOUT_SECONDS;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const anchorMs = i * 60_000; // stagger by 1 minute each
    const cronName = `antfarm/${workflow.id}/${agent.id}`;
    const agentId = `${workflow.id}_${agent.id}`;

    // Two-phase: Phase 1 uses cheap polling model + minimal prompt
    const requestedPollingModel = agent.pollingModel ?? workflowPollingModel;
    const pollingModel = await resolveAgentCronModel(agentId, requestedPollingModel);
    const requestedWorkModel = agent.model ?? workflowPollingModel;
    const workModel = await resolveAgentCronModel(agentId, requestedWorkModel);
    const workRunTimeoutSeconds = resolveWorkRunTimeoutSeconds(agent);
    const prompt = buildPollingPrompt(workflow.id, agent.id, workModel, workRunTimeoutSeconds);
    const timeoutSeconds = workflowPollingTimeout;

    const result = await createAgentCronJob({
      name: cronName,
      schedule: { kind: "every", everyMs, anchorMs },
      sessionTarget: "isolated",
      agentId,
      payload: { kind: "agentTurn", message: prompt, model: pollingModel, timeoutSeconds },
      delivery: { mode: "none" },
      enabled: true,
    });

    if (!result.ok) {
      throw new Error(`Failed to create cron job for agent "${agent.id}": ${result.error}`);
    }
  }
}

export async function removeAgentCrons(workflowId: string): Promise<void> {
  await deleteAgentCronJobs(`antfarm/${workflowId}/`);
}

// ── Run-scoped cron lifecycle ───────────────────────────────────────

/**
 * Count active (running) runs for a given workflow.
 */
function countActiveRuns(workflowId: string): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM runs WHERE workflow_id = ? AND status = 'running'"
  ).get(workflowId) as { cnt: number };
  return row.cnt;
}

/**
 * Check if crons already exist for a workflow.
 */
async function workflowCronsExist(workflowId: string): Promise<boolean> {
  const result = await listCronJobs();
  if (!result.ok || !result.jobs) return false;
  const prefix = `antfarm/${workflowId}/`;
  return result.jobs.some((j) => j.name.startsWith(prefix));
}

/**
 * Start crons for a workflow when a run begins.
 * No-ops if crons already exist (another run of the same workflow is active).
 */
export async function ensureWorkflowCrons(workflow: WorkflowSpec): Promise<void> {
  // No-op in test environments
  if (process.env.ANTFARM_SKIP_CRON === '1') return;

  if (await workflowCronsExist(workflow.id)) return;

  // Preflight: verify cron tool is accessible before attempting to create jobs
  const preflight = await checkCronToolAvailable();
  if (!preflight.ok) {
    throw new Error(preflight.error!);
  }

  await setupAgentCrons(workflow);
}

/**
 * Tear down crons for a workflow when a run ends.
 * Only removes if no other active runs exist for this workflow.
 */
export async function teardownWorkflowCronsIfIdle(workflowId: string): Promise<void> {
  // No-op in test environments
  if (process.env.ANTFARM_SKIP_CRON === '1') return;

  const active = countActiveRuns(workflowId);
  if (active > 0) return;
  await removeAgentCrons(workflowId);
}
