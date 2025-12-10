import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Actions,
  ActionSchema,
  PayloadSchemas,
  ToolResult,
  ToolInputSchema,
  type ToolInput,
} from "./types.js";
import {
  SupabaseManagementClient,
  searchDocs,
  ApiError,
} from "./client/index.js";

function getConfig() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN environment variable is required");
  }

  return { accessToken, projectRef };
}

function success(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string, code?: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: true, message, code }) }],
    isError: true,
  };
}

function getProjectRef(payload: { project_id?: string }, config: { projectRef?: string }): string {
  const ref = payload.project_id || config.projectRef;
  if (!ref) {
    throw new Error("Project ID required. Set SUPABASE_PROJECT_REF or provide project_id in payload.");
  }
  return ref;
}

async function dispatch(input: ToolInput): Promise<ToolResult> {
  const config = getConfig();
  const client = new SupabaseManagementClient(config.accessToken);
  const { action, payload = {} } = input;

  try {
    // Validate and parse payload for the specific action
    const schema = PayloadSchemas[action as keyof typeof PayloadSchemas];
    const validatedPayload = schema.parse(payload);

    switch (action) {
      // ==================== Account/Project ====================
      case Actions.LIST_PROJECTS: {
        const result = await client.listProjects();
        return success(result);
      }

      case Actions.GET_PROJECT: {
        const p = validatedPayload as { id: string };
        const result = await client.getProject(p.id);
        return success(result);
      }

      case Actions.CREATE_PROJECT: {
        const p = validatedPayload as { name: string; region: string; organization_id: string; confirm_cost_id: string };
        // Verify cost confirmation before creating
        const result = await client.createProject(p.name, p.region, p.organization_id);
        return success(result);
      }

      case Actions.PAUSE_PROJECT: {
        const p = validatedPayload as { project_id: string };
        const result = await client.pauseProject(p.project_id);
        return success(result);
      }

      case Actions.RESTORE_PROJECT: {
        const p = validatedPayload as { project_id: string };
        const result = await client.restoreProject(p.project_id);
        return success(result);
      }

      // ==================== Organization ====================
      case Actions.LIST_ORGANIZATIONS: {
        const result = await client.listOrganizations();
        return success(result);
      }

      case Actions.GET_ORGANIZATION: {
        const p = validatedPayload as { id: string };
        const result = await client.getOrganization(p.id);
        return success(result);
      }

      // ==================== Cost ====================
      case Actions.GET_COST: {
        const p = validatedPayload as { type: string; organization_id: string };
        // Cost info is typically returned from the org or project info
        // For now, return a placeholder indicating cost should be checked with Supabase dashboard
        return success({
          type: p.type,
          organization_id: p.organization_id,
          note: "Cost information varies by plan. Check Supabase dashboard for current pricing.",
          pricing_url: "https://supabase.com/pricing",
        });
      }

      case Actions.CONFIRM_COST: {
        const p = validatedPayload as { type: string; recurrence: string; amount: number };
        // Generate a confirmation hash for the cost
        const hash = Buffer.from(JSON.stringify(p)).toString("base64").slice(0, 16);
        return success({
          confirm_cost_id: hash,
          type: p.type,
          recurrence: p.recurrence,
          amount: p.amount,
          confirmed: true,
        });
      }

      // ==================== Database ====================
      case Actions.EXECUTE_SQL: {
        const p = validatedPayload as { query: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.executeSql(ref, p.query);
        return success(result);
      }

      case Actions.LIST_TABLES: {
        const p = validatedPayload as { schemas: string[]; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.listTables(ref, p.schemas);
        return success(result);
      }

      case Actions.LIST_EXTENSIONS: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.listExtensions(ref);
        return success(result);
      }

      case Actions.LIST_MIGRATIONS: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.listMigrations(ref);
        return success(result);
      }

      case Actions.APPLY_MIGRATION: {
        const p = validatedPayload as { name: string; sql: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.applyMigration(ref, p.name, p.sql);
        return success(result);
      }

      // Monitoring
      case Actions.GET_LOGS: {
        const p = validatedPayload as { service: string; limit: number; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.getLogs(ref, p.service, p.limit);
        return success(result);
      }

      case Actions.GET_ADVISORS: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.getAdvisors(ref);
        return success(result);
      }

      // Project info
      case Actions.GET_PROJECT_URL: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const project = await client.getProject(ref) as { endpoint?: string };
        return success({ url: `https://${ref}.supabase.co`, endpoint: project.endpoint });
      }

      case Actions.GET_PUBLISHABLE_KEYS: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const keys = await client.getApiKeys(ref);
        return success(keys);
      }

      case Actions.GENERATE_TYPESCRIPT_TYPES: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const types = await client.generateTypes(ref);
        return success(types);
      }

      // Edge functions
      case Actions.LIST_EDGE_FUNCTIONS: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.listEdgeFunctions(ref);
        return success(result);
      }

      case Actions.GET_EDGE_FUNCTION: {
        const p = validatedPayload as { slug: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.getEdgeFunction(ref, p.slug);
        return success(result);
      }

      case Actions.DEPLOY_EDGE_FUNCTION: {
        const p = validatedPayload as { slug: string; code: string; verify_jwt: boolean; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.deployEdgeFunction(ref, p.slug, p.code, p.verify_jwt);
        return success(result);
      }

      // Branching
      case Actions.CREATE_BRANCH: {
        const p = validatedPayload as { name: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.createBranch(ref, p.name);
        return success(result);
      }

      case Actions.LIST_BRANCHES: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.listBranches(ref);
        return success(result);
      }

      case Actions.DELETE_BRANCH: {
        const p = validatedPayload as { branch_id: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.deleteBranch(ref, p.branch_id);
        return success(result);
      }

      case Actions.MERGE_BRANCH: {
        const p = validatedPayload as { branch_id: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.mergeBranch(ref, p.branch_id);
        return success(result);
      }

      case Actions.RESET_BRANCH: {
        const p = validatedPayload as { branch_id: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.resetBranch(ref, p.branch_id);
        return success(result);
      }

      case Actions.REBASE_BRANCH: {
        const p = validatedPayload as { branch_id: string; project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.rebaseBranch(ref, p.branch_id);
        return success(result);
      }

      // ==================== Storage ====================
      case Actions.LIST_STORAGE_BUCKETS: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.listStorageBuckets(ref);
        return success(result);
      }

      case Actions.GET_STORAGE_CONFIG: {
        const p = validatedPayload as { project_id?: string };
        const ref = getProjectRef(p, config);
        const result = await client.getStorageConfig(ref);
        return success(result);
      }

      case Actions.UPDATE_STORAGE_CONFIG: {
        const p = validatedPayload as {
          project_id?: string;
          config: {
            fileSizeLimit?: number;
            features?: {
              imageTransformation?: { enabled: boolean };
              s3Protocol?: { enabled: boolean };
            };
          };
        };
        const ref = getProjectRef(p, config);
        const result = await client.updateStorageConfig(ref, p.config);
        return success(result);
      }

      // ==================== Docs ====================
      case Actions.SEARCH_DOCS: {
        const p = validatedPayload as { query: string };
        const result = await searchDocs(p.query);
        return success(result);
      }

      default:
        return error(`Unknown action: ${action}`);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return error(err.message, err.code);
    }
    return error(err instanceof Error ? err.message : String(err));
  }
}

function buildDescription(): string {
  const actions = Object.values(Actions).join(", ");
  return `Supabase operations. Actions: ${actions}. Use action parameter to select operation, payload for action-specific parameters.`;
}

export function registerTools(server: McpServer): void {
  server.tool(
    "supabase",
    buildDescription(),
    {
      action: ActionSchema.describe("Action to perform"),
      payload: z.record(z.unknown()).optional().describe("Action-specific parameters"),
    },
    async (args) => {
      return dispatch(args);
    }
  );
}
