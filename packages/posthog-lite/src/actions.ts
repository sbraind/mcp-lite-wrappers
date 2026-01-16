import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Actions,
  ActionSchema,
  PayloadSchemas,
  ToolResult,
  type ToolInput,
} from "./types.js";
import { PostHogClient, ApiError, searchDocs } from "./client/index.js";
import { ActionMetadata, TopActions, CategoryOrder } from "./metadata.js";

interface Config {
  apiKey: string;
  host?: string;
  projectId?: number;
  organizationId?: string;
}

function getConfig(): Config {
  const apiKey = process.env.POSTHOG_API_KEY || process.env.POSTHOG_PERSONAL_API_KEY;
  const host = process.env.POSTHOG_HOST || "https://app.posthog.com";
  const projectId = process.env.POSTHOG_PROJECT_ID ? parseInt(process.env.POSTHOG_PROJECT_ID, 10) : undefined;
  const organizationId = process.env.POSTHOG_ORGANIZATION_ID;

  if (!apiKey) {
    throw new Error("POSTHOG_API_KEY or POSTHOG_PERSONAL_API_KEY environment variable is required");
  }

  return { apiKey, host, projectId, organizationId };
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

// Store for active project/org (can be set via actions)
let activeProjectId: number | undefined;
let activeOrganizationId: string | undefined;

async function dispatch(input: ToolInput): Promise<ToolResult> {
  const { action, payload = {} } = input;

  try {
    const config = getConfig();
    const client = new PostHogClient(config.apiKey, config.host);

    // Set project and org IDs
    const projectId = activeProjectId || config.projectId;
    if (projectId) {
      client.setProjectId(projectId);
    }

    const orgId = activeOrganizationId || config.organizationId;
    if (orgId) {
      client.setOrganizationId(orgId);
    }

    // Validate and parse payload for the specific action
    const schema = PayloadSchemas[action as keyof typeof PayloadSchemas];
    const validatedPayload = schema.parse(payload);

    switch (action) {
      // ==================== Dashboards ====================
      case Actions.DASHBOARD_CREATE: {
        const p = validatedPayload as { name: string; description?: string; pinned?: boolean; tags?: string[] };
        const result = await client.createDashboard(p);
        return success(result);
      }

      case Actions.DASHBOARD_GET: {
        const p = validatedPayload as { dashboardId: string };
        const result = await client.getDashboard(p.dashboardId);
        return success(result);
      }

      case Actions.DASHBOARD_GET_ALL: {
        const p = validatedPayload as { limit?: number; offset?: number; search?: string; pinned?: boolean };
        const result = await client.getDashboards(p);
        return success(result);
      }

      case Actions.DASHBOARD_UPDATE: {
        const p = validatedPayload as { dashboardId: string; name?: string; description?: string; pinned?: boolean; tags?: string[] };
        const { dashboardId, ...data } = p;
        const result = await client.updateDashboard(dashboardId, data);
        return success(result);
      }

      case Actions.DASHBOARD_DELETE: {
        const p = validatedPayload as { dashboardId: string };
        const result = await client.deleteDashboard(p.dashboardId);
        return success(result);
      }

      case Actions.DASHBOARD_ADD_INSIGHT: {
        const p = validatedPayload as { dashboardId: string; insightId: string };
        const result = await client.addInsightToDashboard(p.dashboardId, p.insightId);
        return success(result);
      }

      // ==================== Documentation ====================
      case Actions.DOCS_SEARCH: {
        const p = validatedPayload as { query: string };
        const result = await searchDocs(p.query);
        return success(result);
      }

      // ==================== Error Tracking ====================
      case Actions.LIST_ERRORS: {
        const p = validatedPayload as { orderBy?: string; dateFrom?: string; dateTo?: string; status?: string };
        const result = await client.listErrors(p);
        return success(result);
      }

      case Actions.ERROR_DETAILS: {
        const p = validatedPayload as { issueId: string; dateFrom?: string; dateTo?: string };
        const { issueId, ...params } = p;
        const result = await client.getErrorDetails(issueId, params);
        return success(result);
      }

      // ==================== Feature Flags ====================
      case Actions.CREATE_FEATURE_FLAG: {
        const p = validatedPayload as {
          name: string;
          key: string;
          description?: string;
          filters?: { groups?: Array<Record<string, unknown>> };
          active?: boolean;
        };
        const result = await client.createFeatureFlag(p);
        return success(result);
      }

      case Actions.FEATURE_FLAG_GET: {
        const p = validatedPayload as { flagId?: number; flagKey?: string };
        const result = await client.getFeatureFlag(p);
        return success(result);
      }

      case Actions.FEATURE_FLAG_GET_ALL: {
        const result = await client.getFeatureFlags();
        return success(result);
      }

      case Actions.UPDATE_FEATURE_FLAG: {
        const p = validatedPayload as {
          flagKey: string;
          name?: string;
          description?: string;
          filters?: { groups?: Array<Record<string, unknown>> };
          active?: boolean;
          tags?: string[];
        };
        const { flagKey, ...data } = p;
        const result = await client.updateFeatureFlag(flagKey, data);
        return success(result);
      }

      case Actions.DELETE_FEATURE_FLAG: {
        const p = validatedPayload as { flagKey: string };
        const result = await client.deleteFeatureFlag(p.flagKey);
        return success(result);
      }

      // ==================== Experiments ====================
      case Actions.EXPERIMENT_CREATE: {
        const p = validatedPayload as {
          name: string;
          feature_flag_key: string;
          type?: string;
          description?: string;
          primary_metrics?: Array<Record<string, unknown>>;
          secondary_metrics?: Array<Record<string, unknown>>;
          variants?: Array<{ key: string; name?: string; rollout_percentage?: number }>;
          minimum_detectable_effect?: number;
          filter_test_accounts?: boolean;
          draft?: boolean;
        };
        const result = await client.createExperiment(p);
        return success(result);
      }

      case Actions.EXPERIMENT_GET: {
        const p = validatedPayload as { experimentId: string };
        const result = await client.getExperiment(p.experimentId);
        return success(result);
      }

      case Actions.EXPERIMENT_GET_ALL: {
        const result = await client.getExperiments();
        return success(result);
      }

      case Actions.EXPERIMENT_RESULTS_GET: {
        const p = validatedPayload as { experimentId: string; refresh: boolean };
        const result = await client.getExperimentResults(p.experimentId, p.refresh);
        return success(result);
      }

      case Actions.EXPERIMENT_UPDATE: {
        const p = validatedPayload as {
          experimentId: string;
          name?: string;
          description?: string;
          launch?: boolean;
          conclude?: string;
          restart?: boolean;
          archive?: boolean;
        };
        const { experimentId, ...data } = p;
        const result = await client.updateExperiment(experimentId, data);
        return success(result);
      }

      case Actions.EXPERIMENT_DELETE: {
        const p = validatedPayload as { experimentId: string };
        const result = await client.deleteExperiment(p.experimentId);
        return success(result);
      }

      // ==================== Insights & Analytics ====================
      case Actions.INSIGHT_QUERY: {
        const p = validatedPayload as { query: Record<string, unknown> };
        const result = await client.queryInsight(p.query);
        return success(result);
      }

      case Actions.INSIGHT_GENERATE_HOGQL: {
        const p = validatedPayload as { question: string };
        const result = await client.generateHogQL(p.question);
        return success(result);
      }

      case Actions.INSIGHT_CREATE: {
        const p = validatedPayload as {
          name: string;
          query: Record<string, unknown>;
          description?: string;
          favorited?: boolean;
          tags?: string[];
        };
        const result = await client.createInsight(p);
        return success(result);
      }

      case Actions.INSIGHT_GET: {
        const p = validatedPayload as { insightId: string };
        const result = await client.getInsight(p.insightId);
        return success(result);
      }

      case Actions.INSIGHT_GET_ALL: {
        const p = validatedPayload as { limit?: number; offset?: number; favorited?: boolean; search?: string };
        const result = await client.getInsights(p);
        return success(result);
      }

      case Actions.INSIGHT_UPDATE: {
        const p = validatedPayload as {
          insightId: string;
          name?: string;
          description?: string;
          query?: Record<string, unknown>;
          favorited?: boolean;
          dashboard?: string;
          tags?: string[];
        };
        const { insightId, ...data } = p;
        const result = await client.updateInsight(insightId, data);
        return success(result);
      }

      case Actions.INSIGHT_DELETE: {
        const p = validatedPayload as { insightId: string };
        const result = await client.deleteInsight(p.insightId);
        return success(result);
      }

      // ==================== LLM Analytics ====================
      case Actions.GET_LLM_COSTS: {
        const p = validatedPayload as { projectId: string; days?: number };
        const result = await client.getLLMCosts(p.projectId, p.days);
        return success(result);
      }

      // ==================== Organization & Project ====================
      case Actions.ORGANIZATIONS_GET: {
        const result = await client.getOrganizations();
        return success(result);
      }

      case Actions.ORGANIZATION_DETAILS_GET: {
        const result = await client.getOrganizationDetails();
        return success(result);
      }

      case Actions.ORGANIZATION_SET_ACTIVE: {
        const p = validatedPayload as { orgId: string };
        activeOrganizationId = p.orgId;
        return success({ message: `Active organization set to ${p.orgId}`, organizationId: p.orgId });
      }

      case Actions.PROJECTS_GET: {
        const result = await client.getProjects();
        return success(result);
      }

      case Actions.PROJECT_SET_ACTIVE: {
        const p = validatedPayload as { projectId: number };
        activeProjectId = p.projectId;
        return success({ message: `Active project set to ${p.projectId}`, projectId: p.projectId });
      }

      // ==================== Events & Properties ====================
      case Actions.PROPERTY_DEFINITIONS: {
        const p = validatedPayload as { type: string; eventName?: string; includePredefinedProperties?: boolean };
        const result = await client.getPropertyDefinitions(p);
        return success(result);
      }

      case Actions.EVENT_DEFINITIONS: {
        const p = validatedPayload as { q?: string };
        const result = await client.getEventDefinitions(p.q);
        return success(result);
      }

      // ==================== Surveys ====================
      case Actions.SURVEY_CREATE: {
        const p = validatedPayload as {
          name: string;
          questions: Array<Record<string, unknown>>;
          type?: string;
          appearance?: Record<string, unknown>;
          targeting_flag_filters?: Record<string, unknown>;
        };
        const result = await client.createSurvey(p);
        return success(result);
      }

      case Actions.SURVEY_GET: {
        const p = validatedPayload as { surveyId: string };
        const result = await client.getSurvey(p.surveyId);
        return success(result);
      }

      case Actions.SURVEY_GET_ALL: {
        const p = validatedPayload as { limit?: number; offset?: number; search?: string };
        const result = await client.getSurveys(p);
        return success(result);
      }

      case Actions.SURVEY_UPDATE: {
        const p = validatedPayload as {
          surveyId: string;
          name?: string;
          description?: string;
          questions?: Array<Record<string, unknown>>;
          conditions?: Record<string, unknown>;
          schedule?: Record<string, unknown>;
          targeting?: Record<string, unknown>;
        };
        const { surveyId, ...data } = p;
        const result = await client.updateSurvey(surveyId, data);
        return success(result);
      }

      case Actions.SURVEY_DELETE: {
        const p = validatedPayload as { surveyId: string };
        const result = await client.deleteSurvey(p.surveyId);
        return success(result);
      }

      case Actions.SURVEY_STATS: {
        const p = validatedPayload as { survey_id: string; date_from?: string; date_to?: string };
        const result = await client.getSurveyStats(p.survey_id, {
          dateFrom: p.date_from,
          dateTo: p.date_to,
        });
        return success(result);
      }

      case Actions.SURVEY_RESPONSE_COUNTS: {
        const result = await client.getSurveyResponseCounts();
        return success(result);
      }

      case Actions.SURVEY_GLOBAL_STATS: {
        const p = validatedPayload as { date_from?: string; date_to?: string };
        const result = await client.getSurveyGlobalStats({
          dateFrom: p.date_from,
          dateTo: p.date_to,
        });
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
  // Group actions by category
  const byCategory: Record<string, string[]> = {};

  for (const [action, meta] of Object.entries(ActionMetadata)) {
    const cat = meta.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(action);
  }

  // Build grouped description
  const lines: string[] = ["PostHog operations.", ""];

  for (const category of CategoryOrder) {
    const actions = byCategory[category];
    if (!actions?.length) continue;

    const label = category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
    lines.push(`${label}: ${actions.join(", ")}`);

    // Add 1 example from the first action of the category
    const firstAction = actions[0];
    const meta = ActionMetadata[firstAction];
    if (meta?.examples?.[0]) {
      const ex = JSON.stringify({ action: firstAction, payload: meta.examples[0] });
      lines.push(`  Ex: ${ex}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildPayloadSchema() {
  // Generic fallback for other actions
  const fallback = z.record(z.unknown()).describe(
    "Parameters for other actions - see examples above"
  );

  // Build explicit schemas for top actions
  const topSchemas: z.ZodTypeAny[] = TopActions.map((action) => {
    const baseSchema = PayloadSchemas[action as keyof typeof PayloadSchemas];
    const meta = ActionMetadata[action];
    // Handle schemas with refinements - just use shape without the refine
    const shape = 'shape' in baseSchema ? baseSchema.shape : {};
    return z.object({
      ...shape,
    }).describe(meta?.description || action);
  });

  // z.union requires at least 2 elements
  if (topSchemas.length === 0) {
    return fallback.optional();
  }
  if (topSchemas.length === 1) {
    return z.union([topSchemas[0], fallback]).optional();
  }

  return z.union([topSchemas[0], topSchemas[1], ...topSchemas.slice(2), fallback]).optional();
}

export function registerTools(server: McpServer): void {
  server.tool(
    "posthog",
    buildDescription(),
    {
      action: ActionSchema.describe("Action to perform"),
      payload: buildPayloadSchema().describe("Action-specific parameters"),
    },
    async (args) => {
      return dispatch(args);
    }
  );
}
