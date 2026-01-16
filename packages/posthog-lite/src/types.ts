import { z } from "zod";

// Action constants - 38 tools consolidated from PostHog MCP
export const Actions = {
  // ==================== Dashboard ====================
  DASHBOARD_CREATE: "dashboard_create",
  DASHBOARD_GET: "dashboard_get",
  DASHBOARD_GET_ALL: "dashboard_get_all",
  DASHBOARD_UPDATE: "dashboard_update",
  DASHBOARD_DELETE: "dashboard_delete",
  DASHBOARD_ADD_INSIGHT: "dashboard_add_insight",

  // ==================== Documentation ====================
  DOCS_SEARCH: "docs_search",

  // ==================== Error Tracking ====================
  LIST_ERRORS: "list_errors",
  ERROR_DETAILS: "error_details",

  // ==================== Feature Flags ====================
  CREATE_FEATURE_FLAG: "create_feature_flag",
  FEATURE_FLAG_GET: "feature_flag_get",
  FEATURE_FLAG_GET_ALL: "feature_flag_get_all",
  UPDATE_FEATURE_FLAG: "update_feature_flag",
  DELETE_FEATURE_FLAG: "delete_feature_flag",

  // ==================== Experiments ====================
  EXPERIMENT_CREATE: "experiment_create",
  EXPERIMENT_GET: "experiment_get",
  EXPERIMENT_GET_ALL: "experiment_get_all",
  EXPERIMENT_RESULTS_GET: "experiment_results_get",
  EXPERIMENT_UPDATE: "experiment_update",
  EXPERIMENT_DELETE: "experiment_delete",

  // ==================== Insights & Analytics ====================
  INSIGHT_QUERY: "insight_query",
  INSIGHT_GENERATE_HOGQL: "insight_generate_hogql",
  INSIGHT_CREATE: "insight_create",
  INSIGHT_GET: "insight_get",
  INSIGHT_GET_ALL: "insight_get_all",
  INSIGHT_UPDATE: "insight_update",
  INSIGHT_DELETE: "insight_delete",

  // ==================== LLM Analytics ====================
  GET_LLM_COSTS: "get_llm_costs",

  // ==================== Organization & Project ====================
  ORGANIZATIONS_GET: "organizations_get",
  ORGANIZATION_DETAILS_GET: "organization_details_get",
  ORGANIZATION_SET_ACTIVE: "organization_set_active",
  PROJECTS_GET: "projects_get",
  PROJECT_SET_ACTIVE: "project_set_active",

  // ==================== Events & Properties ====================
  PROPERTY_DEFINITIONS: "property_definitions",
  EVENT_DEFINITIONS: "event_definitions",

  // ==================== Surveys ====================
  SURVEY_CREATE: "survey_create",
  SURVEY_GET: "survey_get",
  SURVEY_GET_ALL: "survey_get_all",
  SURVEY_UPDATE: "survey_update",
  SURVEY_DELETE: "survey_delete",
  SURVEY_STATS: "survey_stats",
  SURVEY_RESPONSE_COUNTS: "survey_response_counts",
  SURVEY_GLOBAL_STATS: "survey_global_stats",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

export const ActionSchema = z.enum([
  // Dashboard
  Actions.DASHBOARD_CREATE,
  Actions.DASHBOARD_GET,
  Actions.DASHBOARD_GET_ALL,
  Actions.DASHBOARD_UPDATE,
  Actions.DASHBOARD_DELETE,
  Actions.DASHBOARD_ADD_INSIGHT,
  // Documentation
  Actions.DOCS_SEARCH,
  // Error Tracking
  Actions.LIST_ERRORS,
  Actions.ERROR_DETAILS,
  // Feature Flags
  Actions.CREATE_FEATURE_FLAG,
  Actions.FEATURE_FLAG_GET,
  Actions.FEATURE_FLAG_GET_ALL,
  Actions.UPDATE_FEATURE_FLAG,
  Actions.DELETE_FEATURE_FLAG,
  // Experiments
  Actions.EXPERIMENT_CREATE,
  Actions.EXPERIMENT_GET,
  Actions.EXPERIMENT_GET_ALL,
  Actions.EXPERIMENT_RESULTS_GET,
  Actions.EXPERIMENT_UPDATE,
  Actions.EXPERIMENT_DELETE,
  // Insights
  Actions.INSIGHT_QUERY,
  Actions.INSIGHT_GENERATE_HOGQL,
  Actions.INSIGHT_CREATE,
  Actions.INSIGHT_GET,
  Actions.INSIGHT_GET_ALL,
  Actions.INSIGHT_UPDATE,
  Actions.INSIGHT_DELETE,
  // LLM Analytics
  Actions.GET_LLM_COSTS,
  // Organization & Project
  Actions.ORGANIZATIONS_GET,
  Actions.ORGANIZATION_DETAILS_GET,
  Actions.ORGANIZATION_SET_ACTIVE,
  Actions.PROJECTS_GET,
  Actions.PROJECT_SET_ACTIVE,
  // Events & Properties
  Actions.PROPERTY_DEFINITIONS,
  Actions.EVENT_DEFINITIONS,
  // Surveys
  Actions.SURVEY_CREATE,
  Actions.SURVEY_GET,
  Actions.SURVEY_GET_ALL,
  Actions.SURVEY_UPDATE,
  Actions.SURVEY_DELETE,
  Actions.SURVEY_STATS,
  Actions.SURVEY_RESPONSE_COUNTS,
  Actions.SURVEY_GLOBAL_STATS,
]);

// Feature flag filter group schema
const FilterGroupSchema = z.object({
  properties: z.array(z.record(z.unknown())).optional(),
  rollout_percentage: z.number().min(0).max(100).optional(),
});

// Payload schemas per action
export const PayloadSchemas = {
  // ==================== Dashboard ====================
  [Actions.DASHBOARD_CREATE]: z.object({
    name: z.string().describe("Dashboard name"),
    description: z.string().optional().describe("Dashboard description"),
    pinned: z.boolean().optional().describe("Pin to top of list"),
    tags: z.array(z.string()).optional().describe("Tags for organization"),
  }),

  [Actions.DASHBOARD_GET]: z.object({
    dashboardId: z.string().describe("Dashboard ID"),
  }),

  [Actions.DASHBOARD_GET_ALL]: z.object({
    limit: z.number().optional().describe("Max dashboards to return"),
    offset: z.number().optional().describe("Pagination offset"),
    search: z.string().optional().describe("Search by name"),
    pinned: z.boolean().optional().describe("Filter by pinned status"),
  }),

  [Actions.DASHBOARD_UPDATE]: z.object({
    dashboardId: z.string().describe("Dashboard ID to update"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    pinned: z.boolean().optional().describe("Pin status"),
    tags: z.array(z.string()).optional().describe("Tags"),
  }),

  [Actions.DASHBOARD_DELETE]: z.object({
    dashboardId: z.string().describe("Dashboard ID to delete"),
  }),

  [Actions.DASHBOARD_ADD_INSIGHT]: z.object({
    dashboardId: z.string().describe("Dashboard ID"),
    insightId: z.string().describe("Insight ID to add"),
  }),

  // ==================== Documentation ====================
  [Actions.DOCS_SEARCH]: z.object({
    query: z.string().describe("Search query for PostHog documentation"),
  }),

  // ==================== Error Tracking ====================
  [Actions.LIST_ERRORS]: z.object({
    orderBy: z.enum(["occurrences", "first_seen", "last_seen", "users", "sessions"])
      .optional()
      .describe("Sort order"),
    dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
    dateTo: z.string().optional().describe("End date (ISO 8601)"),
    status: z.enum(["active", "resolved", "all", "suppressed"])
      .optional()
      .describe("Filter by status"),
  }),

  [Actions.ERROR_DETAILS]: z.object({
    issueId: z.string().uuid().describe("Error issue UUID"),
    dateFrom: z.string().optional().describe("Start date (ISO 8601)"),
    dateTo: z.string().optional().describe("End date (ISO 8601)"),
  }),

  // ==================== Feature Flags ====================
  [Actions.CREATE_FEATURE_FLAG]: z.object({
    name: z.string().describe("Display name for the flag"),
    key: z.string().describe("Unique flag key (e.g., 'new-checkout-flow')"),
    description: z.string().optional().describe("Flag description"),
    filters: z.object({
      groups: z.array(FilterGroupSchema).optional(),
    }).optional().describe("Targeting filters"),
    active: z.boolean().default(true).describe("Whether flag is active"),
  }),

  [Actions.FEATURE_FLAG_GET]: z.object({
    flagId: z.number().optional().describe("Flag ID (integer)"),
    flagKey: z.string().optional().describe("Flag key (string)"),
  }).refine(data => data.flagId !== undefined || data.flagKey !== undefined, {
    message: "Either flagId or flagKey is required",
  }),

  [Actions.FEATURE_FLAG_GET_ALL]: z.object({}),

  [Actions.UPDATE_FEATURE_FLAG]: z.object({
    flagKey: z.string().describe("Flag key to update"),
    name: z.string().optional().describe("New display name"),
    description: z.string().optional().describe("New description"),
    filters: z.object({
      groups: z.array(FilterGroupSchema).optional(),
    }).optional().describe("Updated targeting filters"),
    active: z.boolean().optional().describe("Enable/disable flag"),
    tags: z.array(z.string()).optional().describe("Tags"),
  }),

  [Actions.DELETE_FEATURE_FLAG]: z.object({
    flagKey: z.string().describe("Flag key to delete"),
  }),

  // ==================== Experiments ====================
  [Actions.EXPERIMENT_CREATE]: z.object({
    name: z.string().describe("Experiment name"),
    feature_flag_key: z.string().describe("Feature flag key for the experiment"),
    type: z.enum(["product", "web"]).optional().describe("Experiment type"),
    description: z.string().optional().describe("Description"),
    primary_metrics: z.array(z.record(z.unknown())).optional().describe("Primary metrics to track"),
    secondary_metrics: z.array(z.record(z.unknown())).optional().describe("Secondary metrics"),
    variants: z.array(z.object({
      key: z.string(),
      name: z.string().optional(),
      rollout_percentage: z.number().optional(),
    })).optional().describe("Experiment variants"),
    minimum_detectable_effect: z.number().optional().describe("MDE threshold"),
    filter_test_accounts: z.boolean().optional().describe("Exclude test accounts"),
    draft: z.boolean().optional().describe("Create as draft"),
  }),

  [Actions.EXPERIMENT_GET]: z.object({
    experimentId: z.string().describe("Experiment ID"),
  }),

  [Actions.EXPERIMENT_GET_ALL]: z.object({}),

  [Actions.EXPERIMENT_RESULTS_GET]: z.object({
    experimentId: z.string().describe("Experiment ID"),
    refresh: z.boolean().default(true).describe("Refresh results from source"),
  }),

  [Actions.EXPERIMENT_UPDATE]: z.object({
    experimentId: z.string().describe("Experiment ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    launch: z.boolean().optional().describe("Launch the experiment"),
    conclude: z.enum(["won", "lost", "inconclusive"]).optional().describe("Conclude experiment"),
    restart: z.boolean().optional().describe("Restart experiment"),
    archive: z.boolean().optional().describe("Archive experiment"),
  }),

  [Actions.EXPERIMENT_DELETE]: z.object({
    experimentId: z.string().describe("Experiment ID to delete"),
  }),

  // ==================== Insights & Analytics ====================
  [Actions.INSIGHT_QUERY]: z.object({
    query: z.record(z.unknown()).describe("Query object (TrendsQuery, FunnelsQuery, or HogQLQuery)"),
  }),

  [Actions.INSIGHT_GENERATE_HOGQL]: z.object({
    question: z.string().max(1000).describe("Natural language question to convert to HogQL"),
  }),

  [Actions.INSIGHT_CREATE]: z.object({
    name: z.string().describe("Insight name"),
    query: z.record(z.unknown()).describe("Query definition"),
    description: z.string().optional().describe("Insight description"),
    favorited: z.boolean().optional().describe("Mark as favorite"),
    tags: z.array(z.string()).optional().describe("Tags"),
  }),

  [Actions.INSIGHT_GET]: z.object({
    insightId: z.string().describe("Insight ID"),
  }),

  [Actions.INSIGHT_GET_ALL]: z.object({
    limit: z.number().optional().describe("Max insights to return"),
    offset: z.number().optional().describe("Pagination offset"),
    favorited: z.boolean().optional().describe("Filter favorites only"),
    search: z.string().optional().describe("Search by name"),
  }),

  [Actions.INSIGHT_UPDATE]: z.object({
    insightId: z.string().describe("Insight ID to update"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    query: z.record(z.unknown()).optional().describe("Updated query"),
    favorited: z.boolean().optional().describe("Favorite status"),
    dashboard: z.string().optional().describe("Move to dashboard"),
    tags: z.array(z.string()).optional().describe("Tags"),
  }),

  [Actions.INSIGHT_DELETE]: z.object({
    insightId: z.string().describe("Insight ID to delete (soft delete)"),
  }),

  // ==================== LLM Analytics ====================
  [Actions.GET_LLM_COSTS]: z.object({
    projectId: z.string().describe("Project ID"),
    days: z.number().optional().describe("Number of days to analyze"),
  }),

  // ==================== Organization & Project ====================
  [Actions.ORGANIZATIONS_GET]: z.object({}),

  [Actions.ORGANIZATION_DETAILS_GET]: z.object({}),

  [Actions.ORGANIZATION_SET_ACTIVE]: z.object({
    orgId: z.string().uuid().describe("Organization UUID"),
  }),

  [Actions.PROJECTS_GET]: z.object({}),

  [Actions.PROJECT_SET_ACTIVE]: z.object({
    projectId: z.number().describe("Project ID (integer)"),
  }),

  // ==================== Events & Properties ====================
  [Actions.PROPERTY_DEFINITIONS]: z.object({
    type: z.enum(["event", "person"]).describe("Property type"),
    eventName: z.string().optional().describe("Event name (required for event type)"),
    includePredefinedProperties: z.boolean().optional().describe("Include predefined properties"),
  }),

  [Actions.EVENT_DEFINITIONS]: z.object({
    q: z.string().optional().describe("Search query"),
  }),

  // ==================== Surveys ====================
  [Actions.SURVEY_CREATE]: z.object({
    name: z.string().describe("Survey name"),
    questions: z.array(z.object({
      type: z.enum(["open", "rating", "single_choice", "multiple_choice", "link"]),
      question: z.string(),
      description: z.string().optional(),
      choices: z.array(z.string()).optional(),
      scale: z.number().optional(),
    })).min(1).describe("Survey questions"),
    type: z.enum(["popover", "api", "widget", "external_survey"]).optional().describe("Survey type"),
    appearance: z.record(z.unknown()).optional().describe("Visual appearance settings"),
    targeting_flag_filters: z.record(z.unknown()).optional().describe("Targeting filters"),
  }),

  [Actions.SURVEY_GET]: z.object({
    surveyId: z.string().describe("Survey ID"),
  }),

  [Actions.SURVEY_GET_ALL]: z.object({
    limit: z.number().optional().describe("Max surveys to return"),
    offset: z.number().optional().describe("Pagination offset"),
    search: z.string().optional().describe("Search by name"),
  }),

  [Actions.SURVEY_UPDATE]: z.object({
    surveyId: z.string().describe("Survey ID to update"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    questions: z.array(z.record(z.unknown())).optional().describe("Updated questions"),
    conditions: z.record(z.unknown()).optional().describe("Display conditions"),
    schedule: z.record(z.unknown()).optional().describe("Schedule settings"),
    targeting: z.record(z.unknown()).optional().describe("Targeting settings"),
  }),

  [Actions.SURVEY_DELETE]: z.object({
    surveyId: z.string().describe("Survey ID to delete"),
  }),

  [Actions.SURVEY_STATS]: z.object({
    survey_id: z.string().describe("Survey ID"),
    date_from: z.string().optional().describe("Start date (ISO 8601)"),
    date_to: z.string().optional().describe("End date (ISO 8601)"),
  }),

  [Actions.SURVEY_RESPONSE_COUNTS]: z.object({}),

  [Actions.SURVEY_GLOBAL_STATS]: z.object({
    date_from: z.string().optional().describe("Start date (ISO 8601)"),
    date_to: z.string().optional().describe("End date (ISO 8601)"),
  }),
} as const;

// Tool input schema
export const ToolInputSchema = z.object({
  action: ActionSchema.describe("Action to perform"),
  payload: z.record(z.unknown()).optional().describe("Action-specific parameters"),
});

export type ToolInput = z.infer<typeof ToolInputSchema>;

// Tool result type (compatible with MCP CallToolResult)
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

// Context for handlers
export interface HandlerContext {
  apiKey: string;
  projectId?: number;
  organizationId?: string;
}
