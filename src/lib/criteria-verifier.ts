import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import JSON5 from "json5";

export type CriterionInput = string | { id?: string; description?: string; text?: string; criterion?: string; name?: string };
export type CriterionStatus = "pass" | "fail" | "needs-work";

export interface Criterion {
  id: string;
  text: string;
}

export interface CriterionDecision {
  id?: string;
  status: CriterionStatus | string;
  note?: string;
}

export interface CriterionResult extends Criterion {
  status: CriterionStatus;
  note?: string;
}

export interface VerifyCriteriaResult {
  overall: "pass" | "needs-work";
  criteria: CriterionResult[];
}

function normalizeStatus(value: string | undefined): CriterionStatus | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  if (normalized === "pass" || normalized === "fail" || normalized === "needs-work") {
    return normalized as CriterionStatus;
  }
  if (normalized === "needswork") return "needs-work";
  return null;
}

function extractCriterionText(input: CriterionInput): string | undefined {
  if (typeof input === "string") return input;
  return input.description ?? input.text ?? input.criterion ?? input.name;
}

export function parseCriteriaValue(raw: unknown): Criterion[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Criteria must be a non-empty array");
  }

  return raw.map((item, idx) => {
    const text = extractCriterionText(item as CriterionInput);
    if (!text || typeof text !== "string") {
      throw new Error(`Invalid criterion at index ${idx}`);
    }
    const id = typeof item === "object" && item !== null && typeof (item as any).id === "string" && (item as any).id.trim()
      ? (item as any).id.trim()
      : `c${idx + 1}`;
    return { id, text: text.trim() } satisfies Criterion;
  });
}

export function loadCriteriaFromFile(filePath: string): Criterion[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON5.parse(content);
  return parseCriteriaValue(parsed);
}

export function parseCriteriaJson(json: string): Criterion[] {
  const parsed = JSON5.parse(json);
  return parseCriteriaValue(parsed);
}

function buildResultsFromStatuses(criteria: Criterion[], statuses: string[]): CriterionResult[] {
  if (statuses.length !== criteria.length) {
    throw new Error(`Expected ${criteria.length} statuses but received ${statuses.length}`);
  }

  return criteria.map((criterion, idx) => {
    const status = normalizeStatus(statuses[idx]);
    if (!status) {
      throw new Error(`Invalid status for ${criterion.id}; expected pass/fail/needs-work`);
    }
    return { ...criterion, status } satisfies CriterionResult;
  });
}

function buildResultsFromDecisions(criteria: Criterion[], decisions: CriterionDecision[]): CriterionResult[] {
  const decisionsById = new Map<string, CriterionDecision>();
  const indexedDecisions = new Map<number, CriterionDecision>();

  decisions.forEach((decision, idx) => {
    const status = normalizeStatus(typeof decision.status === "string" ? decision.status : undefined);
    if (!status) {
      throw new Error(`Invalid status in decision at index ${idx}; expected pass/fail/needs-work`);
    }
    const key = decision.id?.trim();
    const normalizedDecision: CriterionDecision = { ...decision, id: key, status };
    if (key) {
      decisionsById.set(key, normalizedDecision);
    } else {
      indexedDecisions.set(idx, normalizedDecision);
    }
  });

  return criteria.map((criterion, idx) => {
    const decision = decisionsById.get(criterion.id) ?? indexedDecisions.get(idx);
    if (!decision) {
      throw new Error(`Missing decision for criterion ${criterion.id}`);
    }
    const status = normalizeStatus(typeof decision.status === "string" ? decision.status : undefined);
    if (!status) {
      throw new Error(`Invalid status for criterion ${criterion.id}; expected pass/fail/needs-work`);
    }
    return { ...criterion, status, note: decision.note } satisfies CriterionResult;
  });
}

export function parseDecisionsValue(raw: unknown, criteria: Criterion[]): CriterionResult[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Decisions must be an array of statuses or decision objects");
  }

  if (raw.every((item) => typeof item === "string")) {
    return buildResultsFromStatuses(criteria, raw as string[]);
  }

  return buildResultsFromDecisions(criteria, raw as CriterionDecision[]);
}

export function parseDecisionsJson(json: string, criteria: Criterion[]): CriterionResult[] | undefined {
  const parsed = JSON5.parse(json);
  return parseDecisionsValue(parsed, criteria);
}

async function collectInteractiveDecisions(criteria: Criterion[]): Promise<CriterionResult[]> {
  const rl = readline.createInterface({ input, output });
  const results: CriterionResult[] = [];

  try {
    for (const criterion of criteria) {
      let answer: string | null = null;
      while (!answer) {
        const response = await rl.question(`Criterion ${criterion.id}: ${criterion.text}\nStatus (pass/fail/needs-work): `);
        const status = normalizeStatus(response);
        if (status) {
          answer = status;
          results.push({ ...criterion, status });
        } else {
          output.write("Please enter pass, fail, or needs-work.\n");
        }
      }
      output.write("\n");
    }
  } finally {
    rl.close();
  }

  return results;
}

export async function verifyCriteria(options: {
  criteria: Criterion[];
  decisions?: CriterionResult[];
  logger?: (line: string) => void;
}): Promise<VerifyCriteriaResult> {
  const { criteria, decisions, logger } = options;

  const results = decisions ?? await collectInteractiveDecisions(criteria);

  results.forEach((r) => {
    logger?.(`[${r.status.toUpperCase()}] ${r.id}: ${r.text}${r.note ? ` — ${r.note}` : ""}`);
  });

  const hasIssues = results.some((r) => r.status !== "pass");
  return {
    overall: hasIssues ? "needs-work" : "pass",
    criteria: results,
  } satisfies VerifyCriteriaResult;
}
