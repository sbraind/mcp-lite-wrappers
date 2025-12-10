import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Actions } from "../../src/types.js";
import { registerTools } from "../../src/actions.js";

describe("MCP Server E2E", () => {
  let server: McpServer;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeAll(async () => {
    // Create MCP server
    server = new McpServer({
      name: "supabase-lite-test",
      version: "1.0.0",
    });

    // Register the supabase tool
    registerTools(server);

    // Create in-memory transport pair
    [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

    // Connect server
    await server.connect(serverTransport);

    // Create and connect client
    client = new Client({
      name: "test-client",
      version: "1.0.0",
    }, {
      capabilities: {},
    });

    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  describe("Tool Discovery", () => {
    it("lists available tools", async () => {
      const response = await client.listTools();

      expect(response.tools).toBeDefined();
      expect(response.tools.length).toBeGreaterThan(0);
    });

    it("includes supabase tool", async () => {
      const response = await client.listTools();

      const supabaseTool = response.tools.find((t) => t.name === "supabase");
      expect(supabaseTool).toBeDefined();
    });

    it("supabase tool has correct schema", async () => {
      const response = await client.listTools();

      const supabaseTool = response.tools.find((t) => t.name === "supabase");
      expect(supabaseTool).toBeDefined();

      // Check input schema structure
      expect(supabaseTool!.inputSchema).toBeDefined();
      expect(supabaseTool!.inputSchema.type).toBe("object");
      expect(supabaseTool!.inputSchema.properties).toHaveProperty("action");
      expect(supabaseTool!.inputSchema.properties).toHaveProperty("payload");
    });

    it("supabase tool description mentions all actions", async () => {
      const response = await client.listTools();

      const supabaseTool = response.tools.find((t) => t.name === "supabase");
      expect(supabaseTool).toBeDefined();

      const description = supabaseTool!.description || "";
      expect(description).toContain("execute_sql");
      expect(description).toContain("list_tables");
    });
  });

  describe("Tool Invocation - Database Operations", () => {
    it("execute_sql returns formatted response", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.EXECUTE_SQL,
          payload: { query: "SELECT 1 as value" },
        },
      });

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.content[0]).toHaveProperty("type", "text");
    });

    it("list_tables returns table information", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.LIST_TABLES,
          payload: { schemas: ["public"] },
        },
      });

      expect(response.content).toBeDefined();
      expect(response.isError).not.toBe(true);
    });

    it("list_extensions returns extension info", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.LIST_EXTENSIONS,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();
    });

    it("list_migrations returns migration history", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.LIST_MIGRATIONS,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();
    });
  });

  describe("Tool Invocation - Monitoring", () => {
    it("get_logs returns log entries", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.GET_LOGS,
          payload: { service: "postgres", limit: 5 },
        },
      });

      expect(response.content).toBeDefined();
    });

    it("get_advisors returns recommendations", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.GET_ADVISORS,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();
    });
  });

  describe("Tool Invocation - Project Info", () => {
    it("get_project_url returns project details", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.GET_PROJECT_URL,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();

      const text = (response.content[0] as { text: string }).text;
      const data = JSON.parse(text);
      expect(data.url).toContain("supabase.co");
    });

    it("get_publishable_keys returns API keys", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.GET_PUBLISHABLE_KEYS,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();
    });

    it("generate_typescript_types returns type definitions", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.GENERATE_TYPESCRIPT_TYPES,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();
    });
  });

  describe("Tool Invocation - Edge Functions", () => {
    it("list_edge_functions returns functions list", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.LIST_EDGE_FUNCTIONS,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();
    });
  });

  describe("Tool Invocation - Branching", () => {
    it("list_branches returns branches list", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.LIST_BRANCHES,
          payload: {},
        },
      });

      expect(response.content).toBeDefined();
    });
  });

  describe("Tool Invocation - Documentation", () => {
    it("search_docs returns documentation links", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.SEARCH_DOCS,
          payload: { query: "authentication" },
        },
      });

      expect(response.content).toBeDefined();

      const text = (response.content[0] as { text: string }).text;
      const data = JSON.parse(text);
      expect(data.results).toBeInstanceOf(Array);
      expect(data.query).toBe("authentication");
    });
  });

  describe("Error Handling", () => {
    it("returns error for invalid action", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: "invalid_action",
          payload: {},
        },
      });

      expect(response.isError).toBe(true);
    });

    it("returns error for missing required payload fields", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.EXECUTE_SQL,
          payload: {}, // Missing 'query'
        },
      });

      expect(response.isError).toBe(true);
    });

    it("returns error for invalid payload type", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.EXECUTE_SQL,
          payload: { query: 123 }, // Should be string
        },
      });

      expect(response.isError).toBe(true);
    });

    it("returns error response with message", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.EXECUTE_SQL,
          payload: {},
        },
      });

      expect(response.isError).toBe(true);
      expect(response.content.length).toBeGreaterThan(0);

      const text = (response.content[0] as { text: string }).text;
      expect(text).toBeTruthy();
    });
  });

  describe("Response Format", () => {
    it("returns JSON-formatted text content", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.SEARCH_DOCS,
          payload: { query: "test" },
        },
      });

      expect(response.content[0]).toHaveProperty("type", "text");

      const text = (response.content[0] as { text: string }).text;
      const parsed = JSON.parse(text);
      expect(parsed).toBeDefined();
    });

    it("returns pretty-printed JSON", async () => {
      const response = await client.callTool({
        name: "supabase",
        arguments: {
          action: Actions.SEARCH_DOCS,
          payload: { query: "database" },
        },
      });

      const text = (response.content[0] as { text: string }).text;
      expect(text).toContain("\n"); // Pretty printed
    });
  });

  describe("All Actions Available", () => {
    const allActions = Object.values(Actions);

    it("all 32 actions are defined", () => {
      expect(allActions).toHaveLength(32);
    });

    // Test each action is callable (may return error due to config, but should not crash)
    for (const action of allActions) {
      it(`action '${action}' is callable`, async () => {
        // Build minimal payload for each action type
        let payload: Record<string, unknown> = {};

        switch (action) {
          // Account/Project
          case Actions.GET_PROJECT:
            payload = { id: "test-project" };
            break;
          case Actions.CREATE_PROJECT:
            payload = { name: "test", region: "us-east-1", organization_id: "org", confirm_cost_id: "cost" };
            break;
          case Actions.PAUSE_PROJECT:
          case Actions.RESTORE_PROJECT:
            payload = { project_id: "test-project" };
            break;
          // Organization
          case Actions.GET_ORGANIZATION:
            payload = { id: "org-slug" };
            break;
          // Cost
          case Actions.GET_COST:
            payload = { type: "project", organization_id: "org" };
            break;
          case Actions.CONFIRM_COST:
            payload = { type: "project", recurrence: "monthly", amount: 25 };
            break;
          // Database
          case Actions.EXECUTE_SQL:
            payload = { query: "SELECT 1" };
            break;
          case Actions.APPLY_MIGRATION:
            payload = { name: "test", sql: "SELECT 1" };
            break;
          // Edge Functions
          case Actions.GET_EDGE_FUNCTION:
            payload = { slug: "test" };
            break;
          case Actions.DEPLOY_EDGE_FUNCTION:
            payload = { slug: "test", code: "code", verify_jwt: true };
            break;
          // Branching
          case Actions.CREATE_BRANCH:
            payload = { name: "test" };
            break;
          case Actions.DELETE_BRANCH:
          case Actions.MERGE_BRANCH:
          case Actions.RESET_BRANCH:
          case Actions.REBASE_BRANCH:
            payload = { branch_id: "test" };
            break;
          // Storage
          case Actions.UPDATE_STORAGE_CONFIG:
            payload = { config: { fileSizeLimit: 1000000 } };
            break;
          // Docs
          case Actions.SEARCH_DOCS:
            payload = { query: "test" };
            break;
          default:
            payload = {};
        }

        const response = await client.callTool({
          name: "supabase",
          arguments: { action, payload },
        });

        // Should return some response (success or error)
        expect(response.content).toBeDefined();
        expect(response.content.length).toBeGreaterThan(0);
      });
    }
  });

  describe("Concurrent Requests", () => {
    it("handles multiple concurrent requests", async () => {
      const requests = [
        client.callTool({
          name: "supabase",
          arguments: { action: Actions.LIST_TABLES, payload: {} },
        }),
        client.callTool({
          name: "supabase",
          arguments: { action: Actions.LIST_EXTENSIONS, payload: {} },
        }),
        client.callTool({
          name: "supabase",
          arguments: { action: Actions.SEARCH_DOCS, payload: { query: "test" } },
        }),
      ];

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(3);
      for (const response of responses) {
        expect(response.content).toBeDefined();
      }
    });
  });
});
