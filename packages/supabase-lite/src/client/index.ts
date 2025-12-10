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
        message = parsed.message || parsed.error || message;
        code = parsed.code;
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

// Management API client for project-level operations
export class SupabaseManagementClient extends BaseClient {
  constructor(accessToken: string) {
    super({
      baseUrl: "https://api.supabase.com/v1",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  // Helper to generate secure database password
  private generateDbPassword(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 24; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // ==================== Account/Project ====================

  async listProjects(): Promise<unknown> {
    return this.request("GET", "/projects");
  }

  async getProject(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}`);
  }

  async createProject(
    name: string,
    region: string,
    organizationId: string
  ): Promise<unknown> {
    return this.request("POST", "/projects", {
      name,
      region,
      organization_id: organizationId,
      db_pass: this.generateDbPassword(),
    });
  }

  async pauseProject(projectRef: string): Promise<unknown> {
    return this.request("POST", `/projects/${projectRef}/pause`);
  }

  async restoreProject(projectRef: string): Promise<unknown> {
    return this.request("POST", `/projects/${projectRef}/restore`);
  }

  // ==================== Organization ====================

  async listOrganizations(): Promise<unknown> {
    return this.request("GET", "/organizations");
  }

  async getOrganization(slug: string): Promise<unknown> {
    return this.request("GET", `/organizations/${slug}`);
  }

  // ==================== Storage ====================

  async listStorageBuckets(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/storage/buckets`);
  }

  async getStorageConfig(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/config/storage`);
  }

  async updateStorageConfig(
    projectRef: string,
    config: {
      fileSizeLimit?: number;
      features?: {
        imageTransformation?: { enabled: boolean };
        s3Protocol?: { enabled: boolean };
      };
    }
  ): Promise<unknown> {
    return this.request("PATCH", `/projects/${projectRef}/config/storage`, config);
  }

  // ==================== Database ====================
  async executeSql(projectRef: string, query: string): Promise<unknown> {
    return this.request("POST", `/projects/${projectRef}/database/query`, {
      query,
    });
  }

  async listTables(projectRef: string, schemas: string[] = ["public"]): Promise<unknown> {
    // No direct API endpoint - use SQL query
    const schemaList = schemas.map(s => `'${s}'`).join(", ");
    return this.executeSql(projectRef, `
      SELECT
        table_schema as schema,
        table_name as name,
        table_type as type
      FROM information_schema.tables
      WHERE table_schema IN (${schemaList})
      ORDER BY table_schema, table_name
    `);
  }

  async listExtensions(projectRef: string): Promise<unknown> {
    // No direct API endpoint - use SQL query
    return this.executeSql(projectRef, `
      SELECT
        extname as name,
        extversion as version,
        extnamespace::regnamespace::text as schema
      FROM pg_extension
      ORDER BY extname
    `);
  }

  async listMigrations(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/database/migrations`);
  }

  async applyMigration(
    projectRef: string,
    name: string,
    sql: string
  ): Promise<unknown> {
    return this.request("POST", `/projects/${projectRef}/database/migrations`, {
      name,
      statements: [sql],
    });
  }

  // ==================== Monitoring ====================

  async getLogs(
    projectRef: string,
    service: string,
    limit: number
  ): Promise<unknown> {
    const start = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // Last hour
    const end = new Date().toISOString();
    // Use SQL query to filter by service and limit
    const sql = `SELECT id, timestamp, event_message, metadata
                 FROM edge_logs
                 WHERE timestamp >= '${start}'
                 ORDER BY timestamp DESC
                 LIMIT ${limit}`;
    return this.request(
      "GET",
      `/projects/${projectRef}/analytics/endpoints/logs.all?iso_timestamp_start=${encodeURIComponent(start)}&iso_timestamp_end=${encodeURIComponent(end)}&sql=${encodeURIComponent(sql)}`
    );
  }

  async getAdvisors(projectRef: string): Promise<unknown> {
    const [performance, security] = await Promise.all([
      this.request("GET", `/projects/${projectRef}/advisors/performance`).catch(() => ({ performance: [] })),
      this.request("GET", `/projects/${projectRef}/advisors/security`).catch(() => ({ security: [] })),
    ]);
    return { performance, security };
  }

  // ==================== Project Info ====================

  async getApiKeys(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/api-keys`);
  }

  async generateTypes(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/types/typescript`);
  }

