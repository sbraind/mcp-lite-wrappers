import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SupabaseManagementClient, ApiError, searchDocs } from "../../src/client/index.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("SupabaseManagementClient", () => {
  let client: SupabaseManagementClient;
  const projectRef = "test-project";
  const accessToken = "test-access-token";

  beforeEach(() => {
    client = new SupabaseManagementClient(accessToken);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

  describe("constructor and configuration", () => {
    it("sets correct base URL", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      await client.listTables(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://api.supabase.com/v1"),
        expect.anything()
      );
    });

    it("sets authorization header with bearer token", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      await client.listTables(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${accessToken}`,
          }),
        })
      );
    });

    it("sets content-type header", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));
      await client.listTables(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("throws ApiError on 401 Unauthorized", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Unauthorized", 401));

      await expect(client.listTables(projectRef)).rejects.toThrow(ApiError);

      mockFetch.mockResolvedValueOnce(mockErrorResponse("Unauthorized", 401));
      try {
        await client.listTables(projectRef);
      } catch (err) {
        expect((err as ApiError).statusCode).toBe(401);
        expect((err as ApiError).message).toBe("Unauthorized");
      }
    });

    it("throws ApiError on 403 Forbidden", async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse("Permission denied", 403, "permission_denied")
      );

      try {
        await client.listTables(projectRef);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(403);
        expect((err as ApiError).code).toBe("permission_denied");
      }
    });

    it("throws ApiError on 404 Not Found", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Project not found", 404));

      await expect(client.getProject(projectRef)).rejects.toThrow(ApiError);
    });

    it("throws ApiError on 500 Internal Server Error", async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse("Internal error", 500));

      await expect(client.listTables(projectRef)).rejects.toMatchObject({
        statusCode: 500,
      });
    });

    it("handles non-JSON error responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: vi.fn().mockResolvedValue("Bad Gateway"),
      });

      await expect(client.listTables(projectRef)).rejects.toThrow("Bad Gateway");
    });

    it("handles empty error responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue(""),
      });

      await expect(client.listTables(projectRef)).rejects.toThrow("API Error: 503");
    });

    it("handles network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.listTables(projectRef)).rejects.toThrow("Network error");
    });
  });

  describe("executeSql", () => {
    it("sends POST request with query", async () => {
      const expectedResult = { rows: [{ id: 1 }] };
      mockFetch.mockResolvedValueOnce(mockResponse(expectedResult));

      const result = await client.executeSql(projectRef, "SELECT * FROM users");

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ query: "SELECT * FROM users" }),
        })
      );
      expect(result).toEqual(expectedResult);
    });

    it("handles complex SQL queries", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await client.executeSql(
        projectRef,
        `SELECT u.*, COUNT(o.id) as order_count
         FROM users u
         LEFT JOIN orders o ON o.user_id = u.id
         WHERE u.created_at > '2024-01-01'
         GROUP BY u.id`
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          body: expect.stringContaining("SELECT u.*, COUNT(o.id)"),
        })
      );
    });

    it("handles SQL with special characters", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await client.executeSql(projectRef, "SELECT * FROM users WHERE name = 'O''Brien'");

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("listTables", () => {
    it("uses default public schema", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await client.listTables(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/database/query"),
        expect.objectContaining({
          body: expect.stringContaining("'public'"),
        })
      );
    });

    it("accepts multiple schemas", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await client.listTables(projectRef, ["public", "auth", "storage"]);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.query).toContain("'public'");
      expect(body.query).toContain("'auth'");
      expect(body.query).toContain("'storage'");
    });
  });

  describe("listExtensions", () => {
    it("queries pg_extension catalog", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ rows: [] }));

      await client.listExtensions(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/database/query"),
        expect.objectContaining({
          body: expect.stringContaining("pg_extension"),
        })
      );
    });
  });

  describe("listMigrations", () => {
    it("sends GET request to migrations endpoint", async () => {
      const migrations = [{ version: "001", name: "init" }];
      mockFetch.mockResolvedValueOnce(mockResponse(migrations));

      const result = await client.listMigrations(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual(migrations);
    });
  });

  describe("applyMigration", () => {
    it("sends POST request with migration data", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

      await client.applyMigration(
        projectRef,
        "add_users",
        "CREATE TABLE users (id serial PRIMARY KEY)"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "add_users",
            statements: ["CREATE TABLE users (id serial PRIMARY KEY)"],
          }),
        })
      );
    });
  });

  describe("getLogs", () => {
    it("sends GET request with time range and limit", async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      await client.getLogs(projectRef, "postgres", 50);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/analytics\/endpoints\/logs/),
        expect.objectContaining({ method: "GET" })
      );
      // The limit is URL-encoded in the SQL query parameter
      const callUrl = mockFetch.mock.calls[0][0];
      expect(decodeURIComponent(callUrl)).toContain("LIMIT 50");
    });
  });

  describe("getAdvisors", () => {
    it("fetches both performance and security advisors", async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ recommendations: [] }))
        .mockResolvedValueOnce(mockResponse({ recommendations: [] }));

      const result = await client.getAdvisors(projectRef);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/advisors/performance"),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/advisors/security"),
        expect.anything()
      );
      expect(result).toHaveProperty("performance");
      expect(result).toHaveProperty("security");
    });

    it("handles advisor endpoint failures gracefully", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Performance advisor unavailable"))
        .mockResolvedValueOnce(mockResponse({ security: [] }));

      const result = await client.getAdvisors(projectRef);

      expect(result).toHaveProperty("performance");
      expect(result).toHaveProperty("security");
    });
  });

  describe("getProject", () => {
    it("sends GET request to project endpoint", async () => {
      const project = { id: projectRef, name: "Test Project" };
      mockFetch.mockResolvedValueOnce(mockResponse(project));

      const result = await client.getProject(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.supabase.com/v1/projects/${projectRef}`,
        expect.objectContaining({ method: "GET" })
      );
      expect(result).toEqual(project);
    });
  });

  describe("getApiKeys", () => {
    it("sends GET request to api-keys endpoint", async () => {
      const keys = [{ name: "anon", api_key: "xxx" }];
      mockFetch.mockResolvedValueOnce(mockResponse(keys));

      const result = await client.getApiKeys(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
        expect.anything()
      );
      expect(result).toEqual(keys);
    });
  });

  describe("generateTypes", () => {
    it("sends GET request to typescript types endpoint", async () => {
      const types = { types: "export interface Database {}" };
      mockFetch.mockResolvedValueOnce(mockResponse(types));

      const result = await client.generateTypes(projectRef);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.supabase.com/v1/projects/${projectRef}/types/typescript`,
        expect.anything()
      );
      expect(result).toEqual(types);
    });
  });

  describe("Edge Functions", () => {
    describe("listEdgeFunctions", () => {
      it("sends GET request to functions endpoint", async () => {
        const functions = [{ slug: "hello", status: "active" }];
        mockFetch.mockResolvedValueOnce(mockResponse(functions));

        const result = await client.listEdgeFunctions(projectRef);

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/functions`,
          expect.objectContaining({ method: "GET" })
        );
        expect(result).toEqual(functions);
      });
    });

    describe("getEdgeFunction", () => {
      it("sends GET request with function slug", async () => {
        const fn = { slug: "hello-world", status: "active" };
        mockFetch.mockResolvedValueOnce(mockResponse(fn));

        const result = await client.getEdgeFunction(projectRef, "hello-world");

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/functions/hello-world`,
          expect.anything()
        );
        expect(result).toEqual(fn);
      });
    });

    describe("deployEdgeFunction", () => {
      it("sends POST request with FormData", async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ slug: "new-fn", status: "deploying" }));

        await client.deployEdgeFunction(
          projectRef,
          "new-fn",
          "export default () => new Response('Hello')",
          true
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/projects/${projectRef}/functions/deploy`),
          expect.objectContaining({
            method: "POST",
          })
        );
        // Check FormData was used (no Content-Type header, body is FormData)
        const call = mockFetch.mock.calls[0];
        expect(call[1].body).toBeInstanceOf(FormData);
      });

      it("includes verify_jwt in metadata", async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ slug: "public-fn" }));

        await client.deployEdgeFunction(projectRef, "public-fn", "code", false);

        const call = mockFetch.mock.calls[0];
        const formData = call[1].body as FormData;
        const metadata = formData.get("metadata");
        expect(JSON.parse(metadata as string)).toMatchObject({
          verify_jwt: false,
        });
      });
    });
  });

  describe("Branching", () => {
    describe("createBranch", () => {
      it("sends POST request with branch name", async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ id: "branch-123", name: "feature-x" }));

        await client.createBranch(projectRef, "feature-x");

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/branches`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ branch_name: "feature-x" }),
          })
        );
      });
    });

    describe("listBranches", () => {
      it("sends GET request to branches endpoint", async () => {
        const branches = [{ id: "branch-123", name: "main" }];
        mockFetch.mockResolvedValueOnce(mockResponse(branches));

        const result = await client.listBranches(projectRef);

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/branches`,
          expect.objectContaining({ method: "GET" })
        );
        expect(result).toEqual(branches);
      });
    });

    describe("deleteBranch", () => {
      it("sends DELETE request with branch ID", async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

        await client.deleteBranch(projectRef, "branch-123");

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/branches/branch-123`,
          expect.objectContaining({ method: "DELETE" })
        );
      });
    });

    describe("mergeBranch", () => {
      it("sends POST request to merge endpoint", async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

        await client.mergeBranch(projectRef, "branch-123");

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/branches/branch-123/merge`,
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    describe("resetBranch", () => {
      it("sends POST request to reset endpoint", async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

        await client.resetBranch(projectRef, "branch-456");

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/branches/branch-456/reset`,
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    describe("rebaseBranch", () => {
      it("sends POST request to rebase endpoint", async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ success: true }));

        await client.rebaseBranch(projectRef, "branch-789");

        expect(mockFetch).toHaveBeenCalledWith(
          `https://api.supabase.com/v1/projects/${projectRef}/branches/branch-789/rebase`,
          expect.objectContaining({ method: "POST" })
        );
      });
    });
  });

  describe("empty response handling", () => {
    it("handles empty response body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        text: vi.fn().mockResolvedValue(""),
      });

      const result = await client.deleteBranch(projectRef, "branch-123");

      expect(result).toEqual({});
    });
  });
});

