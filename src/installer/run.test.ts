import { describe, it } from "node:test";
import assert from "node:assert";
import { extractRepoPath } from "./run.js";

describe("extractRepoPath", () => {
  it("should extract absolute path from task string", () => {
    const result = extractRepoPath("/home/user/repo add feature");
    assert.strictEqual(result, "/home/user/repo");
  });

  it("should extract home-relative path from task string", () => {
    const result = extractRepoPath("implement ~/myrepo fix bug");
    assert.strictEqual(result, "~/myrepo");
  });

  it("should extract path after REPO: prefix", () => {
    const result = extractRepoPath("REPO: ~/myrepo fix bug");
    assert.strictEqual(result, "~/myrepo");
  });

  it("should extract path after Repo: prefix", () => {
    const result = extractRepoPath("Repo: /home/user/project add tests");
    assert.strictEqual(result, "/home/user/project");
  });

  it("should return null when no repo path is detected", () => {
    const result = extractRepoPath("add feature to app");
    assert.strictEqual(result, null);
  });

  it("should return first path when multiple paths exist", () => {
    const result = extractRepoPath("/home/user/repo1 and /home/user/repo2");
    assert.strictEqual(result, "/home/user/repo1");
  });

  it("should prefer REPO: prefix over other paths", () => {
    const result = extractRepoPath("/other/path REPO: ~/myrepo fix");
    assert.strictEqual(result, "~/myrepo");
  });

  it("should handle empty string", () => {
    const result = extractRepoPath("");
    assert.strictEqual(result, null);
  });

  it("should handle path at the end of string", () => {
    const result = extractRepoPath("add feature in /home/user/repo");
    assert.strictEqual(result, "/home/user/repo");
  });

  it("should handle relative paths with ./ prefix", () => {
    // This should NOT match since we only look for absolute or home-relative
    const result = extractRepoPath("./myrepo add feature");
    assert.strictEqual(result, null);
  });
});
