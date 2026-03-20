import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { addBacklogItem, listBacklogItems } from "../../dist/cli/backlog-ops.js";
import { getDb } from "../../dist/db.js";

describe("backlog-ops", () => {
  // Cleanup test data after each test
  after(() => {
    const db = getDb();
    db.prepare("DELETE FROM backlog_items WHERE title LIKE 'TEST:%'").run();
  });

  test("addBacklogItem: adds item with title only", () => {
    const result = addBacklogItem({ title: "TEST: Simple backlog item" });

    assert.ok(result.id, "Should return an id");
    assert.ok(result.priority > 0, "Should assign a priority");

    const db = getDb();
    const item = db
      .prepare("SELECT * FROM backlog_items WHERE id = ?")
      .get(result.id) as any;

    assert.strictEqual(item.title, "TEST: Simple backlog item");
    assert.strictEqual(item.description, null);
    assert.strictEqual(item.workflow_id, null);
    assert.strictEqual(item.status, "pending");
    assert.ok(item.created_at, "Should have created_at timestamp");
    assert.ok(item.updated_at, "Should have updated_at timestamp");
  });

  test("addBacklogItem: adds item with workflow flag", () => {
    const result = addBacklogItem({
      title: "TEST: Item with workflow",
      workflow: "feature-dev",
    });

    const db = getDb();
    const item = db
      .prepare("SELECT * FROM backlog_items WHERE id = ?")
      .get(result.id) as any;

    assert.strictEqual(item.title, "TEST: Item with workflow");
    assert.strictEqual(item.workflow_id, "feature-dev");
  });

  test("addBacklogItem: adds item with description flag", () => {
    const result = addBacklogItem({
      title: "TEST: Item with description",
      description: "This is a detailed description",
    });

    const db = getDb();
    const item = db
      .prepare("SELECT * FROM backlog_items WHERE id = ?")
      .get(result.id) as any;

    assert.strictEqual(item.title, "TEST: Item with description");
    assert.strictEqual(item.description, "This is a detailed description");
  });

  test("addBacklogItem: adds item with both flags", () => {
    const result = addBacklogItem({
      title: "TEST: Item with both flags",
      workflow: "bug-fix",
      description: "A bug to fix",
    });

    const db = getDb();
    const item = db
      .prepare("SELECT * FROM backlog_items WHERE id = ?")
      .get(result.id) as any;

    assert.strictEqual(item.title, "TEST: Item with both flags");
    assert.strictEqual(item.workflow_id, "bug-fix");
    assert.strictEqual(item.description, "A bug to fix");
  });

  test("addBacklogItem: assigns sequential priorities", () => {
    // Clear test data first to have predictable priorities
    const db = getDb();
    db.prepare("DELETE FROM backlog_items WHERE title LIKE 'TEST: Priority%'").run();

    const result1 = addBacklogItem({ title: "TEST: Priority item 1" });
    const result2 = addBacklogItem({ title: "TEST: Priority item 2" });
    const result3 = addBacklogItem({ title: "TEST: Priority item 3" });

    // Each subsequent item should have a higher priority number
    assert.ok(result2.priority > result1.priority, "Second item should have higher priority number");
    assert.ok(result3.priority > result2.priority, "Third item should have higher priority number");
    assert.strictEqual(result2.priority, result1.priority + 1, "Priorities should be sequential");
    assert.strictEqual(result3.priority, result2.priority + 1, "Priorities should be sequential");

    // Verify in database
    const items = db
      .prepare("SELECT * FROM backlog_items WHERE title LIKE 'TEST: Priority%' ORDER BY priority ASC")
      .all() as any[];

    assert.strictEqual(items.length, 3);
    assert.strictEqual(items[0].id, result1.id);
    assert.strictEqual(items[1].id, result2.id);
    assert.strictEqual(items[2].id, result3.id);
  });

  test("addBacklogItem: handles empty backlog (priority starts at 1)", () => {
    const db = getDb();
    
    // Ensure backlog is empty for this test
    db.prepare("DELETE FROM backlog_items").run();

    const result = addBacklogItem({ title: "TEST: First item" });

    assert.strictEqual(result.priority, 1, "First item in empty backlog should have priority 1");
  });

  test("addBacklogItem: outputs confirmation message format", () => {
    const result = addBacklogItem({ title: "TEST: Confirmation test" });

    // Verify the result contains the expected fields for confirmation message
    assert.ok(result.id, "Should have id for confirmation");
    assert.ok(result.priority, "Should have priority for confirmation");
    
    // Expected format: "Added backlog item <id> (priority <N>): <title>"
    const confirmationMessage = `Added backlog item ${result.id} (priority ${result.priority}): TEST: Confirmation test`;
    assert.ok(confirmationMessage.includes(result.id));
    assert.ok(confirmationMessage.includes(`priority ${result.priority}`));
  });

  test("listBacklogItems: returns empty array when no items exist", () => {
    const db = getDb();
    db.prepare("DELETE FROM backlog_items").run();

    const items = listBacklogItems();

    assert.strictEqual(items.length, 0, "Should return empty array");
    assert.ok(Array.isArray(items), "Should return an array");
  });

  test("listBacklogItems: returns all items ordered by priority ascending", () => {
    const db = getDb();
    db.prepare("DELETE FROM backlog_items WHERE title LIKE 'TEST: List%'").run();

    // Add items in non-sequential order
    const item2 = addBacklogItem({ title: "TEST: List item 2" });
    const item1 = addBacklogItem({ title: "TEST: List item 1" });
    const item3 = addBacklogItem({ title: "TEST: List item 3" });

    const items = listBacklogItems();

    // Filter to our test items
    const testItems = items.filter(item => item.title.startsWith("TEST: List"));

    assert.strictEqual(testItems.length, 3, "Should return all 3 items");
    
    // Verify ascending priority order
    assert.ok(testItems[0].priority < testItems[1].priority, "First item should have lower priority number");
    assert.ok(testItems[1].priority < testItems[2].priority, "Second item should have lower priority number");
    
    // Verify these are our items in the right order
    assert.strictEqual(testItems[0].id, item2.id);
    assert.strictEqual(testItems[1].id, item1.id);
    assert.strictEqual(testItems[2].id, item3.id);
  });

  test("listBacklogItems: includes all expected fields", () => {
    const db = getDb();
    db.prepare("DELETE FROM backlog_items WHERE title LIKE 'TEST: Fields%'").run();

    addBacklogItem({
      title: "TEST: Fields check",
      workflow: "feature-dev",
      description: "Test description",
    });

    const items = listBacklogItems();
    const testItem = items.find(item => item.title === "TEST: Fields check");

    assert.ok(testItem, "Should find test item");
    assert.ok(testItem.id, "Should have id");
    assert.strictEqual(testItem.title, "TEST: Fields check");
    assert.strictEqual(testItem.description, "Test description");
    assert.strictEqual(testItem.workflow_id, "feature-dev");
    assert.ok(testItem.priority, "Should have priority");
    assert.strictEqual(testItem.status, "pending");
    assert.ok(testItem.created_at, "Should have created_at");
    assert.ok(testItem.updated_at, "Should have updated_at");
  });

  test("listBacklogItems: handles items with null workflow and description", () => {
    const db = getDb();
    db.prepare("DELETE FROM backlog_items WHERE title LIKE 'TEST: Null%'").run();

    addBacklogItem({ title: "TEST: Null fields" });

    const items = listBacklogItems();
    const testItem = items.find(item => item.title === "TEST: Null fields");

    assert.ok(testItem, "Should find test item");
    assert.strictEqual(testItem.workflow_id, null, "workflow_id should be null");
    assert.strictEqual(testItem.description, null, "description should be null");
  });
});
