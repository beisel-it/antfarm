import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowContent = readFileSync(
  resolve(import.meta.dirname, "../workflows/feature-dev/workflow.yml"),
  "utf-8"
);
const developerAgents = readFileSync(
  resolve(import.meta.dirname, "../workflows/feature-dev/agents/developer/AGENTS.md"),
  "utf-8"
);
const verifierAgents = readFileSync(
  resolve(import.meta.dirname, "../agents/shared/verifier/AGENTS.md"),
  "utf-8"
);
const cliSource = readFileSync(
  resolve(import.meta.dirname, "../src/cli/cli.ts"),
  "utf-8"
);

describe("contract helper prompts and usage", () => {
  it("developer instructions call for the contract commit wrapper", () => {
    assert.match(developerAgents, /antfarm contract commit/);
    assert.ok(
      developerAgents.includes("contract wrapper"),
      "Developer instructions should prefer contract commit wrapper"
    );
  });

  it("workflow implement step instructs using the contract commit wrapper", () => {
    assert.ok(
      workflowContent.includes("antfarm contract commit"),
      "Implement step should reference contract commit wrapper"
    );
  });

  it("workflow verify step references contract verify-criteria helper", () => {
    assert.ok(
      workflowContent.includes("contract verify-criteria"),
      "Verify step should direct using the criterion verifier helper"
    );
  });

  it("verifier agent instructions mention contract verify-criteria decisions", () => {
    assert.ok(verifierAgents.includes("contract verify-criteria"));
    assert.match(verifierAgents, /pass\/fail\/needs-work/);
  });

  it("CLI usage/help advertises the contract helper commands and flags", () => {
    assert.ok(cliSource.includes("contract commit --message"));
    assert.ok(cliSource.includes("contract verify-criteria"));
    assert.ok(cliSource.includes("--decisions"));
  });
});