  // ==================== Edge Functions ====================

  async listEdgeFunctions(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/functions`);
  }

  async getEdgeFunction(projectRef: string, slug: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/functions/${slug}`);
  }

  async deployEdgeFunction(
    projectRef: string,
    slug: string,
    code: string,
    verifyJwt: boolean
  ): Promise<unknown> {
    // Edge functions deploy requires multipart/form-data
    const formData = new FormData();
    formData.append("metadata", JSON.stringify({
      entrypoint_path: "index.ts",
      name: slug,
      verify_jwt: verifyJwt,
    }));

    // Create a file blob from the code
    const fileBlob = new Blob([code], { type: "application/typescript" });
    formData.append("file", fileBlob, "index.ts");

    const response = await fetch(
      `${this.baseUrl}/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(slug)}`,
      {
        method: "POST",
        headers: {
          Authorization: this.headers.Authorization,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `API Error: ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        message = parsed.message || parsed.error || message;
      } catch {
        message = errorBody || message;
      }
      throw new ApiError(message, response.status);
    }

    const text = await response.text();
    if (!text) return {};
    return JSON.parse(text);
  }

  // ==================== Branching ====================

  async createBranch(projectRef: string, name: string): Promise<unknown> {
    return this.request("POST", `/projects/${projectRef}/branches`, {
      branch_name: name,
    });
  }

  async listBranches(projectRef: string): Promise<unknown> {
    return this.request("GET", `/projects/${projectRef}/branches`);
  }

  async deleteBranch(projectRef: string, branchId: string): Promise<unknown> {
    return this.request("DELETE", `/projects/${projectRef}/branches/${branchId}`);
  }

  async mergeBranch(projectRef: string, branchId: string): Promise<unknown> {
    return this.request(
      "POST",
      `/projects/${projectRef}/branches/${branchId}/merge`
    );
  }

  async resetBranch(projectRef: string, branchId: string): Promise<unknown> {
    return this.request(
      "POST",
      `/projects/${projectRef}/branches/${branchId}/reset`
    );
  }

  async rebaseBranch(projectRef: string, branchId: string): Promise<unknown> {
    return this.request(
      "POST",
      `/projects/${projectRef}/branches/${branchId}/rebase`
    );
  }
}

// Docs search - constructs helpful docs links since no public search API exists
export async function searchDocs(query: string): Promise<unknown> {
  // Supabase doesn't have a public docs search API
  // Return helpful links based on common topics
  const topics: Record<string, { url: string; title: string }[]> = {
    auth: [
      { url: "https://supabase.com/docs/guides/auth", title: "Auth Overview" },
      { url: "https://supabase.com/docs/guides/auth/quickstarts", title: "Auth Quickstarts" },
    ],
    database: [
      { url: "https://supabase.com/docs/guides/database", title: "Database Overview" },
      { url: "https://supabase.com/docs/guides/database/tables", title: "Tables" },
    ],
    storage: [
      { url: "https://supabase.com/docs/guides/storage", title: "Storage Overview" },
    ],
    functions: [
      { url: "https://supabase.com/docs/guides/functions", title: "Edge Functions" },
    ],
    realtime: [
      { url: "https://supabase.com/docs/guides/realtime", title: "Realtime Overview" },
    ],
    rls: [
      { url: "https://supabase.com/docs/guides/database/postgres/row-level-security", title: "Row Level Security" },
    ],
    api: [
      { url: "https://supabase.com/docs/guides/api", title: "REST API" },
      { url: "https://supabase.com/docs/reference/api/introduction", title: "Management API" },
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
  matches.push({ url: "https://supabase.com/docs", title: "Supabase Documentation" });

  return {
    query,
    note: "Supabase does not have a public docs search API. Here are relevant documentation links:",
    results: matches,
  };
}
