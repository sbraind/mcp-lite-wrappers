export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ClientConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

abstract class BaseClient {
  protected baseUrl: string;
  protected headers: Record<string, string>;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };
  }

  protected async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `API Error: ${response.status}`;
      let code: string | undefined;

      try {
        const parsed = JSON.parse(errorBody);
        message = parsed.detail || parsed.message || parsed.error || message;
        code = parsed.code || parsed.type;
      } catch {
        message = errorBody || message;
      }

      throw new ApiError(message, response.status, code);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }
}

// PostHog API Client
export class PostHogClient extends BaseClient {
  private projectId?: number;
  private organizationId?: string;

  constructor(apiKey: string, host: string = "https://app.posthog.com") {
    super({
      baseUrl: host,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  }

  setProjectId(projectId: number): void {
    this.projectId = projectId;
  }

  setOrganizationId(organizationId: string): void {
    this.organizationId = organizationId;
  }

  private getProjectPath(): string {
    if (!this.projectId) {
      throw new Error("Project ID not set. Use project_set_active first or set POSTHOG_PROJECT_ID.");
    }
    return `/api/projects/${this.projectId}`;
  }

  // ==================== Dashboards ====================

  async createDashboard(data: {
    name: string;
    description?: string;
    pinned?: boolean;
    tags?: string[];
  }): Promise<unknown> {
    return this.request("POST", `${this.getProjectPath()}/dashboards/`, data);
  }

  async getDashboard(dashboardId: string): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/dashboards/${dashboardId}/`);
  }

  async getDashboards(params: {
    limit?: number;
    offset?: number;
    search?: string;
    pinned?: boolean;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    if (params.search) query.set("search", params.search);
    if (params.pinned !== undefined) query.set("pinned", String(params.pinned));
    const qs = query.toString();
    return this.request("GET", `${this.getProjectPath()}/dashboards/${qs ? `?${qs}` : ""}`);
  }

  async updateDashboard(
    dashboardId: string,
    data: {
      name?: string;
      description?: string;
      pinned?: boolean;
      tags?: string[];
    }
  ): Promise<unknown> {
    return this.request("PATCH", `${this.getProjectPath()}/dashboards/${dashboardId}/`, data);
  }

  async deleteDashboard(dashboardId: string): Promise<unknown> {
    return this.request("DELETE", `${this.getProjectPath()}/dashboards/${dashboardId}/`);
  }

  async addInsightToDashboard(dashboardId: string, insightId: string): Promise<unknown> {
    return this.request("PATCH", `${this.getProjectPath()}/insights/${insightId}/`, {
      dashboards: [parseInt(dashboardId, 10)],
    });
  }

  // ==================== Error Tracking ====================

  async listErrors(params: {
    orderBy?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.orderBy) query.set("order_by", params.orderBy);
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    if (params.status) query.set("status", params.status);
    const qs = query.toString();
    return this.request("GET", `${this.getProjectPath()}/error_tracking/issues/${qs ? `?${qs}` : ""}`);
  }

  async getErrorDetails(issueId: string, params: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    const qs = query.toString();
    return this.request("GET", `${this.getProjectPath()}/error_tracking/issues/${issueId}/${qs ? `?${qs}` : ""}`);
  }

  // ==================== Feature Flags ====================

  async createFeatureFlag(data: {
    name: string;
    key: string;
    description?: string;
    filters?: { groups?: Array<Record<string, unknown>> };
    active?: boolean;
  }): Promise<unknown> {
    return this.request("POST", `${this.getProjectPath()}/feature_flags/`, data);
  }

  async getFeatureFlag(params: { flagId?: number; flagKey?: string }): Promise<unknown> {
    if (params.flagId) {
      return this.request("GET", `${this.getProjectPath()}/feature_flags/${params.flagId}/`);
    }
    // Search by key
    const flags = await this.request<{ results: Array<{ key: string }> }>(
      "GET",
      `${this.getProjectPath()}/feature_flags/?search=${encodeURIComponent(params.flagKey || "")}`
    );
    const flag = flags.results?.find(f => f.key === params.flagKey);
    if (!flag) throw new ApiError(`Feature flag "${params.flagKey}" not found`, 404);
    return flag;
  }

  async getFeatureFlags(): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/feature_flags/`);
  }

  async updateFeatureFlag(
    flagKey: string,
    data: {
      name?: string;
      description?: string;
      filters?: { groups?: Array<Record<string, unknown>> };
      active?: boolean;
      tags?: string[];
    }
  ): Promise<unknown> {
    // First find the flag by key
    const flags = await this.request<{ results: Array<{ id: number; key: string }> }>(
      "GET",
      `${this.getProjectPath()}/feature_flags/?search=${encodeURIComponent(flagKey)}`
    );
    const flag = flags.results?.find(f => f.key === flagKey);
    if (!flag) throw new ApiError(`Feature flag "${flagKey}" not found`, 404);
    return this.request("PATCH", `${this.getProjectPath()}/feature_flags/${flag.id}/`, data);
  }

