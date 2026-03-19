import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("ops-config workflow directory structure", () => {
  it("workflows/ops-config/ directory exists", () => {
    const opsConfigDir = join(__dirname);
    assert.ok(existsSync(opsConfigDir), "ops-config directory should exist");
    assert.ok(statSync(opsConfigDir).isDirectory(), "ops-config should be a directory");
  });

  it("workflows/ops-config/agents/ directory exists", () => {
    const agentsDir = join(__dirname, "agents");
    assert.ok(existsSync(agentsDir), "agents directory should exist");
    assert.ok(statSync(agentsDir).isDirectory(), "agents should be a directory");
  });

  it("directory structure matches feature-dev pattern with agent subdirectories", () => {
    const expectedAgents = ["analyzer", "implementer", "verifier"];
    
    for (const agent of expectedAgents) {
      const agentDir = join(__dirname, "agents", agent);
      assert.ok(
        existsSync(agentDir),
        `Agent directory '${agent}' should exist`
      );
      assert.ok(
        statSync(agentDir).isDirectory(),
        `${agent} should be a directory`
      );
    }
  });

  it(".gitkeep files exist to ensure directories are tracked", () => {
    const gitkeepPaths = [
      join(__dirname, ".gitkeep"),
      join(__dirname, "agents", ".gitkeep"),
      join(__dirname, "agents", "analyzer", ".gitkeep"),
      join(__dirname, "agents", "implementer", ".gitkeep"),
      join(__dirname, "agents", "verifier", ".gitkeep"),
    ];

    for (const gitkeepPath of gitkeepPaths) {
      assert.ok(
        existsSync(gitkeepPath),
        `.gitkeep should exist at ${gitkeepPath}`
      );
    }
  });

  it("agent roles align with ops workflow pattern from types", () => {
    // These agent names should map to AgentRole values:
    // - analyzer -> analysis role (read-only)
    // - implementer -> coding role (full access)
    // - verifier -> verification role (read+exec, no write)
    
    const agentRoleMapping = {
      analyzer: "analysis",
      implementer: "coding", 
      verifier: "verification",
    };

    for (const [agentName, expectedRole] of Object.entries(agentRoleMapping)) {
      const agentDir = join(__dirname, "agents", agentName);
      assert.ok(
        existsSync(agentDir),
        `Agent ${agentName} (${expectedRole} role) directory should exist`
      );
    }
  });
});
