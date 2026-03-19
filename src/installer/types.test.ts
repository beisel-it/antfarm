import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WorkflowSpec, AgentRole, WorkflowAgent } from "./types.js";

describe("WorkflowSpec types", () => {
  it("validates that AgentRole supports ops workflow roles", () => {
    const opsRoles: AgentRole[] = ["analysis", "coding", "verification"];
    
    // Verify all ops workflow roles are valid AgentRole values
    for (const role of opsRoles) {
      const validRoles: AgentRole[] = ["analysis", "coding", "verification", "testing", "pr", "scanning"];
      assert.ok(validRoles.includes(role), `${role} should be a valid AgentRole`);
    }
  });

  it("creates a valid ops workflow spec using existing types", () => {
    const opsWorkflow: WorkflowSpec = {
      id: "ops-workflow",
      name: "Operations Workflow",
      version: 1,
      agents: [
        {
          id: "analyzer",
          name: "System Analyzer",
          description: "Assess system state and plan changes",
          role: "analysis",
          workspace: {
            baseDir: "agents/analyzer",
            files: {
              "AGENTS.md": "Analyzer agent instructions",
            },
          },
        },
        {
          id: "implementer",
          name: "Configuration Implementer",
          description: "Apply system configuration changes",
          role: "coding",
          workspace: {
            baseDir: "agents/implementer",
            files: {
              "AGENTS.md": "Implementer agent instructions",
            },
          },
        },
        {
          id: "verifier",
          name: "System Verifier",
          description: "Validate changes and system health",
          role: "verification",
          workspace: {
            baseDir: "agents/verifier",
            files: {
              "AGENTS.md": "Verifier agent instructions",
            },
          },
        },
      ],
      steps: [
        {
          id: "analyze",
          agent: "analyzer",
          input: "Document current system state and plan configuration changes",
          expects: "Analysis report with planned changes",
        },
        {
          id: "implement",
          agent: "implementer",
          input: "Apply the configuration changes: {{analyze.output}}",
          expects: "Configuration changes applied successfully",
        },
        {
          id: "verify",
          agent: "verifier",
          input: "Verify system health and confirm changes: {{implement.output}}",
          expects: "Verification report confirming system is healthy",
        },
      ],
    };

    // Type assertions - if these compile, the types are correct
    assert.equal(opsWorkflow.id, "ops-workflow");
    assert.equal(opsWorkflow.agents.length, 3);
    assert.equal(opsWorkflow.steps.length, 3);
    
    // Verify agent roles are properly typed
    const analyzer = opsWorkflow.agents.find((a) => a.id === "analyzer");
    assert.equal(analyzer?.role, "analysis");
    
    const implementer = opsWorkflow.agents.find((a) => a.id === "implementer");
    assert.equal(implementer?.role, "coding");
    
    const verifier = opsWorkflow.agents.find((a) => a.id === "verifier");
    assert.equal(verifier?.role, "verification");
  });

  it("validates WorkflowAgent structure for ops workflow", () => {
    const opsAgent: WorkflowAgent = {
      id: "test-ops-agent",
      name: "Test Ops Agent",
      description: "Test operations agent",
      role: "coding",
      model: "anthropic/claude-sonnet-4-5",
      timeoutSeconds: 600,
      workspace: {
        baseDir: "agents/test",
        files: {
          "AGENTS.md": "Test agent",
          "TOOLS.md": "Test tools",
        },
        skills: ["healthcheck", "github"],
      },
    };

    assert.equal(opsAgent.id, "test-ops-agent");
    assert.equal(opsAgent.role, "coding");
    assert.ok(opsAgent.workspace.files["AGENTS.md"]);
    assert.equal(opsAgent.workspace.skills?.length, 2);
  });

  it("validates that ops workflow can use optional workflow features", () => {
    const opsWorkflowWithFeatures: WorkflowSpec = {
      id: "ops-with-features",
      name: "Ops Workflow with Features",
      version: 1,
      polling: {
        model: "anthropic/claude-sonnet-4-5",
        timeoutSeconds: 300,
      },
      agents: [
        {
          id: "analyzer",
          role: "analysis",
          workspace: {
            baseDir: "agents/analyzer",
            files: { "AGENTS.md": "content" },
          },
        },
      ],
      steps: [
        {
          id: "analyze",
          agent: "analyzer",
          input: "Analyze system",
          expects: "Analysis complete",
          max_retries: 2,
          on_fail: {
            retry_step: "analyze",
            max_retries: 2,
            escalate_to: "human-operator",
          },
        },
      ],
      context: {
        systemType: "nginx",
        targetHost: "web-server-01",
      },
      notifications: {
        url: "https://example.com/webhook",
      },
    };

    assert.ok(opsWorkflowWithFeatures.polling);
    assert.equal(opsWorkflowWithFeatures.context?.systemType, "nginx");
    assert.ok(opsWorkflowWithFeatures.notifications?.url);
    assert.equal(opsWorkflowWithFeatures.steps[0].on_fail?.escalate_to, "human-operator");
  });
});