  async deleteFeatureFlag(flagKey: string): Promise<unknown> {
    const flags = await this.request<{ results: Array<{ id: number; key: string }> }>(
      "GET",
      `${this.getProjectPath()}/feature_flags/?search=${encodeURIComponent(flagKey)}`
    );
    const flag = flags.results?.find(f => f.key === flagKey);
    if (!flag) throw new ApiError(`Feature flag "${flagKey}" not found`, 404);
    return this.request("DELETE", `${this.getProjectPath()}/feature_flags/${flag.id}/`);
  }

  // ==================== Experiments ====================

  async createExperiment(data: {
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
  }): Promise<unknown> {
    return this.request("POST", `${this.getProjectPath()}/experiments/`, data);
  }

  async getExperiment(experimentId: string): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/experiments/${experimentId}/`);
  }

  async getExperiments(): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/experiments/`);
  }

  async getExperimentResults(experimentId: string, refresh: boolean): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/experiments/${experimentId}/results/?refresh=${refresh}`);
  }

  async updateExperiment(
    experimentId: string,
    data: {
      name?: string;
      description?: string;
      launch?: boolean;
      conclude?: string;
      restart?: boolean;
      archive?: boolean;
    }
  ): Promise<unknown> {
    // Handle special actions
    if (data.launch) {
      return this.request("POST", `${this.getProjectPath()}/experiments/${experimentId}/launch/`);
    }
    if (data.conclude) {
      return this.request("POST", `${this.getProjectPath()}/experiments/${experimentId}/conclude/`, {
        end_date: new Date().toISOString(),
        winner_variant: data.conclude === "won" ? "control" : undefined,
      });
    }
    if (data.restart) {
      return this.request("POST", `${this.getProjectPath()}/experiments/${experimentId}/restart/`);
    }
    if (data.archive) {
      return this.request("PATCH", `${this.getProjectPath()}/experiments/${experimentId}/`, { archived: true });
    }
    // Regular update
    return this.request("PATCH", `${this.getProjectPath()}/experiments/${experimentId}/`, data);
  }

  async deleteExperiment(experimentId: string): Promise<unknown> {
    return this.request("DELETE", `${this.getProjectPath()}/experiments/${experimentId}/`);
  }

  // ==================== Insights & Analytics ====================

  async queryInsight(query: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", `${this.getProjectPath()}/query/`, { query });
  }

  async generateHogQL(question: string): Promise<unknown> {
    return this.request("POST", `${this.getProjectPath()}/query/`, {
      query: {
        kind: "HogQLAutocomplete",
        prompt: question,
      },
    });
  }

  async createInsight(data: {
    name: string;
    query: Record<string, unknown>;
    description?: string;
    favorited?: boolean;
    tags?: string[];
  }): Promise<unknown> {
    return this.request("POST", `${this.getProjectPath()}/insights/`, data);
  }

  async getInsight(insightId: string): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/insights/${insightId}/`);
  }

  async getInsights(params: {
    limit?: number;
    offset?: number;
    favorited?: boolean;
    search?: string;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    if (params.favorited !== undefined) query.set("favorited", String(params.favorited));
    if (params.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request("GET", `${this.getProjectPath()}/insights/${qs ? `?${qs}` : ""}`);
  }

  async updateInsight(
    insightId: string,
    data: {
      name?: string;
      description?: string;
      query?: Record<string, unknown>;
      favorited?: boolean;
      dashboard?: string;
      tags?: string[];
    }
  ): Promise<unknown> {
    const updateData: Record<string, unknown> = { ...data };
    if (data.dashboard) {
      updateData.dashboards = [parseInt(data.dashboard, 10)];
      delete updateData.dashboard;
    }
    return this.request("PATCH", `${this.getProjectPath()}/insights/${insightId}/`, updateData);
  }

  async deleteInsight(insightId: string): Promise<unknown> {
    return this.request("PATCH", `${this.getProjectPath()}/insights/${insightId}/`, { deleted: true });
  }

  // ==================== LLM Analytics ====================

  async getLLMCosts(projectId: string, days?: number): Promise<unknown> {
    const query = days ? `?days=${days}` : "";
    return this.request("GET", `/api/projects/${projectId}/llm_costs/${query}`);
  }

  // ==================== Organization & Project ====================

  async getOrganizations(): Promise<unknown> {
    return this.request("GET", "/api/organizations/");
  }

  async getOrganizationDetails(): Promise<unknown> {
    if (!this.organizationId) {
      // Return first org if not set
      const orgs = await this.request<{ results: Array<{ id: string }> }>("GET", "/api/organizations/");
      if (orgs.results?.[0]) {
        return orgs.results[0];
      }
      throw new Error("No organizations found");
    }
    return this.request("GET", `/api/organizations/${this.organizationId}/`);
  }

  async getProjects(): Promise<unknown> {
    return this.request("GET", "/api/projects/");
  }

  // ==================== Events & Properties ====================

  async getPropertyDefinitions(params: {
    type: string;
    eventName?: string;
    includePredefinedProperties?: boolean;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    query.set("type", params.type);
    if (params.eventName) query.set("event_name", params.eventName);
    if (params.includePredefinedProperties !== undefined) {
      query.set("include_predefined_properties", String(params.includePredefinedProperties));
    }
    return this.request("GET", `${this.getProjectPath()}/property_definitions/?${query.toString()}`);
  }

  async getEventDefinitions(q?: string): Promise<unknown> {
    const query = q ? `?search=${encodeURIComponent(q)}` : "";
    return this.request("GET", `${this.getProjectPath()}/event_definitions/${query}`);
  }

  // ==================== Surveys ====================

  async createSurvey(data: {
    name: string;
    questions: Array<Record<string, unknown>>;
    type?: string;
    appearance?: Record<string, unknown>;
    targeting_flag_filters?: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request("POST", `${this.getProjectPath()}/surveys/`, data);
  }

  async getSurvey(surveyId: string): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/surveys/${surveyId}/`);
  }

  async getSurveys(params: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    if (params.search) query.set("search", params.search);
    const qs = query.toString();
    return this.request("GET", `${this.getProjectPath()}/surveys/${qs ? `?${qs}` : ""}`);
  }

  async updateSurvey(
    surveyId: string,
    data: {
      name?: string;
      description?: string;
      questions?: Array<Record<string, unknown>>;
      conditions?: Record<string, unknown>;
      schedule?: Record<string, unknown>;
      targeting?: Record<string, unknown>;
    }
  ): Promise<unknown> {
    return this.request("PATCH", `${this.getProjectPath()}/surveys/${surveyId}/`, data);
  }

  async deleteSurvey(surveyId: string): Promise<unknown> {
    return this.request("DELETE", `${this.getProjectPath()}/surveys/${surveyId}/`);
  }

  async getSurveyStats(surveyId: string, params: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    const qs = query.toString();
    return this.request("GET", `${this.getProjectPath()}/surveys/${surveyId}/stats/${qs ? `?${qs}` : ""}`);
  }

  async getSurveyResponseCounts(): Promise<unknown> {
    return this.request("GET", `${this.getProjectPath()}/surveys/response_counts/`);
  }

  async getSurveyGlobalStats(params: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<unknown> {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    const qs = query.toString();
    return this.request("GET", `${this.getProjectPath()}/surveys/stats/${qs ? `?${qs}` : ""}`);
  }
}

// Docs search - constructs helpful docs links
export async function searchDocs(query: string): Promise<unknown> {
  const topics: Record<string, { url: string; title: string }[]> = {
    "feature flag": [
      { url: "https://posthog.com/docs/feature-flags", title: "Feature Flags Overview" },
      { url: "https://posthog.com/docs/feature-flags/creating-feature-flags", title: "Creating Feature Flags" },
    ],
    experiment: [
      { url: "https://posthog.com/docs/experiments", title: "Experiments Overview" },
      { url: "https://posthog.com/docs/experiments/creating-an-experiment", title: "Creating Experiments" },
    ],
    analytics: [
      { url: "https://posthog.com/docs/product-analytics", title: "Product Analytics" },
      { url: "https://posthog.com/docs/hogql", title: "HogQL Reference" },
    ],
    survey: [
      { url: "https://posthog.com/docs/surveys", title: "Surveys Overview" },
      { url: "https://posthog.com/docs/surveys/creating-surveys", title: "Creating Surveys" },
    ],
    insight: [
      { url: "https://posthog.com/docs/product-analytics/insights", title: "Insights Overview" },
      { url: "https://posthog.com/docs/product-analytics/trends", title: "Trends" },
      { url: "https://posthog.com/docs/product-analytics/funnels", title: "Funnels" },
    ],
    api: [
      { url: "https://posthog.com/docs/api", title: "API Overview" },
      { url: "https://posthog.com/docs/api/capture", title: "Capture API" },
    ],
    error: [
      { url: "https://posthog.com/docs/error-tracking", title: "Error Tracking" },
    ],
    dashboard: [
      { url: "https://posthog.com/docs/product-analytics/dashboards", title: "Dashboards" },
    ],
    hogql: [
      { url: "https://posthog.com/docs/hogql", title: "HogQL Reference" },
      { url: "https://posthog.com/docs/hogql/expressions", title: "HogQL Expressions" },
    ],
  };

  const lowerQuery = query.toLowerCase();
  const matches: { url: string; title: string }[] = [];

  for (const [key, links] of Object.entries(topics)) {
    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
      matches.push(...links);
    }
  }

  // Always include main docs link
  matches.push({ url: "https://posthog.com/docs", title: "PostHog Documentation" });

  return {
    query,
    note: "Here are relevant PostHog documentation links:",
    results: matches,
  };
}
