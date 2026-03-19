import crypto from "node:crypto";
import { execSync } from "node:child_process";
import os from "node:os";
import { loadWorkflowSpec } from "./workflow-spec.js";
import { resolveWorkflowDir } from "./paths.js";
import { getDb, nextRunNumber } from "../db.js";
import { logger } from "../lib/logger.js";
import { ensureWorkflowCrons } from "./agent-cron.js";
import { emitEvent } from "./events.js";

/**
 * Extract a repository path from a task title string.
 * Looks for the first token that matches an absolute or home-relative path,
 * or a path explicitly prefixed with "REPO:" or "Repo:".
 * 
 * @param taskTitle - The task title string to parse
 * @returns The extracted repo path, or null if none found
 * 
 * @example
 * extractRepoPath("/home/user/repo add feature") // "/home/user/repo"
 * extractRepoPath("REPO: ~/myrepo fix bug") // "~/myrepo"
 * extractRepoPath("add feature to app") // null
 */
export function extractRepoPath(taskTitle: string): string | null {
  // Check for explicit REPO: or Repo: prefix
  const repoMatch = taskTitle.match(/\b(?:REPO|Repo):\s*(\S+)/);
  if (repoMatch) {
    return repoMatch[1];
  }

  // Look for first token that starts with / or ~/
  const tokens = taskTitle.split(/\s+/);
  for (const token of tokens) {
    if (/^(\/|~\/)/.test(token)) {
      return token;
    }
  }

  return null;
}

/**
 * Validate that a path is a valid git repository.
 * Expands ~ to the home directory and checks if the path contains a .git directory.
 * 
 * @param path - The path to validate (can be absolute, relative, or home-relative with ~)
 * @returns true if the path is a valid git repository, false otherwise
 * 
 * @example
 * isGitRepo("/home/user/myrepo") // true if valid git repo
 * isGitRepo("~/projects/app") // true if valid git repo (expands ~)
 * isGitRepo("/tmp/notrepo") // false
 */
export function isGitRepo(path: string): boolean {
  // Handle empty string - not a valid path
  if (!path || path.trim() === "") {
    return false;
  }

  try {
    // Expand ~ to home directory
    const expandedPath = path.startsWith("~/") 
      ? path.replace(/^~/, os.homedir())
      : path;

    // Use git rev-parse to check if it's a valid git repository
    execSync("git -C " + JSON.stringify(expandedPath) + " rev-parse --git-dir", {
      stdio: "ignore", // Suppress output
      encoding: "utf8"
    });
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Computes a stable 16-character hex lock key for a resolved repo path.
 * Used to create consistent lock keys for DB queries.
 *
 * @example
 * computeRepoLockKey("/home/user/myrepo") // "a1b2c3d4e5f67890"
 * computeRepoLockKey("/home/user/other")  // different 16-char hex string
 */
export function computeRepoLockKey(resolvedPath: string): string {
  return crypto.createHash("sha256").update(resolvedPath).digest("hex").slice(0, 16);
}

export async function runWorkflow(params: {
  workflowId: string;
  taskTitle: string;
  notifyUrl?: string;
}): Promise<{ id: string; runNumber: number; workflowId: string; task: string; status: string }> {
  const workflowDir = resolveWorkflowDir(params.workflowId);
  const workflow = await loadWorkflowSpec(workflowDir);
  const db = getDb();
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const runNumber = nextRunNumber();

  const initialContext: Record<string, string> = {
    task: params.taskTitle,
    ...workflow.context,
  };

  db.exec("BEGIN");
  try {
    const notifyUrl = params.notifyUrl ?? workflow.notifications?.url ?? null;
    const insertRun = db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, notify_url, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)"
    );
    insertRun.run(runId, runNumber, workflow.id, params.taskTitle, JSON.stringify(initialContext), notifyUrl, now, now);

    const insertStep = db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, max_retries, type, loop_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepUuid = crypto.randomUUID();
      const agentId = `${workflow.id}_${step.agent}`;
      const status = i === 0 ? "pending" : "waiting";
      const maxRetries = step.max_retries ?? step.on_fail?.max_retries ?? 2;
      const stepType = step.type ?? "single";
      const loopConfig = step.loop ? JSON.stringify(step.loop) : null;
      insertStep.run(stepUuid, runId, step.id, agentId, i, step.input, step.expects, status, maxRetries, stepType, loopConfig, now, now);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  // Start crons for this workflow (no-op if already running from another run)
  try {
    await ensureWorkflowCrons(workflow);
  } catch (err) {
    // Roll back the run since it can't advance without crons
    const db2 = getDb();
    db2.prepare("UPDATE runs SET status = 'failed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), runId);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot start workflow run: cron setup failed. ${message}`);
  }

  emitEvent({ ts: new Date().toISOString(), event: "run.started", runId, workflowId: workflow.id });

  logger.info(`Run started: "${params.taskTitle}"`, {
    workflowId: workflow.id,
    runId,
    stepId: workflow.steps[0]?.id,
  });

  return { id: runId, runNumber, workflowId: workflow.id, task: params.taskTitle, status: "running" };
}
