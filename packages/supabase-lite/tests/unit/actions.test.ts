import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Actions } from "../../src/types.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Helper to create mock responses
const mockResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  json: vi.fn().mockResolvedValue(data),
});

const mockErrorResponse = (message: string, status: number, code?: string) => ({
  ok: false,
  status,
  text: vi.fn().mockResolvedValue(JSON.stringify({ message, code })),
});

describe("Action Dispatcher", () => {
  // We'll test the dispatch logic by importing registerTools and testing the tool handler
  let toolHandler: (args: Record<string, unknown>) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockClear();

    // Set required env vars
    process.env.SUPABASE_ACCESS_TOKEN = "test-token";
    process.env.SUPABASE_PROJECT_REF = "test-project";

    // Re-stub fetch after reset
    vi.stubGlobal("fetch", mockFetch);

    // Create a mock MCP server to capture the tool handler
    const { registerTools } = await import("../../src/actions.js");

    const mockServer = {
      tool: vi.fn((name, description, schema, handler) => {
        toolHandler = handler;
      }),
    } as unknown as McpServer;

    registerTools(mockServer);
  });

  afterEach(() => {
    delete process.env.SUPABASE_ACCESS_TOKEN;
    delete process.env.SUPABASE_PROJECT_REF;
    vi.clearAllMocks();
  });

  describe("Configuration", () => {
    it("uses payload project_id over env variable", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await toolHandler({
        action: Actions.EXECUTE_SQL,
        payload: { query: "SELECT 1", project_id: "custom-project" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/projects/custom-project/"),
        expect.anything()
      );
    });

    it("uses env SUPABASE_PROJECT_REF when project_id not in payload", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await toolHandler({
        action: Actions.EXECUTE_SQL,
        payload: { query: "SELECT 1" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/projects/test-project/"),
        expect.anything()
      );
    });
  });

  describe("Response formatting", () => {
    it("returns success response with JSON content", async () => {
      const data = { rows: [{ id: 1, name: "Test" }] };
      mockFetch.mockResolvedValueOnce(mockResponse(data));

      const result = await toolHandler({
        action: Actions.EXECUTE_SQL,
        payload: { query: "SELECT * FROM users" },
      }) as { content: Array<{ type: string; text: string }> };

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      // Response should be valid JSON
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toBeDefined();
    });

    it("returns error response on API failure", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Not authorized", 401));

      const result = await toolHandler({
        action: Actions.LIST_TABLES,
        payload: {},
      }) as { isError: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      const errorData = JSON.parse(result.content[0].text);
      expect(errorData.error).toBe(true);
      expect(errorData.message).toContain("Not authorized");
    });

    it("formats JSON output as valid JSON", async () => {
      const data = { key: "value" };
      mockFetch.mockResolvedValueOnce(mockResponse(data));

      const result = await toolHandler({
        action: Actions.EXECUTE_SQL,
        payload: { query: "SELECT 1" },
      }) as { content: Array<{ text: string }> };

      const text = result.content[0].text;
      // Should be valid parseable JSON
      expect(() => JSON.parse(text)).not.toThrow();
    });
  });

  describe("Database Operations", () => {
    it("execute_sql dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await toolHandler({
        action: Actions.EXECUTE_SQL,
        payload: { query: "SELECT * FROM users" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/database/query"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("SELECT * FROM users"),
        })
      );
    });

    it("list_tables dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await toolHandler({
        action: Actions.LIST_TABLES,
        payload: { schemas: ["public", "auth"] },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/database/query"),
        expect.anything()
      );
    });

    it("list_extensions dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await toolHandler({
        action: Actions.LIST_EXTENSIONS,
        payload: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/database/query"),
        expect.objectContaining({
          body: expect.stringContaining("pg_extension"),
        })
      );
    });

    it("list_migrations dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      await toolHandler({
        action: Actions.LIST_MIGRATIONS,
        payload: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/database/migrations"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("apply_migration dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

      await toolHandler({
        action: Actions.APPLY_MIGRATION,
        payload: { name: "test_migration", sql: "CREATE TABLE test()" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/database/migrations"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Monitoring Operations", () => {
    it("get_logs dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      await toolHandler({
        action: Actions.GET_LOGS,
        payload: { service: "postgres", limit: 50 },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/analytics/endpoints/logs"),
        expect.anything()
      );
    });

    it("get_advisors dispatches correctly", async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ performance: [] }))
        .mockResolvedValueOnce(mockResponse({ security: [] }));

      await toolHandler({
        action: Actions.GET_ADVISORS,
        payload: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/advisors/performance"),
        expect.anything()
      );
    });
  });

  describe("Project Info Operations", () => {
    it("get_project_url dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        mockResponse({ id: "test", endpoint: "https://test.supabase.co" })
      );

      const result = await toolHandler({
        action: Actions.GET_PROJECT_URL,
        payload: {},
      }) as { content: Array<{ text: string }> };

      const data = JSON.parse(result.content[0].text);
      expect(data.url).toContain("supabase.co");
    });

    it("get_publishable_keys dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([{ name: "anon", api_key: "xxx" }]));

      await toolHandler({
        action: Actions.GET_PUBLISHABLE_KEYS,
        payload: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api-keys"),
        expect.anything()
      );
    });

    it("generate_typescript_types dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ types: "export interface..." }));

      await toolHandler({
        action: Actions.GENERATE_TYPESCRIPT_TYPES,
        payload: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/types/typescript"),
        expect.anything()
      );
    });
  });

  describe("Edge Functions Operations", () => {
    it("list_edge_functions dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      await toolHandler({
        action: Actions.LIST_EDGE_FUNCTIONS,
        payload: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/functions"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("get_edge_function dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ slug: "hello" }));

      await toolHandler({
        action: Actions.GET_EDGE_FUNCTION,
        payload: { slug: "hello" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/functions/hello"),
        expect.anything()
      );
    });

    it("deploy_edge_function dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ slug: "new-fn" }));

      await toolHandler({
        action: Actions.DEPLOY_EDGE_FUNCTION,
        payload: { slug: "new-fn", code: "export default () => {}", verify_jwt: true },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/functions/deploy"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Branching Operations", () => {
    it("create_branch dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: "branch-123" }));

      await toolHandler({
        action: Actions.CREATE_BRANCH,
        payload: { name: "feature-branch" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/branches"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("feature-branch"),
        })
      );
    });

    it("list_branches dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      await toolHandler({
        action: Actions.LIST_BRANCHES,
        payload: {},
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/branches"),
        expect.objectContaining({ method: "GET" })
      );
    });

    it("delete_branch dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

      await toolHandler({
        action: Actions.DELETE_BRANCH,
        payload: { branch_id: "branch-123" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/branches/branch-123"),
        expect.objectContaining({ method: "DELETE" })
      );
    });

    it("merge_branch dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

      await toolHandler({
        action: Actions.MERGE_BRANCH,
        payload: { branch_id: "branch-456" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/branches/branch-456/merge"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("reset_branch dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

      await toolHandler({
        action: Actions.RESET_BRANCH,
        payload: { branch_id: "branch-789" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/branches/branch-789/reset"),
        expect.objectContaining({ method: "POST" })
      );
    });

    it("rebase_branch dispatches correctly", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

      await toolHandler({
        action: Actions.REBASE_BRANCH,
        payload: { branch_id: "branch-abc" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/branches/branch-abc/rebase"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("Documentation Operations", () => {
    it("search_docs returns results without API call", async () => {
      const result = await toolHandler({
        action: Actions.SEARCH_DOCS,
        payload: { query: "authentication" },
      }) as { content: Array<{ text: string }> };

      // search_docs doesn't call fetch, it returns static links
      expect(mockFetch).not.toHaveBeenCalled();

      const data = JSON.parse(result.content[0].text);
      expect(data.results).toBeInstanceOf(Array);
      expect(data.query).toBe("authentication");
    });
  });

  describe("Unknown action handling", () => {
    it("returns error for unknown action", async () => {
      const result = await toolHandler({
        action: "unknown_action",
        payload: {},
      }) as { isError: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      // The Zod schema validation will fail first
    });
  });

  describe("Payload validation", () => {
    it("validates required fields", async () => {
      const result = await toolHandler({
        action: Actions.EXECUTE_SQL,
        payload: {}, // missing required 'query'
      }) as { isError: boolean };

      expect(result.isError).toBe(true);
    });

    it("applies default values", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      await toolHandler({
        action: Actions.GET_LOGS,
        payload: {}, // should use defaults: service="postgres", limit=100
      });

      // The limit is URL-encoded in the SQL query parameter
      const callUrl = mockFetch.mock.calls[0][0] as string;
      expect(decodeURIComponent(callUrl)).toContain("LIMIT 100");
    });
  });

  describe("ApiError handling", () => {
    it("includes error code in response", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Rate limited", 429, "rate_limit_exceeded")
      );

      const result = await toolHandler({
        action: Actions.LIST_TABLES,
        payload: {},
      }) as { isError: boolean; content: Array<{ text: string }> };

      expect(result.isError).toBe(true);
      const errorData = JSON.parse(result.content[0].text);
      expect(errorData.code).toBe("rate_limit_exceeded");
    });
  });
});

describe("registerTools", () => {
  it("registers tool with correct name", async () => {
    vi.resetModules();
    process.env.SUPABASE_ACCESS_TOKEN = "test";
    vi.stubGlobal("fetch", mockFetch);

    const { registerTools } = await import("../../src/actions.js");

    const mockServer = {
      tool: vi.fn(),
    } as unknown as McpServer;

    registerTools(mockServer);

    expect(mockServer.tool).toHaveBeenCalledWith(
      "supabase",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("registers tool with description containing all actions", async () => {
    vi.resetModules();
    process.env.SUPABASE_ACCESS_TOKEN = "test";
    vi.stubGlobal("fetch", mockFetch);

    const { registerTools } = await import("../../src/actions.js");

    let registeredDescription = "";
    const mockServer = {
      tool: vi.fn((name, description) => {
        registeredDescription = description;
      }),
    } as unknown as McpServer;

    registerTools(mockServer);

    // Check that description mentions key actions
    expect(registeredDescription).toContain("execute_sql");
    expect(registeredDescription).toContain("list_tables");
    expect(registeredDescription).toContain("search_docs");
  });
});
