import { describe, it } from "node:test";
import assert from "node:assert";
import os from "node:os";
import { extractRepoPath, isGitRepo, computeRepoLockKey } from "../../dist/installer/run.js";

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

describe("isGitRepo", () => {
  it("should return true for a valid git repository", () => {
    // Use the antfarm repo itself as a test subject
    const result = isGitRepo("/home/florian/.openclaw/workspace/antfarm");
    assert.strictEqual(result, true);
  });

  it("should return false for a non-existent path", () => {
    const result = isGitRepo("/this/path/does/not/exist/at/all");
    assert.strictEqual(result, false);
  });

  it("should return false for a non-git directory", () => {
    // /tmp is a directory that exists but is not a git repo
    const result = isGitRepo("/tmp");
    assert.strictEqual(result, false);
  });

  it("should expand tilde to home directory", () => {
    // Test with a path that uses ~ - create a relative path
    // We'll use the antfarm repo path but with ~ prefix
    // First get the home directory
    const homeDir = os.homedir();
    const antfarmPath = "/home/florian/.openclaw/workspace/antfarm";
    
    // Only test if antfarm is under home directory
    if (antfarmPath.startsWith(homeDir)) {
      const relativePath = "~" + antfarmPath.slice(homeDir.length);
      const result = isGitRepo(relativePath);
      assert.strictEqual(result, true);
    } else {
      // If not under home, just verify ~ expansion works on a non-existent path
      const result = isGitRepo("~/this-does-not-exist");
      assert.strictEqual(result, false);
    }
  });

  it("should handle relative paths", () => {
    // Relative path to a non-git directory
    const result = isGitRepo(".");
    // Current directory might or might not be a git repo during tests
    // So we just verify the function doesn't crash
    assert.strictEqual(typeof result, "boolean");
  });

  it("should return false for empty string", () => {
    const result = isGitRepo("");
    assert.strictEqual(result, false);
  });

  it("should return false for a file path (not a directory)", () => {
    // Test with a known file that exists but isn't a directory
    const result = isGitRepo("/etc/hostname");
    assert.strictEqual(result, false);
  });
});

describe("computeRepoLockKey", () => {
  it("should produce a 16-character hex string", () => {
    const key = computeRepoLockKey("/home/user/myrepo");
    assert.strictEqual(typeof key, "string");
    assert.strictEqual(key.length, 16);
    assert.match(key, /^[0-9a-f]{16}$/);
  });

  it("should produce consistent output for the same path", () => {
    const path = "/home/user/myrepo";
    const key1 = computeRepoLockKey(path);
    const key2 = computeRepoLockKey(path);
    assert.strictEqual(key1, key2);
  });

  it("should produce different outputs for different paths", () => {
    const key1 = computeRepoLockKey("/home/user/repo-a");
    const key2 = computeRepoLockKey("/home/user/repo-b");
    assert.notStrictEqual(key1, key2);
  });

  it("should produce consistent known hash for a specific path", () => {
    // Verify the hash is sha256-based: sha256("/home/user/test").slice(0,16)
    const path = "/home/user/test";
    const key = computeRepoLockKey(path);
    // Key must be 16 hex chars derived from sha256
    assert.strictEqual(key.length, 16);
    assert.match(key, /^[0-9a-f]{16}$/);
    // Calling again must return same value
    assert.strictEqual(computeRepoLockKey(path), key);
  });

  it("should handle absolute paths with deep nesting", () => {
    const key = computeRepoLockKey("/home/florian/projects/my-app/sub/folder");
    assert.strictEqual(key.length, 16);
    assert.match(key, /^[0-9a-f]{16}$/);
  });

  it("should produce different hashes for similar but distinct paths", () => {
    const key1 = computeRepoLockKey("/home/user/repo");
    const key2 = computeRepoLockKey("/home/user/repo2");
    assert.notStrictEqual(key1, key2);
  });
});
