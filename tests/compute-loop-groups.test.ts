/**
 * US-002: Compute loop groups in the run API response
 * Tests for computeLoopGroups helper function
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StepInfo } from "../src/installer/status.js";
import { computeLoopGroups } from "../dist/server/loop-groups.js";

function makeStep(overrides: Partial<StepInfo> = {}): StepInfo {
  return {
    id: "step-id-1",
    run_id: "run-id-1",
    step_id: "step-1",
    agent_id: "agent-1",
    step_index: 0,
    input_template: "",
    expects: "",
    status: "pending",
    output: null,
    retry_count: 0,
    max_retries: 3,
    type: "single",
    loop_config: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("US-002: computeLoopGroups", () => {
  it("returns empty array when there are no steps", () => {
    const result = computeLoopGroups([]);
    assert.deepEqual(result, []);
  });

  it("returns empty array when all steps are type=single", () => {
    const steps = [
      makeStep({ id: "a1", step_id: "step-a", type: "single" }),
      makeStep({ id: "b1", step_id: "step-b", type: "single" }),
    ];
    const result = computeLoopGroups(steps);
    assert.deepEqual(result, []);
  });

  it("returns a loop group for a loop step with no verifyStep config", () => {
    const loopStep = makeStep({
      id: "loop-uuid",
      step_id: "implement",
      type: "loop",
      loop_config: JSON.stringify({ verifyEach: false }),
    });
    const result = computeLoopGroups([loopStep]);
    assert.equal(result.length, 1);
    assert.equal(result[0].loopStepId, "loop-uuid");
    assert.equal(result[0].verifyStepId, null);
    assert.deepEqual(result[0].stepIds, ["loop-uuid"]);
  });

  it("returns a loop group with verifyStepId when verifyStep is referenced", () => {
    const loopStep = makeStep({
      id: "implement-uuid",
      step_id: "implement",
      type: "loop",
      loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }),
    });
    const verifyStep = makeStep({
      id: "verify-uuid",
      step_id: "verify",
      type: "single",
    });
    const result = computeLoopGroups([loopStep, verifyStep]);
    assert.equal(result.length, 1);
    assert.equal(result[0].loopStepId, "implement-uuid");
    assert.equal(result[0].verifyStepId, "verify-uuid");
    assert.deepEqual(result[0].stepIds, ["implement-uuid", "verify-uuid"]);
  });

  it("sets verifyStepId to null when verifyStep step_id is not found", () => {
    const loopStep = makeStep({
      id: "loop-uuid",
      step_id: "implement",
      type: "loop",
      loop_config: JSON.stringify({ verifyEach: true, verifyStep: "nonexistent" }),
    });
    const result = computeLoopGroups([loopStep]);
    assert.equal(result.length, 1);
    assert.equal(result[0].verifyStepId, null);
    assert.deepEqual(result[0].stepIds, ["loop-uuid"]);
  });

  it("handles malformed loop_config JSON gracefully", () => {
    const loopStep = makeStep({
      id: "loop-uuid",
      step_id: "implement",
      type: "loop",
      loop_config: "not-valid-json{",
    });
    const result = computeLoopGroups([loopStep]);
    assert.equal(result.length, 1);
    assert.equal(result[0].verifyStepId, null);
  });

  it("handles null loop_config gracefully", () => {
    const loopStep = makeStep({
      id: "loop-uuid",
      step_id: "implement",
      type: "loop",
      loop_config: null,
    });
    const result = computeLoopGroups([loopStep]);
    assert.equal(result.length, 1);
    assert.equal(result[0].loopStepId, "loop-uuid");
    assert.equal(result[0].verifyStepId, null);
    assert.deepEqual(result[0].stepIds, ["loop-uuid"]);
  });

  it("handles multiple loop steps", () => {
    const loop1 = makeStep({
      id: "loop1-uuid",
      step_id: "implement",
      type: "loop",
      loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }),
    });
    const verify1 = makeStep({
      id: "verify1-uuid",
      step_id: "verify",
      type: "single",
    });
    const loop2 = makeStep({
      id: "loop2-uuid",
      step_id: "another-loop",
      type: "loop",
      loop_config: JSON.stringify({ verifyEach: false }),
    });
    const result = computeLoopGroups([loop1, verify1, loop2]);
    assert.equal(result.length, 2);
    assert.equal(result[0].loopStepId, "loop1-uuid");
    assert.equal(result[0].verifyStepId, "verify1-uuid");
    assert.deepEqual(result[0].stepIds, ["loop1-uuid", "verify1-uuid"]);
    assert.equal(result[1].loopStepId, "loop2-uuid");
    assert.equal(result[1].verifyStepId, null);
    assert.deepEqual(result[1].stepIds, ["loop2-uuid"]);
  });

  it("each loopGroup has the required shape: loopStepId, verifyStepId, stepIds", () => {
    const loopStep = makeStep({
      id: "implement-uuid",
      step_id: "implement",
      type: "loop",
      loop_config: JSON.stringify({ verifyEach: true, verifyStep: "verify" }),
    });
    const verifyStep = makeStep({
      id: "verify-uuid",
      step_id: "verify",
      type: "single",
    });
    const [group] = computeLoopGroups([loopStep, verifyStep]);
    assert.ok("loopStepId" in group, "should have loopStepId");
    assert.ok("verifyStepId" in group, "should have verifyStepId");
    assert.ok("stepIds" in group, "should have stepIds");
    assert.ok(Array.isArray(group.stepIds), "stepIds should be an array");
  });
});
