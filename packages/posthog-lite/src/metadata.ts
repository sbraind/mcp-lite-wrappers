import { Actions } from "./types.js";

export type ActionCategory =
  | "dashboards"
  | "documentation"
  | "errors"
  | "feature_flags"
  | "experiments"
  | "insights"
  | "llm"
  | "organization"
  | "events"
  | "surveys";

export interface ActionMeta {
  description: string;
  category: ActionCategory;
  examples: Array<Record<string, unknown>>;
  commonParams?: string[];
}

export const ActionMetadata: Record<string, ActionMeta> = {
  // ==================== Dashboards ====================
  [Actions.DASHBOARD_CREATE]: {
    description: "Create a new dashboard",
    category: "dashboards",
    examples: [
      { name: "Marketing Overview", description: "Key marketing metrics", pinned: true },
    ],
    commonParams: ["name", "description"],
  },

  [Actions.DASHBOARD_GET]: {
    description: "Get a specific dashboard by ID",
    category: "dashboards",
    examples: [{ dashboardId: "123" }],
    commonParams: ["dashboardId"],
  },

  [Actions.DASHBOARD_GET_ALL]: {
    description: "List all dashboards with optional filtering",
    category: "dashboards",
    examples: [{ limit: 20, pinned: true }],
    commonParams: ["limit", "offset"],
  },

  [Actions.DASHBOARD_UPDATE]: {
    description: "Update dashboard properties",
    category: "dashboards",
    examples: [{ dashboardId: "123", name: "Updated Name", pinned: false }],
    commonParams: ["dashboardId"],
  },

  [Actions.DASHBOARD_DELETE]: {
    description: "Delete a dashboard",
    category: "dashboards",
    examples: [{ dashboardId: "123" }],
    commonParams: ["dashboardId"],
  },

  [Actions.DASHBOARD_ADD_INSIGHT]: {
    description: "Add an insight to a dashboard",
    category: "dashboards",
    examples: [{ dashboardId: "123", insightId: "456" }],
    commonParams: ["dashboardId", "insightId"],
  },

  // ==================== Documentation ====================
  [Actions.DOCS_SEARCH]: {
    description: "Search PostHog documentation",
    category: "documentation",
    examples: [{ query: "how to set up feature flags" }],
    commonParams: ["query"],
  },

  // ==================== Error Tracking ====================
  [Actions.LIST_ERRORS]: {
    description: "List project errors with filtering and sorting",
    category: "errors",
    examples: [
      { orderBy: "last_seen", status: "active" },
      { dateFrom: "2024-01-01", dateTo: "2024-12-31" },
    ],
    commonParams: ["orderBy", "status"],
  },

  [Actions.ERROR_DETAILS]: {
    description: "Get detailed information about a specific error",
    category: "errors",
    examples: [{ issueId: "550e8400-e29b-41d4-a716-446655440000" }],
    commonParams: ["issueId"],
  },

  // ==================== Feature Flags ====================
  [Actions.CREATE_FEATURE_FLAG]: {
    description: "Create a new feature flag with targeting rules",
    category: "feature_flags",
    examples: [
      {
        name: "New Checkout Flow",
        key: "new-checkout-flow",
        filters: { groups: [{ rollout_percentage: 50 }] },
        active: true,
      },
    ],
    commonParams: ["name", "key", "filters"],
  },

  [Actions.FEATURE_FLAG_GET]: {
    description: "Get feature flag definition by ID or key",
    category: "feature_flags",
    examples: [
      { flagKey: "new-checkout-flow" },
      { flagId: 123 },
    ],
    commonParams: ["flagId", "flagKey"],
  },

  [Actions.FEATURE_FLAG_GET_ALL]: {
    description: "List all feature flags",
    category: "feature_flags",
    examples: [{}],
    commonParams: [],
  },

  [Actions.UPDATE_FEATURE_FLAG]: {
    description: "Update an existing feature flag",
    category: "feature_flags",
    examples: [
      { flagKey: "new-checkout-flow", active: false },
      { flagKey: "new-checkout-flow", filters: { groups: [{ rollout_percentage: 100 }] } },
    ],
    commonParams: ["flagKey"],
  },

  [Actions.DELETE_FEATURE_FLAG]: {
    description: "Delete a feature flag",
    category: "feature_flags",
    examples: [{ flagKey: "old-feature" }],
    commonParams: ["flagKey"],
  },

  // ==================== Experiments ====================
  [Actions.EXPERIMENT_CREATE]: {
    description: "Create an A/B experiment",
    category: "experiments",
    examples: [
      {
        name: "Checkout Button Color Test",
        feature_flag_key: "checkout-button-experiment",
        type: "product",
      },
    ],
    commonParams: ["name", "feature_flag_key"],
  },

  [Actions.EXPERIMENT_GET]: {
    description: "Get experiment details by ID",
    category: "experiments",
    examples: [{ experimentId: "123" }],
    commonParams: ["experimentId"],
  },

  [Actions.EXPERIMENT_GET_ALL]: {
    description: "List all experiments",
    category: "experiments",
    examples: [{}],
    commonParams: [],
  },

  [Actions.EXPERIMENT_RESULTS_GET]: {
    description: "Get experiment results with statistical analysis",
    category: "experiments",
    examples: [{ experimentId: "123", refresh: true }],
    commonParams: ["experimentId", "refresh"],
  },

  [Actions.EXPERIMENT_UPDATE]: {
    description: "Update experiment (launch, conclude, archive)",
    category: "experiments",
    examples: [
      { experimentId: "123", launch: true },
      { experimentId: "123", conclude: "won" },
    ],
    commonParams: ["experimentId"],
  },

  [Actions.EXPERIMENT_DELETE]: {
    description: "Delete an experiment",
    category: "experiments",
    examples: [{ experimentId: "123" }],
    commonParams: ["experimentId"],
  },

  // ==================== Insights & Analytics ====================
  [Actions.INSIGHT_QUERY]: {
    description: "Run analytics queries (Trends, Funnels, HogQL)",
    category: "insights",
    examples: [
      {
        query: {
          kind: "TrendsQuery",
          series: [{ event: "$pageview" }],
          dateRange: { date_from: "-7d" },
        },
      },
    ],
    commonParams: ["query"],
  },

  [Actions.INSIGHT_GENERATE_HOGQL]: {
    description: "Generate HogQL from natural language",
    category: "insights",
    examples: [
      { question: "How many users signed up last week?" },
      { question: "Show me the top 10 pages by pageviews" },
    ],
    commonParams: ["question"],
  },

  [Actions.INSIGHT_CREATE]: {
    description: "Save a query as a reusable insight",
    category: "insights",
    examples: [
      {
        name: "Weekly Active Users",
        query: { kind: "TrendsQuery", series: [{ event: "$pageview" }] },
      },
    ],
    commonParams: ["name", "query"],
  },

  [Actions.INSIGHT_GET]: {
    description: "Get a specific insight by ID",
    category: "insights",
    examples: [{ insightId: "123" }],
    commonParams: ["insightId"],
  },

  [Actions.INSIGHT_GET_ALL]: {
    description: "List all insights with filtering",
    category: "insights",
    examples: [
      { limit: 20, favorited: true },
      { search: "users" },
    ],
    commonParams: ["limit", "offset"],
  },

  [Actions.INSIGHT_UPDATE]: {
    description: "Update an existing insight",
    category: "insights",
    examples: [{ insightId: "123", name: "Updated Insight", favorited: true }],
    commonParams: ["insightId"],
  },

  [Actions.INSIGHT_DELETE]: {
    description: "Delete an insight (soft delete)",
    category: "insights",
    examples: [{ insightId: "123" }],
    commonParams: ["insightId"],
  },

  // ==================== LLM Analytics ====================
  [Actions.GET_LLM_COSTS]: {
    description: "Get LLM usage costs by model",
    category: "llm",
    examples: [{ projectId: "123", days: 30 }],
    commonParams: ["projectId", "days"],
  },

  // ==================== Organization & Project ====================
  [Actions.ORGANIZATIONS_GET]: {
    description: "List accessible organizations",
    category: "organization",
    examples: [{}],
    commonParams: [],
  },

  [Actions.ORGANIZATION_DETAILS_GET]: {
    description: "Get active organization details",
    category: "organization",
    examples: [{}],
    commonParams: [],
  },

  [Actions.ORGANIZATION_SET_ACTIVE]: {
    description: "Set the active organization",
    category: "organization",
    examples: [{ orgId: "550e8400-e29b-41d4-a716-446655440000" }],
    commonParams: ["orgId"],
  },

  [Actions.PROJECTS_GET]: {
    description: "List accessible projects",
    category: "organization",
    examples: [{}],
    commonParams: [],
  },

  [Actions.PROJECT_SET_ACTIVE]: {
    description: "Set the active project",
    category: "organization",
    examples: [{ projectId: 12345 }],
    commonParams: ["projectId"],
  },

  // ==================== Events & Properties ====================
  [Actions.PROPERTY_DEFINITIONS]: {
    description: "Get property definitions for events or persons",
    category: "events",
    examples: [
      { type: "event", eventName: "$pageview" },
      { type: "person", includePredefinedProperties: true },
    ],
    commonParams: ["type", "eventName"],
  },

  [Actions.EVENT_DEFINITIONS]: {
    description: "List event definitions",
    category: "events",
    examples: [
      {},
      { q: "signup" },
    ],
    commonParams: ["q"],
  },

  // ==================== Surveys ====================
  [Actions.SURVEY_CREATE]: {
    description: "Create a new survey",
    category: "surveys",
    examples: [
      {
        name: "NPS Survey",
        questions: [
          { type: "rating", question: "How likely are you to recommend us?", scale: 10 },
        ],
        type: "popover",
      },
    ],
    commonParams: ["name", "questions"],
  },

  [Actions.SURVEY_GET]: {
    description: "Get a specific survey by ID",
    category: "surveys",
    examples: [{ surveyId: "123" }],
    commonParams: ["surveyId"],
  },

  [Actions.SURVEY_GET_ALL]: {
    description: "List all surveys",
    category: "surveys",
    examples: [{ limit: 20 }],
    commonParams: ["limit", "offset"],
  },

  [Actions.SURVEY_UPDATE]: {
    description: "Update a survey",
    category: "surveys",
    examples: [{ surveyId: "123", name: "Updated Survey" }],
    commonParams: ["surveyId"],
  },

  [Actions.SURVEY_DELETE]: {
    description: "Delete a survey",
    category: "surveys",
    examples: [{ surveyId: "123" }],
    commonParams: ["surveyId"],
  },

  [Actions.SURVEY_STATS]: {
    description: "Get survey response statistics",
    category: "surveys",
    examples: [{ survey_id: "123" }],
    commonParams: ["survey_id"],
  },

  [Actions.SURVEY_RESPONSE_COUNTS]: {
    description: "Get response counts for all surveys",
    category: "surveys",
    examples: [{}],
    commonParams: [],
  },

  [Actions.SURVEY_GLOBAL_STATS]: {
    description: "Get global survey aggregations",
    category: "surveys",
    examples: [{ date_from: "2024-01-01" }],
    commonParams: ["date_from", "date_to"],
  },
};

// Top actions for discriminated union (most commonly used)
export const TopActions = [
  Actions.INSIGHT_QUERY,
  Actions.INSIGHT_GENERATE_HOGQL,
  Actions.CREATE_FEATURE_FLAG,
  Actions.UPDATE_FEATURE_FLAG,
  Actions.EXPERIMENT_CREATE,
  Actions.EXPERIMENT_RESULTS_GET,
  Actions.LIST_ERRORS,
  Actions.SURVEY_CREATE,
] as const;

// Category display order
export const CategoryOrder: ActionCategory[] = [
  "insights",
  "feature_flags",
  "experiments",
  "dashboards",
  "surveys",
  "errors",
  "events",
  "organization",
  "llm",
  "documentation",
];
