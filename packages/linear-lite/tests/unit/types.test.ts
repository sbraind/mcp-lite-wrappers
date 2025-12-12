import { describe, it, expect } from "vitest";
import { Actions, ActionSchema, PayloadSchemas } from "../../src/types.js";

describe("Actions", () => {
  it("should have all required action constants", () => {
    expect(Actions.CREATE_ISSUE).toBe("create_issue");
    expect(Actions.UPDATE_ISSUE).toBe("update_issue");
    expect(Actions.GET_TEAMS).toBe("get_teams");
    expect(Actions.SEARCH_ISSUES).toBe("search_issues");
  });

  it("should have 23 actions defined", () => {
    const actionCount = Object.keys(Actions).length;
    expect(actionCount).toBe(23);
  });
});

describe("ActionSchema", () => {
  it("should validate valid actions", () => {
    expect(ActionSchema.safeParse("create_issue").success).toBe(true);
    expect(ActionSchema.safeParse("get_teams").success).toBe(true);
  });

  it("should reject invalid actions", () => {
    expect(ActionSchema.safeParse("invalid_action").success).toBe(false);
  });
});

describe("PayloadSchemas", () => {
  it("should validate create_issue payload", () => {
    const result = PayloadSchemas.create_issue.safeParse({
      title: "Test Issue",
      teamId: "team-123",
    });
    expect(result.success).toBe(true);
  });

  it("should require title and teamId for create_issue", () => {
    const result = PayloadSchemas.create_issue.safeParse({
      title: "Test Issue",
    });
    expect(result.success).toBe(false);
  });

  it("should validate search_issues payload", () => {
    const result = PayloadSchemas.search_issues.safeParse({
      query: "bug",
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it("should have schema for each action", () => {
    for (const action of Object.values(Actions)) {
      expect(PayloadSchemas[action]).toBeDefined();
    }
  });
});
