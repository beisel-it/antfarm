export type ContractStatus = "ok" | "error";

export interface ContractResult {
  status: ContractStatus;
  summary: string;
  data?: unknown;
  error?: unknown;
}

export interface ContractOutputOptions {
  /**
   * When true (default), sets process.exitCode to 1 for error results.
   * Set to false to avoid mutating exit code (useful in tests or callers that handle errors differently).
   */
  exitOnError?: boolean;
  /**
   * When true, throws an Error for error results after emitting output.
   */
  throwOnError?: boolean;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Emit a deterministic contract result in both human-readable and JSON forms.
 * Always writes to stdout. On error status, can optionally set exitCode and/or throw.
 */
export function writeContractOutput(
  result: ContractResult,
  options: ContractOutputOptions = {}
): ContractResult {
  const { exitOnError = true, throwOnError = false } = options;

  const payload: ContractResult = {
    status: result.status,
    summary: result.summary,
  };

  if (result.data !== undefined) {
    payload.data = result.data;
  }

  if (result.error !== undefined) {
    payload.error = result.error;
  }

  const humanLines = [
    `Status: ${payload.status}`,
    `Summary: ${payload.summary}`,
  ];

  if (payload.data !== undefined) {
    humanLines.push(`Data: ${stringifyValue(payload.data)}`);
  }

  if (payload.error !== undefined) {
    humanLines.push(`Error: ${stringifyValue(payload.error)}`);
  }

  process.stdout.write(`${humanLines.join("\n")}\n`);
  process.stdout.write(`${JSON.stringify(payload)}\n`);

  if (payload.status === "error") {
    if (throwOnError) {
      const message =
        typeof payload.error === "string" && payload.error.length > 0
          ? payload.error
          : payload.summary;
      const err = new Error(message);
      err.name = "ContractError";
      throw err;
    }

    if (exitOnError) {
      process.exitCode = 1;
    }
  }

  return payload;
}
