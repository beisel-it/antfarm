import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../db.js";
import { resolveBundledWorkflowsDir } from "../installer/paths.js";
import {
  listBacklogEntries,
  addBacklogEntry,
  updateBacklogEntry,
  deleteBacklogEntry,
  getBacklogEntry,
} from "../backlog/index.js";
import {
  listProjects,
  addProject,
  updateProject,
  deleteProject,
  getProject,
} from "../projects/index.js";
import YAML from "yaml";
import { runWorkflow } from "../installer/run.js";

import type { RunInfo, StepInfo } from "../installer/status.js";
import { getRunEvents } from "../installer/events.js";
import { getMedicStatus, getRecentMedicChecks } from "../medic/medic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface WorkflowDef {
  id: string;
  name: string;
  steps: Array<{ id: string; agent: string }>;
}

function loadWorkflows(): WorkflowDef[] {
  const dir = resolveBundledWorkflowsDir();
  const results: WorkflowDef[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const ymlPath = path.join(dir, entry.name, "workflow.yml");
      if (!fs.existsSync(ymlPath)) continue;
      const parsed = YAML.parse(fs.readFileSync(ymlPath, "utf-8"));
      results.push({
        id: parsed.id ?? entry.name,
        name: parsed.name ?? entry.name,
        steps: (parsed.steps ?? []).map((s: any) => ({ id: s.id, agent: s.agent })),
      });
    }
  } catch { /* empty */ }
  return results;
}

function getRuns(workflowId?: string): Array<RunInfo & { steps: StepInfo[] }> {
  const db = getDb();
  const runs = workflowId
    ? db.prepare("SELECT * FROM runs WHERE workflow_id = ? ORDER BY created_at DESC").all(workflowId) as RunInfo[]
    : db.prepare("SELECT * FROM runs ORDER BY created_at DESC").all() as RunInfo[];
  return runs.map((r) => {
    const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(r.id) as StepInfo[];
    return { ...r, steps };
  });
}

function getRunById(id: string): (RunInfo & { steps: StepInfo[] }) | null {
  const db = getDb();
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunInfo | undefined;
  if (!run) return null;
  const steps = db.prepare("SELECT * FROM steps WHERE run_id = ? ORDER BY step_index ASC").all(run.id) as StepInfo[];
  return { ...run, steps };
}

function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function serveHTML(res: http.ServerResponse) {
  const htmlPath = path.join(__dirname, "index.html");
  // In dist, index.html won't exist—serve from src
  const srcHtmlPath = path.resolve(__dirname, "..", "..", "src", "server", "index.html");
  const filePath = fs.existsSync(htmlPath) ? htmlPath : srcHtmlPath;
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fs.readFileSync(filePath, "utf-8"));
}

function readBody(req: http.IncomingMessage, cb: (body: string) => void): void {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => cb(Buffer.concat(chunks).toString("utf-8")));
}

function findBacklogEntryById(id: string) {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM backlog WHERE id = ? OR id LIKE ? LIMIT 1")
    .get(id, `${id}%`) as { id: string } | undefined;
  if (!row) return null;
  return getBacklogEntry(row.id);
}

