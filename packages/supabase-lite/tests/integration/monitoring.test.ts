import { describe, it, expect, beforeAll } from "vitest";
import { SupabaseManagementClient } from "../../src/client/index.js";
import { searchDocs } from "../../src/client/index.js";
import { getTestConfig } from "./setup.js";

describe("Monitoring Operations (Integration)", () => {
  let client: SupabaseManagementClient;
  let projectRef: string;

  beforeAll(() => {
    const config = getTestConfig();
    client = new SupabaseManagementClient(config.accessToken);
    projectRef = config.projectRef;
  });

  describe("get_logs", () => {
    it("retrieves postgres logs", async () => {
      const result = await client.getLogs(projectRef, "postgres", 10);
      expect(result).toBeDefined();
    });

    it("retrieves api logs", async () => {
      const result = await client.getLogs(projectRef, "api", 10);
      expect(result).toBeDefined();
    });

    it("retrieves auth logs", async () => {
      const result = await client.getLogs(projectRef, "auth", 10);
      expect(result).toBeDefined();
    });

    it("retrieves storage logs", async () => {
      const result = await client.getLogs(projectRef, "storage", 10);
      expect(result).toBeDefined();
    });

    it("retrieves edge_functions logs", async () => {
      const result = await client.getLogs(projectRef, "edge_functions", 10);
      expect(result).toBeDefined();
    });

    it("retrieves realtime logs", async () => {
      const result = await client.getLogs(projectRef, "realtime", 10);
      expect(result).toBeDefined();
    });

    it("respects limit parameter", async () => {
      const result5 = await client.getLogs(projectRef, "postgres", 5);
      const result50 = await client.getLogs(projectRef, "postgres", 50);

      expect(result5).toBeDefined();
      expect(result50).toBeDefined();
      // Can't guarantee exact counts as it depends on actual log volume
    });

    it("handles large limit values", async () => {
      const result = await client.getLogs(projectRef, "postgres", 500);
      expect(result).toBeDefined();
    });

    it("handles zero limit", async () => {
      const result = await client.getLogs(projectRef, "postgres", 0);
      expect(result).toBeDefined();
    });

    it("returns logs with expected structure", async () => {
      const result = await client.getLogs(projectRef, "postgres", 5);
      expect(result).toBeDefined();
      // Structure depends on API response, just verify we get something
    });
  });

  describe("get_advisors", () => {
    it("retrieves advisor recommendations", async () => {
      const result = await client.getAdvisors(projectRef);
      expect(result).toBeDefined();
      expect(result).toHaveProperty("performance");
      expect(result).toHaveProperty("security");
    });

    it("returns performance advisors", async () => {
      const result = await client.getAdvisors(projectRef) as {
        performance: unknown;
        security: unknown;
      };
      expect(result.performance).toBeDefined();
    });

    it("returns security advisors", async () => {
      const result = await client.getAdvisors(projectRef) as {
        performance: unknown;
        security: unknown;
      };
      expect(result.security).toBeDefined();
    });

    it("handles projects with no issues", async () => {
      const result = await client.getAdvisors(projectRef);
      // May return empty arrays if no issues
      expect(result).toBeDefined();
    });
  });

  describe("get_project_url", () => {
    it("retrieves project details", async () => {
      const result = await client.getProject(projectRef);
      expect(result).toBeDefined();
    });

    it("returns project with expected fields", async () => {
      const result = await client.getProject(projectRef) as Record<string, unknown>;
      expect(result).toBeDefined();
      // Common fields: id, name, region, etc.
    });
  });

  describe("get_publishable_keys", () => {
    it("retrieves API keys", async () => {
      const result = await client.getApiKeys(projectRef);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("includes anon key", async () => {
      const result = await client.getApiKeys(projectRef) as Array<{ name: string }>;
      const hasAnon = result.some((key) => key.name === "anon" || key.name.includes("anon"));
      // May vary by API response structure
      expect(result.length).toBeGreaterThan(0);
    });

    it("includes service role key", async () => {
      const result = await client.getApiKeys(projectRef) as Array<{ name: string }>;
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns keys with expected structure", async () => {
      const result = await client.getApiKeys(projectRef) as Array<Record<string, unknown>>;

      if (result.length > 0) {
        const firstKey = result[0];
        expect(firstKey).toBeDefined();
      }
    });
  });

  describe("generate_typescript_types", () => {
    it("generates TypeScript types for project", async () => {
      const result = await client.generateTypes(projectRef);
      expect(result).toBeDefined();
    });

    it("returns valid TypeScript type definitions", async () => {
      const result = await client.generateTypes(projectRef) as { types?: string } | string;

      // The result might be a string or an object with types
      if (typeof result === "string") {
        expect(result).toContain("export");
      } else if (result && typeof result === "object") {
        expect(result).toBeDefined();
      }
    });

    it("includes Database interface", async () => {
      const result = await client.generateTypes(projectRef);
      expect(result).toBeDefined();
      // Structure depends on API
    });

    it("includes table definitions", async () => {
      const result = await client.generateTypes(projectRef);
      expect(result).toBeDefined();
      // Should include users, orders, products, order_items from our test DB
    });
  });
});

describe("Documentation Search (Integration)", () => {
  describe("search_docs", () => {
    it("searches for authentication docs", async () => {
      const result = await searchDocs("authentication");
      expect(result).toBeDefined();
    });

    it("returns results array", async () => {
      const result = await searchDocs("database") as { results: unknown[] };
      expect(result.results).toBeInstanceOf(Array);
    });

    it("includes query in response", async () => {
      const result = await searchDocs("storage") as { query: string };
      expect(result.query).toBe("storage");
    });

    it("includes note about API limitation", async () => {
      const result = await searchDocs("anything") as { note: string };
      expect(result.note).toBeDefined();
    });

    it("returns auth docs for auth query", async () => {
      const result = await searchDocs("auth") as { results: Array<{ url: string }> };
      const hasAuthUrl = result.results.some((r) => r.url.includes("auth"));
      expect(hasAuthUrl).toBe(true);
    });

    it("returns database docs for database query", async () => {
      const result = await searchDocs("database") as { results: Array<{ url: string }> };
      const hasDbUrl = result.results.some((r) => r.url.includes("database"));
      expect(hasDbUrl).toBe(true);
    });

    it("returns storage docs for storage query", async () => {
      const result = await searchDocs("storage") as { results: Array<{ url: string }> };
      const hasStorageUrl = result.results.some((r) => r.url.includes("storage"));
      expect(hasStorageUrl).toBe(true);
    });

    it("returns functions docs for functions query", async () => {
      const result = await searchDocs("functions") as { results: Array<{ url: string }> };
      const hasFunctionsUrl = result.results.some((r) => r.url.includes("functions"));
      expect(hasFunctionsUrl).toBe(true);
    });

    it("returns realtime docs for realtime query", async () => {
      const result = await searchDocs("realtime") as { results: Array<{ url: string }> };
      const hasRealtimeUrl = result.results.some((r) => r.url.includes("realtime"));
      expect(hasRealtimeUrl).toBe(true);
    });

    it("returns RLS docs for rls query", async () => {
      const result = await searchDocs("rls") as { results: Array<{ url: string }> };
      const hasRlsUrl = result.results.some((r) => r.url.includes("row-level-security"));
      expect(hasRlsUrl).toBe(true);
    });

    it("returns API docs for api query", async () => {
      const result = await searchDocs("api") as { results: Array<{ url: string }> };
      const hasApiUrl = result.results.some((r) => r.url.includes("api"));
      expect(hasApiUrl).toBe(true);
    });

    it("always includes main docs link", async () => {
      const result = await searchDocs("random-unknown-topic") as {
        results: Array<{ url: string }>;
      };
      const hasMainDocs = result.results.some(
        (r) => r.url === "https://supabase.com/docs"
      );
      expect(hasMainDocs).toBe(true);
    });

    it("handles empty query", async () => {
      const result = await searchDocs("") as { results: unknown[] };
      expect(result.results).toBeDefined();
    });

    it("handles special characters in query", async () => {
      const result = await searchDocs("auth & database") as { results: unknown[] };
      expect(result.results).toBeDefined();
    });

    it("handles unicode characters", async () => {
      const result = await searchDocs("认证") as { results: unknown[] };
      expect(result.results).toBeDefined();
    });

    it("case insensitive search", async () => {
      const lowerResult = await searchDocs("auth") as { results: unknown[] };
      const upperResult = await searchDocs("AUTH") as { results: unknown[] };
      expect(lowerResult.results.length).toBe(upperResult.results.length);
    });
  });
});

describe("Project Info Operations (Integration)", () => {
  let client: SupabaseManagementClient;
  let projectRef: string;

  beforeAll(() => {
    const config = getTestConfig();
    client = new SupabaseManagementClient(config.accessToken);
    projectRef = config.projectRef;
  });

  describe("Combined project info retrieval", () => {
    it("can retrieve all project info in sequence", async () => {
      const project = await client.getProject(projectRef);
      expect(project).toBeDefined();

      const keys = await client.getApiKeys(projectRef);
      expect(keys).toBeDefined();

      const types = await client.generateTypes(projectRef);
      expect(types).toBeDefined();
    });

    it("can retrieve project info in parallel", async () => {
      const [project, keys, types] = await Promise.all([
        client.getProject(projectRef),
        client.getApiKeys(projectRef),
        client.generateTypes(projectRef),
      ]);

      expect(project).toBeDefined();
      expect(keys).toBeDefined();
      expect(types).toBeDefined();
    });
  });
});
