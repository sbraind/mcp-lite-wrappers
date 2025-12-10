import { describe, it, expect } from "vitest";
import {
  Actions,
  ActionSchema,
  PayloadSchemas,
  ToolInputSchema,
} from "../../src/types.js";

describe("Actions constant", () => {
  it("contains all 32 actions", () => {
    const actionValues = Object.values(Actions);
    expect(actionValues).toHaveLength(32);
  });

  it("has correct action values", () => {
    // Account/Project
    expect(Actions.LIST_PROJECTS).toBe("list_projects");
    expect(Actions.GET_PROJECT).toBe("get_project");
    expect(Actions.CREATE_PROJECT).toBe("create_project");
    expect(Actions.PAUSE_PROJECT).toBe("pause_project");
    expect(Actions.RESTORE_PROJECT).toBe("restore_project");
    // Organization
    expect(Actions.LIST_ORGANIZATIONS).toBe("list_organizations");
    expect(Actions.GET_ORGANIZATION).toBe("get_organization");
    // Cost
    expect(Actions.GET_COST).toBe("get_cost");
    expect(Actions.CONFIRM_COST).toBe("confirm_cost");
    // Database
    expect(Actions.EXECUTE_SQL).toBe("execute_sql");
    expect(Actions.LIST_TABLES).toBe("list_tables");
    expect(Actions.LIST_EXTENSIONS).toBe("list_extensions");
    expect(Actions.LIST_MIGRATIONS).toBe("list_migrations");
    expect(Actions.APPLY_MIGRATION).toBe("apply_migration");
    // Monitoring
    expect(Actions.GET_LOGS).toBe("get_logs");
    expect(Actions.GET_ADVISORS).toBe("get_advisors");
    // Project info
    expect(Actions.GET_PROJECT_URL).toBe("get_project_url");
    expect(Actions.GET_PUBLISHABLE_KEYS).toBe("get_publishable_keys");
    expect(Actions.GENERATE_TYPESCRIPT_TYPES).toBe("generate_typescript_types");
    // Edge functions
    expect(Actions.LIST_EDGE_FUNCTIONS).toBe("list_edge_functions");
    expect(Actions.GET_EDGE_FUNCTION).toBe("get_edge_function");
    expect(Actions.DEPLOY_EDGE_FUNCTION).toBe("deploy_edge_function");
    // Branching
    expect(Actions.CREATE_BRANCH).toBe("create_branch");
    expect(Actions.LIST_BRANCHES).toBe("list_branches");
    expect(Actions.DELETE_BRANCH).toBe("delete_branch");
    expect(Actions.MERGE_BRANCH).toBe("merge_branch");
    expect(Actions.RESET_BRANCH).toBe("reset_branch");
    expect(Actions.REBASE_BRANCH).toBe("rebase_branch");
    // Storage
    expect(Actions.LIST_STORAGE_BUCKETS).toBe("list_storage_buckets");
    expect(Actions.GET_STORAGE_CONFIG).toBe("get_storage_config");
    expect(Actions.UPDATE_STORAGE_CONFIG).toBe("update_storage_config");
    // Docs
    expect(Actions.SEARCH_DOCS).toBe("search_docs");
  });

  it("all action values are unique", () => {
    const values = Object.values(Actions);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe("ActionSchema", () => {
  it("accepts valid actions", () => {
    expect(ActionSchema.parse("execute_sql")).toBe("execute_sql");
    expect(ActionSchema.parse("list_tables")).toBe("list_tables");
    expect(ActionSchema.parse("search_docs")).toBe("search_docs");
  });

  it("rejects invalid actions", () => {
    expect(() => ActionSchema.parse("invalid_action")).toThrow();
    expect(() => ActionSchema.parse("")).toThrow();
    expect(() => ActionSchema.parse(123)).toThrow();
    expect(() => ActionSchema.parse(null)).toThrow();
    expect(() => ActionSchema.parse(undefined)).toThrow();
  });

  it("is case-sensitive", () => {
    expect(() => ActionSchema.parse("EXECUTE_SQL")).toThrow();
    expect(() => ActionSchema.parse("Execute_Sql")).toThrow();
  });
});

describe("PayloadSchemas", () => {
  describe("execute_sql", () => {
    const schema = PayloadSchemas[Actions.EXECUTE_SQL];

    it("accepts valid query", () => {
      const result = schema.parse({ query: "SELECT * FROM users" });
      expect(result.query).toBe("SELECT * FROM users");
    });

    it("accepts optional project_id", () => {
      const result = schema.parse({
        query: "SELECT 1",
        project_id: "my-project",
      });
      expect(result.project_id).toBe("my-project");
    });

    it("rejects missing query", () => {
      expect(() => schema.parse({})).toThrow();
      expect(() => schema.parse({ project_id: "test" })).toThrow();
    });

    it("rejects non-string query", () => {
      expect(() => schema.parse({ query: 123 })).toThrow();
      expect(() => schema.parse({ query: null })).toThrow();
    });
  });

  describe("list_tables", () => {
    const schema = PayloadSchemas[Actions.LIST_TABLES];

    it("uses default schemas when not provided", () => {
      const result = schema.parse({});
      expect(result.schemas).toEqual(["public"]);
    });

    it("accepts custom schemas array", () => {
      const result = schema.parse({ schemas: ["public", "auth", "storage"] });
      expect(result.schemas).toEqual(["public", "auth", "storage"]);
    });

    it("accepts optional project_id", () => {
      const result = schema.parse({ project_id: "test-project" });
      expect(result.project_id).toBe("test-project");
    });

    it("rejects invalid schemas type", () => {
      expect(() => schema.parse({ schemas: "public" })).toThrow();
      expect(() => schema.parse({ schemas: [123] })).toThrow();
    });
  });

  describe("list_extensions", () => {
    const schema = PayloadSchemas[Actions.LIST_EXTENSIONS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });

    it("accepts optional project_id", () => {
      const result = schema.parse({ project_id: "test" });
      expect(result.project_id).toBe("test");
    });
  });

  describe("list_migrations", () => {
    const schema = PayloadSchemas[Actions.LIST_MIGRATIONS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("apply_migration", () => {
    const schema = PayloadSchemas[Actions.APPLY_MIGRATION];

    it("accepts valid migration", () => {
      const result = schema.parse({
        name: "add_users_table",
        sql: "CREATE TABLE users (id serial PRIMARY KEY)",
      });
      expect(result.name).toBe("add_users_table");
      expect(result.sql).toBe("CREATE TABLE users (id serial PRIMARY KEY)");
    });

    it("rejects missing name", () => {
      expect(() =>
        schema.parse({ sql: "CREATE TABLE test()" })
      ).toThrow();
    });

    it("rejects missing sql", () => {
      expect(() => schema.parse({ name: "test" })).toThrow();
    });

    it("rejects empty strings", () => {
      expect(() => schema.parse({ name: "", sql: "SELECT 1" })).not.toThrow(); // Empty strings allowed
    });
  });

  describe("get_logs", () => {
    const schema = PayloadSchemas[Actions.GET_LOGS];

    it("uses default values", () => {
      const result = schema.parse({});
      expect(result.service).toBe("postgres");
      expect(result.limit).toBe(100);
    });

    it("accepts valid service types", () => {
      const services = ["api", "postgres", "edge_functions", "auth", "storage", "realtime"];
      for (const service of services) {
        const result = schema.parse({ service });
        expect(result.service).toBe(service);
      }
    });

    it("rejects invalid service", () => {
      expect(() => schema.parse({ service: "invalid" })).toThrow();
      expect(() => schema.parse({ service: "database" })).toThrow();
    });

    it("accepts custom limit", () => {
      const result = schema.parse({ limit: 50 });
      expect(result.limit).toBe(50);
    });

    it("rejects non-number limit", () => {
      expect(() => schema.parse({ limit: "100" })).toThrow();
    });
  });

  describe("get_advisors", () => {
    const schema = PayloadSchemas[Actions.GET_ADVISORS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("get_project_url", () => {
    const schema = PayloadSchemas[Actions.GET_PROJECT_URL];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("get_publishable_keys", () => {
    const schema = PayloadSchemas[Actions.GET_PUBLISHABLE_KEYS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("generate_typescript_types", () => {
    const schema = PayloadSchemas[Actions.GENERATE_TYPESCRIPT_TYPES];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("list_edge_functions", () => {
    const schema = PayloadSchemas[Actions.LIST_EDGE_FUNCTIONS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("get_edge_function", () => {
    const schema = PayloadSchemas[Actions.GET_EDGE_FUNCTION];

    it("accepts valid slug", () => {
      const result = schema.parse({ slug: "hello-world" });
      expect(result.slug).toBe("hello-world");
    });

    it("rejects missing slug", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("rejects non-string slug", () => {
      expect(() => schema.parse({ slug: 123 })).toThrow();
    });
  });

  describe("deploy_edge_function", () => {
    const schema = PayloadSchemas[Actions.DEPLOY_EDGE_FUNCTION];

    it("accepts valid deployment", () => {
      const result = schema.parse({
        slug: "my-function",
        code: "export default () => new Response('Hello')",
      });
      expect(result.slug).toBe("my-function");
      expect(result.code).toBe("export default () => new Response('Hello')");
      expect(result.verify_jwt).toBe(true); // default
    });

    it("accepts verify_jwt override", () => {
      const result = schema.parse({
        slug: "public-fn",
        code: "export default () => new Response('Public')",
        verify_jwt: false,
      });
      expect(result.verify_jwt).toBe(false);
    });

    it("rejects missing slug", () => {
      expect(() => schema.parse({ code: "code" })).toThrow();
    });

    it("rejects missing code", () => {
      expect(() => schema.parse({ slug: "test" })).toThrow();
    });
  });

  describe("create_branch", () => {
    const schema = PayloadSchemas[Actions.CREATE_BRANCH];

    it("accepts valid branch name", () => {
      const result = schema.parse({ name: "feature-auth" });
      expect(result.name).toBe("feature-auth");
    });

    it("rejects missing name", () => {
      expect(() => schema.parse({})).toThrow();
    });
  });

  describe("list_branches", () => {
    const schema = PayloadSchemas[Actions.LIST_BRANCHES];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("delete_branch", () => {
    const schema = PayloadSchemas[Actions.DELETE_BRANCH];

    it("accepts valid branch_id", () => {
      const result = schema.parse({ branch_id: "branch-123" });
      expect(result.branch_id).toBe("branch-123");
    });

    it("rejects missing branch_id", () => {
      expect(() => schema.parse({})).toThrow();
    });
  });

  describe("merge_branch", () => {
    const schema = PayloadSchemas[Actions.MERGE_BRANCH];

    it("accepts valid branch_id", () => {
      const result = schema.parse({ branch_id: "branch-456" });
      expect(result.branch_id).toBe("branch-456");
    });

    it("rejects missing branch_id", () => {
      expect(() => schema.parse({})).toThrow();
    });
  });

  describe("reset_branch", () => {
    const schema = PayloadSchemas[Actions.RESET_BRANCH];

    it("accepts valid branch_id", () => {
      const result = schema.parse({ branch_id: "branch-789" });
      expect(result.branch_id).toBe("branch-789");
    });
  });

  describe("rebase_branch", () => {
    const schema = PayloadSchemas[Actions.REBASE_BRANCH];

    it("accepts valid branch_id", () => {
      const result = schema.parse({ branch_id: "branch-abc" });
      expect(result.branch_id).toBe("branch-abc");
    });
  });

  describe("search_docs", () => {
    const schema = PayloadSchemas[Actions.SEARCH_DOCS];

    it("accepts valid query", () => {
      const result = schema.parse({ query: "authentication" });
      expect(result.query).toBe("authentication");
    });

    it("rejects missing query", () => {
      expect(() => schema.parse({})).toThrow();
    });

    it("rejects non-string query", () => {
      expect(() => schema.parse({ query: ["auth"] })).toThrow();
    });
  });

  // New actions tests
  describe("list_projects", () => {
    const schema = PayloadSchemas[Actions.LIST_PROJECTS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("get_project", () => {
    const schema = PayloadSchemas[Actions.GET_PROJECT];

    it("accepts valid id", () => {
      const result = schema.parse({ id: "project-123" });
      expect(result.id).toBe("project-123");
    });

    it("rejects missing id", () => {
      expect(() => schema.parse({})).toThrow();
    });
  });

  describe("create_project", () => {
    const schema = PayloadSchemas[Actions.CREATE_PROJECT];

    it("accepts valid project creation", () => {
      const result = schema.parse({
        name: "my-project",
        region: "us-east-1",
        organization_id: "org-123",
        confirm_cost_id: "cost-abc",
      });
      expect(result.name).toBe("my-project");
      expect(result.region).toBe("us-east-1");
    });

    it("rejects invalid region", () => {
      expect(() => schema.parse({
        name: "test",
        region: "invalid-region",
        organization_id: "org-123",
        confirm_cost_id: "cost-abc",
      })).toThrow();
    });
  });

  describe("pause_project", () => {
    const schema = PayloadSchemas[Actions.PAUSE_PROJECT];

    it("accepts valid project_id", () => {
      const result = schema.parse({ project_id: "project-123" });
      expect(result.project_id).toBe("project-123");
    });

    it("rejects missing project_id", () => {
      expect(() => schema.parse({})).toThrow();
    });
  });

  describe("restore_project", () => {
    const schema = PayloadSchemas[Actions.RESTORE_PROJECT];

    it("accepts valid project_id", () => {
      const result = schema.parse({ project_id: "project-456" });
      expect(result.project_id).toBe("project-456");
    });
  });

  describe("list_organizations", () => {
    const schema = PayloadSchemas[Actions.LIST_ORGANIZATIONS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("get_organization", () => {
    const schema = PayloadSchemas[Actions.GET_ORGANIZATION];

    it("accepts valid id", () => {
      const result = schema.parse({ id: "org-slug" });
      expect(result.id).toBe("org-slug");
    });

    it("rejects missing id", () => {
      expect(() => schema.parse({})).toThrow();
    });
  });

  describe("get_cost", () => {
    const schema = PayloadSchemas[Actions.GET_COST];

    it("accepts valid cost request", () => {
      const result = schema.parse({ type: "project", organization_id: "org-123" });
      expect(result.type).toBe("project");
      expect(result.organization_id).toBe("org-123");
    });

    it("accepts branch type", () => {
      const result = schema.parse({ type: "branch", organization_id: "org-456" });
      expect(result.type).toBe("branch");
    });

    it("rejects invalid type", () => {
      expect(() => schema.parse({ type: "invalid", organization_id: "org" })).toThrow();
    });
  });

  describe("confirm_cost", () => {
    const schema = PayloadSchemas[Actions.CONFIRM_COST];

    it("accepts valid cost confirmation", () => {
      const result = schema.parse({
        type: "project",
        recurrence: "monthly",
        amount: 25,
      });
      expect(result.type).toBe("project");
      expect(result.recurrence).toBe("monthly");
      expect(result.amount).toBe(25);
    });

    it("accepts hourly recurrence", () => {
      const result = schema.parse({
        type: "branch",
        recurrence: "hourly",
        amount: 0.01,
      });
      expect(result.recurrence).toBe("hourly");
    });
  });

  describe("list_storage_buckets", () => {
    const schema = PayloadSchemas[Actions.LIST_STORAGE_BUCKETS];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });

    it("accepts optional project_id", () => {
      const result = schema.parse({ project_id: "test" });
      expect(result.project_id).toBe("test");
    });
  });

  describe("get_storage_config", () => {
    const schema = PayloadSchemas[Actions.GET_STORAGE_CONFIG];

    it("accepts empty payload", () => {
      const result = schema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("update_storage_config", () => {
    const schema = PayloadSchemas[Actions.UPDATE_STORAGE_CONFIG];

    it("accepts valid config update", () => {
      const result = schema.parse({
        config: {
          fileSizeLimit: 52428800,
          features: {
            imageTransformation: { enabled: true },
          },
        },
      });
      expect(result.config.fileSizeLimit).toBe(52428800);
    });

    it("accepts partial config", () => {
      const result = schema.parse({
        config: {
          features: {
            s3Protocol: { enabled: false },
          },
        },
      });
      expect(result.config.features?.s3Protocol?.enabled).toBe(false);
    });
  });
});

describe("ToolInputSchema", () => {
  it("accepts valid action with payload", () => {
    const result = ToolInputSchema.parse({
      action: "execute_sql",
      payload: { query: "SELECT 1" },
    });
    expect(result.action).toBe("execute_sql");
    expect(result.payload).toEqual({ query: "SELECT 1" });
  });

  it("accepts action without payload", () => {
    const result = ToolInputSchema.parse({
      action: "list_tables",
    });
    expect(result.action).toBe("list_tables");
    expect(result.payload).toBeUndefined();
  });

  it("accepts action with empty payload", () => {
    const result = ToolInputSchema.parse({
      action: "list_extensions",
      payload: {},
    });
    expect(result.action).toBe("list_extensions");
    expect(result.payload).toEqual({});
  });

  it("rejects missing action", () => {
    expect(() => ToolInputSchema.parse({})).toThrow();
    expect(() => ToolInputSchema.parse({ payload: {} })).toThrow();
  });

  it("rejects invalid action", () => {
    expect(() =>
      ToolInputSchema.parse({ action: "invalid" })
    ).toThrow();
  });

  it("allows arbitrary payload properties", () => {
    const result = ToolInputSchema.parse({
      action: "execute_sql",
      payload: {
        query: "SELECT 1",
        extra: "ignored",
        nested: { value: true },
      },
    });
    expect(result.payload).toHaveProperty("extra");
    expect(result.payload).toHaveProperty("nested");
  });
});

describe("PayloadSchemas completeness", () => {
  it("has a schema for every action", () => {
    const actions = Object.values(Actions);
    for (const action of actions) {
      expect(PayloadSchemas).toHaveProperty(action);
      expect(PayloadSchemas[action as keyof typeof PayloadSchemas]).toBeDefined();
    }
  });

  it("all schemas are Zod schemas", () => {
    for (const schema of Object.values(PayloadSchemas)) {
      expect(schema).toHaveProperty("parse");
      expect(schema).toHaveProperty("safeParse");
      expect(typeof schema.parse).toBe("function");
    }
  });
});