export function startDashboard(port = 3333): http.Server {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const p = url.pathname;

    if (p === "/api/workflows") {
      return json(res, loadWorkflows());
    }

    const eventsMatch = p.match(/^\/api\/runs\/([^/]+)\/events$/);
    if (eventsMatch) {
      return json(res, getRunEvents(eventsMatch[1]));
    }

    const storiesMatch = p.match(/^\/api\/runs\/([^/]+)\/stories$/);
    if (storiesMatch) {
      const db = getDb();
      const stories = db.prepare(
        "SELECT * FROM stories WHERE run_id = ? ORDER BY story_index ASC"
      ).all(storiesMatch[1]);
      return json(res, stories);
    }

    const runMatch = p.match(/^\/api\/runs\/(.+)$/);
    if (runMatch) {
      const run = getRunById(runMatch[1]);
      return run ? json(res, run) : json(res, { error: "not found" }, 404);
    }

    if (p === "/api/runs") {
      const wf = url.searchParams.get("workflow") ?? undefined;
      return json(res, getRuns(wf));
    }

    // Medic API
    if (p === "/api/medic/status") {
      return json(res, getMedicStatus());
    }

    if (p === "/api/medic/checks") {
      const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
      return json(res, getRecentMedicChecks(limit));
    }

    // Backlog API
    if (p === "/api/backlog" && req.method === "GET") {
      return json(res, listBacklogEntries());
    }

    if (p === "/api/backlog" && req.method === "POST") {
      return readBody(req, (body) => {
        try {
          const data = JSON.parse(body);
          if (!data.title || typeof data.title !== "string") {
            return json(res, { error: "title is required" }, 400);
          }
          const entry = addBacklogEntry({
            title: data.title,
            description: data.description,
            priority: data.priority,
          });
          return json(res, entry, 201);
        } catch {
          return json(res, { error: "invalid JSON" }, 400);
        }
      });
    }

    const backlogDispatchMatch = p.match(/^\/api\/backlog\/([^/]+)\/dispatch$/);
    if (backlogDispatchMatch && req.method === "POST") {
      const id = backlogDispatchMatch[1];
      const entry = findBacklogEntryById(id);
      if (!entry) return json(res, { error: "not found" }, 404);
      return readBody(req, async (body) => {
        try {
          let workflowId: string | undefined;
          try {
            const data = body ? JSON.parse(body) : {};
            workflowId = data.workflowId;
          } catch {
            // ignore parse errors — body is optional
          }

          // Default to first installed workflow if none specified
          if (!workflowId) {
            const workflows = loadWorkflows();
            if (workflows.length === 0) {
              return json(res, { error: "no workflows installed" }, 400);
            }
            workflowId = workflows[0].id;
          }

          const taskTitle = entry.title + (entry.description ? "\n\n" + entry.description : "");
          const run = await runWorkflow({ workflowId, taskTitle });

          updateBacklogEntry(entry.id, { status: "dispatched", run_id: run.id });

          return json(res, { ok: true, runId: run.id, runNumber: run.runNumber });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return json(res, { error: message }, 400);
        }
      });
    }

    const backlogIdMatch = p.match(/^\/api\/backlog\/([^/]+)$/);
    if (backlogIdMatch && req.method === "PATCH") {
      const id = backlogIdMatch[1];
      return readBody(req, (body) => {
        try {
          const data = JSON.parse(body);
          const entry = findBacklogEntryById(id);
          if (!entry) return json(res, { error: "not found" }, 404);
          const updated = updateBacklogEntry(entry.id, data);
          if (!updated) return json(res, { error: "not found" }, 404);
          return json(res, updated);
        } catch {
          return json(res, { error: "invalid JSON" }, 400);
        }
      });
    }

    if (backlogIdMatch && req.method === "DELETE") {
      const id = backlogIdMatch[1];
      const entry = findBacklogEntryById(id);
      if (!entry) return json(res, { error: "not found" }, 404);
      deleteBacklogEntry(entry.id);
      return json(res, { ok: true });
    }

    // Projects API
    if (p === "/api/projects" && req.method === "GET") {
      return json(res, listProjects());
    }

    if (p === "/api/projects" && req.method === "POST") {
      return readBody(req, (body) => {
        try {
          const data = JSON.parse(body);
          if (!data.name || typeof data.name !== "string") {
            return json(res, { error: "name is required" }, 400);
          }
          const project = addProject({
            name: data.name,
            gitRepoPath: data.gitRepoPath,
            githubRepoUrl: data.githubRepoUrl,
          });
          return json(res, project, 201);
        } catch {
          return json(res, { error: "invalid JSON" }, 400);
        }
      });
    }

    const projectIdMatch = p.match(/^\/api\/projects\/([^/]+)$/);

    if (projectIdMatch && req.method === "GET") {
      const id = projectIdMatch[1];
      const project = getProject(id);
      return project ? json(res, project) : json(res, { error: "not found" }, 404);
    }

    if (projectIdMatch && req.method === "PATCH") {
      const id = projectIdMatch[1];
      return readBody(req, (body) => {
        try {
          const data = JSON.parse(body);
          const updated = updateProject(id, data);
          if (!updated) return json(res, { error: "not found" }, 404);
          return json(res, updated);
        } catch {
          return json(res, { error: "invalid JSON" }, 400);
        }
      });
    }

    if (projectIdMatch && req.method === "DELETE") {
      const id = projectIdMatch[1];
      const deleted = deleteProject(id);
      if (!deleted) return json(res, { error: "not found" }, 404);
      return json(res, { ok: true });
    }

    // Serve fonts
    if (p.startsWith("/fonts/")) {
      const fontName = path.basename(p);
      const fontPath = path.resolve(__dirname, "..", "..", "assets", "fonts", fontName);
      const srcFontPath = path.resolve(__dirname, "..", "..", "src", "..", "assets", "fonts", fontName);
      const resolvedFont = fs.existsSync(fontPath) ? fontPath : srcFontPath;
      if (fs.existsSync(resolvedFont)) {
        res.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000", "Access-Control-Allow-Origin": "*" });
        return res.end(fs.readFileSync(resolvedFont));
      }
    }

    // Serve logo
    if (p === "/logo.jpeg") {
      const logoPath = path.resolve(__dirname, "..", "..", "assets", "logo.jpeg");
      const srcLogoPath = path.resolve(__dirname, "..", "..", "src", "..", "assets", "logo.jpeg");
      const resolvedLogo = fs.existsSync(logoPath) ? logoPath : srcLogoPath;
      if (fs.existsSync(resolvedLogo)) {
        res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
        return res.end(fs.readFileSync(resolvedLogo));
      }
    }

    // Serve frontend
    serveHTML(res);
  });

  server.listen(port, () => {
    console.log(`Antfarm Dashboard: http://localhost:${port}`);
  });

  return server;
}
