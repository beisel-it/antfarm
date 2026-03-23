import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("feature-dev workflow contracts", () => {
  const workflowPath = path.resolve(process.cwd(), "workflows/feature-dev/workflow.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");

  it("requires repo, branch, and stories from planner output", () => {
    assert.match(workflow, /- id: plan[\s\S]*?expects: "STATUS: done, REPO, BRANCH, STORIES_JSON"/);
  });

  it("requires build and test commands from setup output", () => {
    assert.match(workflow, /- id: setup[\s\S]*?expects: "STATUS: done, BUILD_CMD, TEST_CMD, CI_NOTES, BASELINE"/);
  });

  it("requires changes and tests from developer output", () => {
    assert.match(workflow, /- id: implement[\s\S]*?expects: "STATUS: done, CHANGES, TESTS"/);
  });
});
