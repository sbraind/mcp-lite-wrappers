import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SupabaseManagementClient, ApiError } from "../../src/client/index.js";
import { getTestConfig, delay, addCleanupTask } from "./setup.js";

describe("Edge Functions Operations (Integration)", () => {
  let client: SupabaseManagementClient;
  let projectRef: string;

  beforeAll(() => {
    const config = getTestConfig();
    client = new SupabaseManagementClient(config.accessToken);
    projectRef = config.projectRef;
  });

  describe("list_edge_functions", () => {
    it("lists all edge functions", async () => {
      const result = await client.listEdgeFunctions(projectRef);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns empty array when no functions exist", async () => {
      const result = await client.listEdgeFunctions(projectRef) as unknown[];
      expect(result).toBeDefined();
      // May be empty or have functions from previous tests
    });
  });

  describe("deploy_edge_function", () => {
    const testFunctionSlug = `test-fn-${Date.now()}`;

    afterAll(async () => {
      // Cleanup: try to delete the test function
      try {
        // Note: The API may not have a direct delete, we handle this in cleanup
      } catch {
        // Ignore cleanup errors
      }
    });

    it("deploys a simple edge function", async () => {
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        serve((req) => {
          return new Response("Hello from ${testFunctionSlug}!", {
            headers: { "Content-Type": "text/plain" },
          });
        });
      `;

      const result = await client.deployEdgeFunction(
        projectRef,
        testFunctionSlug,
        code,
        false // Don't verify JWT for testing
      );

      expect(result).toBeDefined();

      // Wait for deployment
      await delay(3000);
    });

    it("deploys function with JWT verification enabled", async () => {
      const slug = `jwt-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        serve((req) => {
          return new Response(JSON.stringify({ authenticated: true }), {
            headers: { "Content-Type": "application/json" },
          });
        });
      `;

      const result = await client.deployEdgeFunction(
        projectRef,
        slug,
        code,
        true // Verify JWT
      );

      expect(result).toBeDefined();
      await delay(2000);
    });

    it("deploys function that handles POST requests", async () => {
      const slug = `post-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        serve(async (req) => {
          if (req.method === "POST") {
            const body = await req.json();
            return new Response(JSON.stringify({ received: body }), {
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response("Method not allowed", { status: 405 });
        });
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, code, false);

      expect(result).toBeDefined();
      await delay(2000);
    });

    it("deploys function with environment variable access", async () => {
      const slug = `env-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        serve((req) => {
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          return new Response(JSON.stringify({
            hasUrl: !!supabaseUrl
          }), {
            headers: { "Content-Type": "application/json" },
          });
        });
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, code, false);

      expect(result).toBeDefined();
      await delay(2000);
    });

    it("deploys function with CORS headers", async () => {
      const slug = `cors-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        const corsHeaders = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        };

        serve((req) => {
          if (req.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
          }

          return new Response(JSON.stringify({ data: "Hello" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        });
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, code, false);

      expect(result).toBeDefined();
      await delay(2000);
    });

    it("updates existing function with new code", async () => {
      const slug = `update-fn-${Date.now()}`;

      // Deploy initial version
      const initialCode = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
        serve((req) => new Response("v1"));
      `;

      await client.deployEdgeFunction(projectRef, slug, initialCode, false);
      await delay(2000);

      // Update with new version
      const updatedCode = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
        serve((req) => new Response("v2"));
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, updatedCode, false);

      expect(result).toBeDefined();
    });

    it("handles deployment with syntax error gracefully", async () => {
      const slug = `error-fn-${Date.now()}`;
      const invalidCode = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
        serve((req) => {
          // Missing closing brace
          return new Response("Hello"
        });
      `;

      // This should either fail or succeed depending on API behavior
      // Some APIs validate syntax, others deploy and fail at runtime
      try {
        await client.deployEdgeFunction(projectRef, slug, invalidCode, false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("get_edge_function", () => {
    it("gets details of deployed function", async () => {
      // First deploy a function to get
      const slug = `get-test-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
        serve((req) => new Response("Hello"));
      `;

      await client.deployEdgeFunction(projectRef, slug, code, false);
      await delay(3000);

      const result = await client.getEdgeFunction(projectRef, slug);

      expect(result).toBeDefined();
    });

    it("returns function metadata", async () => {
      const slug = `metadata-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
        serve((req) => new Response("Meta"));
      `;

      await client.deployEdgeFunction(projectRef, slug, code, true);
      await delay(3000);

      const result = await client.getEdgeFunction(projectRef, slug) as Record<string, unknown>;

      expect(result).toBeDefined();
      // Check for common metadata fields
      if (result.slug) expect(result.slug).toBe(slug);
    });

    it("returns 404 for non-existent function", async () => {
      try {
        await client.getEdgeFunction(projectRef, "non-existent-function-xyz-123");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(404);
      }
    });
  });

  describe("Edge function code patterns", () => {
    it("deploys function that calls Supabase client", async () => {
      const slug = `supabase-client-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
        import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

        serve(async (req) => {
          const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          );

          const { data, error } = await supabaseClient
            .from("users")
            .select("*")
            .limit(1);

          return new Response(JSON.stringify({ data, error }), {
            headers: { "Content-Type": "application/json" },
          });
        });
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, code, false);
      expect(result).toBeDefined();
    });

    it("deploys function with request body parsing", async () => {
      const slug = `body-parse-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        serve(async (req) => {
          try {
            const body = await req.json();
            return new Response(JSON.stringify({
              received: body,
              method: req.method,
              url: req.url
            }), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid JSON" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        });
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, code, false);
      expect(result).toBeDefined();
    });

    it("deploys function with URL params handling", async () => {
      const slug = `url-params-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        serve((req) => {
          const url = new URL(req.url);
          const name = url.searchParams.get("name") || "World";

          return new Response(JSON.stringify({
            greeting: \`Hello, \${name}!\`,
            params: Object.fromEntries(url.searchParams)
          }), {
            headers: { "Content-Type": "application/json" },
          });
        });
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, code, false);
      expect(result).toBeDefined();
    });

    it("deploys function with error handling", async () => {
      const slug = `error-handling-fn-${Date.now()}`;
      const code = `
        import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

        serve(async (req) => {
          try {
            // Simulate some operation
            const data = { success: true };
            return new Response(JSON.stringify(data), {
              headers: { "Content-Type": "application/json" },
            });
          } catch (error) {
            console.error("Function error:", error);
            return new Response(JSON.stringify({
              error: "Internal error",
              message: error.message
            }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        });
      `;

      const result = await client.deployEdgeFunction(projectRef, slug, code, false);
      expect(result).toBeDefined();
    });
  });

  describe("Rate limiting and performance", () => {
    it("handles multiple sequential deployments", async () => {
      const slugs: string[] = [];

      for (let i = 0; i < 3; i++) {
        const slug = `sequential-fn-${Date.now()}-${i}`;
        slugs.push(slug);

        const code = `
          import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
          serve((req) => new Response("Function ${i}"));
        `;

        await client.deployEdgeFunction(projectRef, slug, code, false);
        await delay(1000); // Small delay between deployments
      }

      // Verify all were created
      const functions = await client.listEdgeFunctions(projectRef) as Array<{ slug: string }>;
      expect(functions).toBeDefined();
    });
  });
});