describe("ApiError", () => {
  it("has correct name property", () => {
    const error = new ApiError("Test", 400);
    expect(error.name).toBe("ApiError");
  });

  it("stores message, statusCode, and optional code", () => {
    const error = new ApiError("Not found", 404, "not_found");
    expect(error.message).toBe("Not found");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("not_found");
  });

  it("extends Error", () => {
    const error = new ApiError("Test", 500);
    expect(error).toBeInstanceOf(Error);
  });

  it("code is optional", () => {
    const error = new ApiError("Test", 400);
    expect(error.code).toBeUndefined();
  });
});

describe("searchDocs", () => {
  it("returns results for known topics", async () => {
    const result = await searchDocs("authentication") as { results: unknown[] };
    expect(result.results).toBeInstanceOf(Array);
    expect(result.results.length).toBeGreaterThan(0);
  });

  it("returns auth-related links for auth query", async () => {
    const result = await searchDocs("auth") as { results: Array<{ url: string; title: string }> };
    expect(result.results.some((r) => r.url.includes("/auth"))).toBe(true);
  });

  it("returns database-related links for database query", async () => {
    const result = await searchDocs("database") as { results: Array<{ url: string; title: string }> };
    expect(result.results.some((r) => r.url.includes("/database"))).toBe(true);
  });

  it("returns storage-related links for storage query", async () => {
    const result = await searchDocs("storage") as { results: Array<{ url: string; title: string }> };
    expect(result.results.some((r) => r.url.includes("/storage"))).toBe(true);
  });

  it("returns edge functions links for functions query", async () => {
    const result = await searchDocs("functions") as { results: Array<{ url: string; title: string }> };
    expect(result.results.some((r) => r.url.includes("/functions"))).toBe(true);
  });

  it("returns realtime links for realtime query", async () => {
    const result = await searchDocs("realtime") as { results: Array<{ url: string; title: string }> };
    expect(result.results.some((r) => r.url.includes("/realtime"))).toBe(true);
  });

  it("returns RLS links for rls query", async () => {
    const result = await searchDocs("rls") as { results: Array<{ url: string; title: string }> };
    expect(result.results.some((r) => r.url.includes("row-level-security"))).toBe(true);
  });

  it("returns API links for api query", async () => {
    const result = await searchDocs("api") as { results: Array<{ url: string; title: string }> };
    expect(result.results.some((r) => r.url.includes("/api"))).toBe(true);
  });

  it("always includes main docs link", async () => {
    const result = await searchDocs("random-unknown-topic") as { results: Array<{ url: string }> };
    expect(result.results.some((r) => r.url === "https://supabase.com/docs")).toBe(true);
  });

  it("includes query in response", async () => {
    const result = await searchDocs("test query") as { query: string };
    expect(result.query).toBe("test query");
  });

  it("includes note about no public API", async () => {
    const result = await searchDocs("anything") as { note: string };
    expect(result.note).toContain("does not have a public docs search API");
  });

  it("handles case-insensitive queries", async () => {
    const result1 = await searchDocs("AUTH") as { results: unknown[] };
    const result2 = await searchDocs("auth") as { results: unknown[] };
    expect(result1.results.length).toBe(result2.results.length);
  });
});
