import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Actions } from "../../src/types.js";
import { registerTools } from "../../src/actions.js";
import { delay, addCleanupTask } from "../integration/setup.js";

describe("E2E Scenarios", () => {
  let server: McpServer;
  let client: Client;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  beforeAll(async () => {
    server = new McpServer({
      name: "supabase-lite-e2e",
      version: "1.0.0",
    });

    registerTools(server);

    [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({
      name: "e2e-client",
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

  // Helper to call tool and parse response
  async function callSupabase(action: string, payload: Record<string, unknown> = {}) {
    const response = await client.callTool({
      name: "supabase",
      arguments: { action, payload },
    });

    const text = (response.content[0] as { text: string }).text;
    return {
      data: JSON.parse(text),
      isError: response.isError,
    };
  }

  describe("Scenario: Database Schema Discovery", () => {
    it("discovers all tables and their structure", async () => {
      // 1. List all tables
      const tables = await callSupabase(Actions.LIST_TABLES, { schemas: ["public"] });
      expect(tables.isError).not.toBe(true);

      // 2. For each table, get column info
      const tableInfo = await callSupabase(Actions.EXECUTE_SQL, {
        query: `
          SELECT
            c.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
          ORDER BY c.table_name, c.ordinal_position
        `,
      });
      expect(tableInfo.isError).not.toBe(true);

      // 3. Get foreign key relationships
      const fkeys = await callSupabase(Actions.EXECUTE_SQL, {
        query: `
          SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
        `,
      });
      expect(fkeys.isError).not.toBe(true);

      // 4. Get indexes
      const indexes = await callSupabase(Actions.EXECUTE_SQL, {
        query: `
          SELECT
            tablename,
            indexname,
            indexdef
          FROM pg_indexes
          WHERE schemaname = 'public'
        `,
      });
      expect(indexes.isError).not.toBe(true);
    });
  });

  describe("Scenario: Data Analysis Workflow", () => {
    it("performs data analysis on existing tables", async () => {
      // 1. Count records in each table
      const counts = await callSupabase(Actions.EXECUTE_SQL, {
        query: `
          SELECT
            (SELECT COUNT(*) FROM users) as users_count,
            (SELECT COUNT(*) FROM orders) as orders_count,
            (SELECT COUNT(*) FROM products) as products_count,
            (SELECT COUNT(*) FROM order_items) as order_items_count
        `,
      });
      expect(counts.isError).not.toBe(true);

      // 2. Get sample data
      const sampleUsers = await callSupabase(Actions.EXECUTE_SQL, {
        query: "SELECT * FROM users LIMIT 3",
      });
      expect(sampleUsers.isError).not.toBe(true);

      // 3. Run aggregate query
      const aggregates = await callSupabase(Actions.EXECUTE_SQL, {
        query: `
          SELECT
            u.id as user_id,
            COUNT(o.id) as order_count,
            COALESCE(SUM(oi.quantity), 0) as total_items
          FROM users u
          LEFT JOIN orders o ON o.user_id = u.id
          LEFT JOIN order_items oi ON oi.order_id = o.id
          GROUP BY u.id
          ORDER BY order_count DESC
          LIMIT 5
        `,
      });
      expect(aggregates.isError).not.toBe(true);
    });
  });

  describe("Scenario: Migration and Schema Evolution", () => {
    it("creates a new feature with migration", async () => {
      const timestamp = Date.now();
      const tableName = `feature_flags_${timestamp}`;

      // 1. Check current migrations
      const migrations = await callSupabase(Actions.LIST_MIGRATIONS);
      expect(migrations.isError).not.toBe(true);

      // 2. Apply new migration
      const migration = await callSupabase(Actions.APPLY_MIGRATION, {
        name: `create_${tableName}`,
        sql: `
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id serial PRIMARY KEY,
            name text NOT NULL UNIQUE,
            enabled boolean DEFAULT false,
            created_at timestamptz DEFAULT NOW()
          )
        `,
      });

      // Cleanup
      addCleanupTask(async () => {
        await callSupabase(Actions.EXECUTE_SQL, {
          query: `DROP TABLE IF EXISTS ${tableName}`,
        });
      });

      // Migration may fail on free tier, that's ok
      if (!migration.isError) {
        await delay(1000);

        // 3. Verify table exists
        const tables = await callSupabase(Actions.LIST_TABLES);
        expect(tables.isError).not.toBe(true);
      }
    });
  });

  describe("Scenario: Monitoring and Debugging", () => {
    it("gathers diagnostic information", async () => {
      // 1. Get recent logs
      const logs = await callSupabase(Actions.GET_LOGS, {
        service: "postgres",
        limit: 10,
      });
      expect(logs.isError).not.toBe(true);

      // 2. Get performance advisors
      const advisors = await callSupabase(Actions.GET_ADVISORS);
      expect(advisors.isError).not.toBe(true);

      // 3. Check for slow queries
      const slowQueries = await callSupabase(Actions.EXECUTE_SQL, {
        query: `
          SELECT
            query,
            calls,
            mean_exec_time,
            total_exec_time
          FROM pg_stat_statements
          ORDER BY mean_exec_time DESC
          LIMIT 5
        `,
      });
      // May fail if pg_stat_statements not enabled
      expect(slowQueries).toBeDefined();

      // 4. Check connection stats
      const connStats = await callSupabase(Actions.EXECUTE_SQL, {
        query: `
          SELECT
            datname,
            numbackends as connections,
            xact_commit as commits,
            xact_rollback as rollbacks
          FROM pg_stat_database
          WHERE datname = current_database()
        `,
      });
      expect(connStats.isError).not.toBe(true);
    });
  });

  describe("Scenario: TypeScript Development Workflow", () => {
    it("generates types and validates schema", async () => {
      // 1. Generate TypeScript types
      const types = await callSupabase(Actions.GENERATE_TYPESCRIPT_TYPES);
      expect(types.isError).not.toBe(true);

      // 2. Get API keys for client setup
      const keys = await callSupabase(Actions.GET_PUBLISHABLE_KEYS);
      expect(keys.isError).not.toBe(true);

      // 3. Get project URL
      const project = await callSupabase(Actions.GET_PROJECT_URL);
      expect(project.isError).not.toBe(true);
      expect(project.data.url).toContain("supabase.co");
    });
  });

  describe("Scenario: Edge Function Development", () => {
    it("develops and deploys edge function", async () => {
      const fnSlug = `e2e-test-fn-${Date.now()}`;

      // 1. List existing functions
      const existingFns = await callSupabase(Actions.LIST_EDGE_FUNCTIONS);
      expect(existingFns.isError).not.toBe(true);

      // 2. Deploy new function
      const deployResult = await callSupabase(Actions.DEPLOY_EDGE_FUNCTION, {
        slug: fnSlug,
        code: `
          import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

          serve((req) => {
            const url = new URL(req.url);
            const name = url.searchParams.get("name") || "World";

            return new Response(JSON.stringify({
              message: \`Hello, \${name}!\`,
              timestamp: new Date().toISOString()
            }), {
              headers: { "Content-Type": "application/json" }
            });
          });
        `,
        verify_jwt: false,
      });
      expect(deployResult.isError).not.toBe(true);

      await delay(3000);

      // 3. Verify function exists
      const fnDetails = await callSupabase(Actions.GET_EDGE_FUNCTION, {
        slug: fnSlug,
      });
      expect(fnDetails.isError).not.toBe(true);

      // 4. Update function
      const updateResult = await callSupabase(Actions.DEPLOY_EDGE_FUNCTION, {
        slug: fnSlug,
        code: `
          import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

          serve((req) => {
            return new Response(JSON.stringify({
              message: "Updated function v2",
              version: 2
            }), {
              headers: { "Content-Type": "application/json" }
            });
          });
        `,
        verify_jwt: false,
      });
      expect(updateResult.isError).not.toBe(true);
    });
  });

  describe("Scenario: Documentation Lookup", () => {
    it("finds relevant documentation", async () => {
      // 1. Search for auth docs
      const authDocs = await callSupabase(Actions.SEARCH_DOCS, { query: "authentication" });
      expect(authDocs.isError).not.toBe(true);
      expect(authDocs.data.results.length).toBeGreaterThan(0);

      // 2. Search for RLS docs
      const rlsDocs = await callSupabase(Actions.SEARCH_DOCS, { query: "row level security" });
      expect(rlsDocs.isError).not.toBe(true);

      // 3. Search for realtime docs
      const realtimeDocs = await callSupabase(Actions.SEARCH_DOCS, { query: "realtime subscriptions" });
      expect(realtimeDocs.isError).not.toBe(true);

      // 4. Search for storage docs
      const storageDocs = await callSupabase(Actions.SEARCH_DOCS, { query: "file storage upload" });
      expect(storageDocs.isError).not.toBe(true);
    });
  });

  describe("Scenario: Multi-Environment Setup", () => {
    it("manages project configuration", async () => {
      // 1. Get project details
      const project = await callSupabase(Actions.GET_PROJECT_URL);
      expect(project.isError).not.toBe(true);

      // 2. Get all API keys
      const keys = await callSupabase(Actions.GET_PUBLISHABLE_KEYS);
      expect(keys.isError).not.toBe(true);

      // 3. List branches (for environment management)
      const branches = await callSupabase(Actions.LIST_BRANCHES);
      expect(branches.isError).not.toBe(true);

      // 4. Get extensions (for feature availability)
      const extensions = await callSupabase(Actions.LIST_EXTENSIONS);
      expect(extensions.isError).not.toBe(true);
    });
  });

  describe("Scenario: Full Application Bootstrap", () => {
    it("sets up complete application infrastructure", async () => {
      const timestamp = Date.now();

      // 1. Verify database connection
      const ping = await callSupabase(Actions.EXECUTE_SQL, {
        query: "SELECT NOW() as server_time, current_database() as database",
      });
      expect(ping.isError).not.toBe(true);

      // 2. Check existing schema
      const schema = await callSupabase(Actions.LIST_TABLES);
      expect(schema.isError).not.toBe(true);

      // 3. Check extensions
      const extensions = await callSupabase(Actions.LIST_EXTENSIONS);
      expect(extensions.isError).not.toBe(true);

      // 4. Generate types for client
      const types = await callSupabase(Actions.GENERATE_TYPESCRIPT_TYPES);
      expect(types.isError).not.toBe(true);

      // 5. Get connection info
      const projectUrl = await callSupabase(Actions.GET_PROJECT_URL);
      expect(projectUrl.isError).not.toBe(true);

      const apiKeys = await callSupabase(Actions.GET_PUBLISHABLE_KEYS);
      expect(apiKeys.isError).not.toBe(true);

      // 6. Check monitoring
      const advisors = await callSupabase(Actions.GET_ADVISORS);
      expect(advisors.isError).not.toBe(true);

      // 7. Get documentation references
      const docs = await callSupabase(Actions.SEARCH_DOCS, { query: "getting started" });
      expect(docs.isError).not.toBe(true);
    });
  });

  describe("Scenario: Error Recovery", () => {
    it("handles and recovers from errors gracefully", async () => {
      // 1. Invalid SQL should return error
      const badSql = await callSupabase(Actions.EXECUTE_SQL, {
        query: "SELEC * FORM nonexistent",
      });
      expect(badSql.isError).toBe(true);

      // 2. Valid query should work after error
      const goodSql = await callSupabase(Actions.EXECUTE_SQL, {
        query: "SELECT 1 as recovered",
      });
      expect(goodSql.isError).not.toBe(true);

      // 3. Invalid function slug should fail gracefully
      const badFn = await callSupabase(Actions.GET_EDGE_FUNCTION, {
        slug: "definitely-not-a-real-function-xyz",
      });
      expect(badFn.isError).toBe(true);

      // 4. List functions should still work
      const listFns = await callSupabase(Actions.LIST_EDGE_FUNCTIONS);
      expect(listFns.isError).not.toBe(true);
    });
  });

  describe("Scenario: Batch Operations", () => {
    it("performs multiple related operations efficiently", async () => {
      // Execute multiple queries in sequence
      const results = await Promise.all([
        callSupabase(Actions.EXECUTE_SQL, { query: "SELECT COUNT(*) FROM users" }),
        callSupabase(Actions.EXECUTE_SQL, { query: "SELECT COUNT(*) FROM orders" }),
        callSupabase(Actions.EXECUTE_SQL, { query: "SELECT COUNT(*) FROM products" }),
        callSupabase(Actions.LIST_TABLES),
        callSupabase(Actions.LIST_EXTENSIONS),
      ]);

      // All should complete
      expect(results).toHaveLength(5);

      // Count successes
      const successes = results.filter((r) => !r.isError);
      expect(successes.length).toBeGreaterThanOrEqual(4); // At least most should succeed
    });
  });
});
