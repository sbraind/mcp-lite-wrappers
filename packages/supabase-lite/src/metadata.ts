import { Actions } from "./types.js";

export type ActionCategory = "database" | "functions" | "project" | "storage" | "monitoring" | "organization" | "branching";

export interface ActionMeta {
  description: string;
  category: ActionCategory;
  examples: Array<Record<string, unknown>>;
  commonParams?: string[];
}

export const ActionMetadata: Record<string, ActionMeta> = {
  // ==================== Database ====================
  [Actions.EXECUTE_SQL]: {
    description: "Execute SQL queries against the database",
    category: "database",
    examples: [
      { query: "SELECT * FROM users WHERE active = true LIMIT 10" },
      { query: "INSERT INTO logs (message, level) VALUES ('test', 'info')" },
    ],
    commonParams: ["query", "project_id"],
  },

  [Actions.LIST_TABLES]: {
    description: "List tables in specified schemas",
    category: "database",
    examples: [
      { schemas: ["public"] },
      { schemas: ["public", "auth"] },
    ],
    commonParams: ["schemas"],
  },

  [Actions.LIST_EXTENSIONS]: {
    description: "List installed PostgreSQL extensions",
    category: "database",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.LIST_MIGRATIONS]: {
    description: "List applied database migrations",
    category: "database",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.APPLY_MIGRATION]: {
    description: "Apply a new database migration",
    category: "database",
    examples: [
      { name: "add_users_table", sql: "CREATE TABLE users (id uuid PRIMARY KEY)" },
    ],
    commonParams: ["name", "sql"],
  },

  // ==================== Functions ====================
  [Actions.LIST_EDGE_FUNCTIONS]: {
    description: "List all edge functions in the project",
    category: "functions",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.GET_EDGE_FUNCTION]: {
    description: "Get details of a specific edge function",
    category: "functions",
    examples: [{ slug: "my-function" }],
    commonParams: ["slug"],
  },

  [Actions.DEPLOY_EDGE_FUNCTION]: {
    description: "Deploy or update an edge function",
    category: "functions",
    examples: [
      { slug: "hello-world", code: "Deno.serve(() => new Response('Hello!'))", verify_jwt: true },
    ],
    commonParams: ["slug", "code", "verify_jwt"],
  },

  // ==================== Project ====================
  [Actions.LIST_PROJECTS]: {
    description: "List all projects in your account",
    category: "project",
    examples: [{}],
    commonParams: [],
  },

  [Actions.GET_PROJECT]: {
    description: "Get details of a specific project",
    category: "project",
    examples: [{ id: "project-ref-id" }],
    commonParams: ["id"],
  },

  [Actions.CREATE_PROJECT]: {
    description: "Create a new Supabase project",
    category: "project",
    examples: [
      { name: "my-app", region: "us-east-1", organization_id: "org-id", confirm_cost_id: "cost-id" },
    ],
    commonParams: ["name", "region", "organization_id"],
  },

  [Actions.PAUSE_PROJECT]: {
    description: "Pause a project to save resources",
    category: "project",
    examples: [{ project_id: "project-ref-id" }],
    commonParams: ["project_id"],
  },

  [Actions.RESTORE_PROJECT]: {
    description: "Restore a paused project",
    category: "project",
    examples: [{ project_id: "project-ref-id" }],
    commonParams: ["project_id"],
  },

  [Actions.GET_PROJECT_URL]: {
    description: "Get the API URL for a project",
    category: "project",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.GET_PUBLISHABLE_KEYS]: {
    description: "Get anon and service role keys",
    category: "project",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.GENERATE_TYPESCRIPT_TYPES]: {
    description: "Generate TypeScript types from database schema",
    category: "project",
    examples: [{}],
    commonParams: ["project_id"],
  },

  // ==================== Organization ====================
  [Actions.LIST_ORGANIZATIONS]: {
    description: "List all organizations",
    category: "organization",
    examples: [{}],
    commonParams: [],
  },

  [Actions.GET_ORGANIZATION]: {
    description: "Get organization details",
    category: "organization",
    examples: [{ id: "org-id-or-slug" }],
    commonParams: ["id"],
  },

  [Actions.GET_COST]: {
    description: "Get cost information for a resource",
    category: "organization",
    examples: [{ type: "project", organization_id: "org-id" }],
    commonParams: ["type", "organization_id"],
  },

  [Actions.CONFIRM_COST]: {
    description: "Confirm cost before creating resources",
    category: "organization",
    examples: [{ type: "project", recurrence: "monthly", amount: 25 }],
    commonParams: ["type", "recurrence", "amount"],
  },

  // ==================== Monitoring ====================
  [Actions.GET_LOGS]: {
    description: "Get logs from a specific service",
    category: "monitoring",
    examples: [
      { service: "postgres", limit: 100 },
      { service: "edge_functions", limit: 50 },
    ],
    commonParams: ["service", "limit"],
  },

  [Actions.GET_ADVISORS]: {
    description: "Get performance and security recommendations",
    category: "monitoring",
    examples: [{}],
    commonParams: ["project_id"],
  },

  // ==================== Branching ====================
  [Actions.CREATE_BRANCH]: {
    description: "Create a database branch for testing",
    category: "branching",
    examples: [{ name: "feature-branch" }],
    commonParams: ["name"],
  },

  [Actions.LIST_BRANCHES]: {
    description: "List all database branches",
    category: "branching",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.DELETE_BRANCH]: {
    description: "Delete a database branch",
    category: "branching",
    examples: [{ branch_id: "branch-uuid" }],
    commonParams: ["branch_id"],
  },

  [Actions.MERGE_BRANCH]: {
    description: "Merge a branch into production",
    category: "branching",
    examples: [{ branch_id: "branch-uuid" }],
    commonParams: ["branch_id"],
  },

  [Actions.RESET_BRANCH]: {
    description: "Reset branch to match production",
    category: "branching",
    examples: [{ branch_id: "branch-uuid" }],
    commonParams: ["branch_id"],
  },

  [Actions.REBASE_BRANCH]: {
    description: "Rebase branch with latest production changes",
    category: "branching",
    examples: [{ branch_id: "branch-uuid" }],
    commonParams: ["branch_id"],
  },

  // ==================== Storage ====================
  [Actions.LIST_STORAGE_BUCKETS]: {
    description: "List all storage buckets",
    category: "storage",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.GET_STORAGE_CONFIG]: {
    description: "Get storage configuration settings",
    category: "storage",
    examples: [{}],
    commonParams: ["project_id"],
  },

  [Actions.UPDATE_STORAGE_CONFIG]: {
    description: "Update storage configuration",
    category: "storage",
    examples: [
      { config: { fileSizeLimit: 52428800, features: { imageTransformation: { enabled: true } } } },
    ],
    commonParams: ["config"],
  },

  // ==================== Docs ====================
  [Actions.SEARCH_DOCS]: {
    description: "Search Supabase documentation",
    category: "project", // grouped with project for simplicity
    examples: [{ query: "how to use RLS policies" }],
    commonParams: ["query"],
  },
};

// Top actions for discriminated union (most commonly used)
export const TopActions = [
  Actions.EXECUTE_SQL,
  Actions.LIST_TABLES,
  Actions.GET_LOGS,
  Actions.LIST_PROJECTS,
  Actions.DEPLOY_EDGE_FUNCTION,
  Actions.LIST_EDGE_FUNCTIONS,
  Actions.APPLY_MIGRATION,
  Actions.GET_PROJECT,
] as const;

// Category display order
export const CategoryOrder: ActionCategory[] = [
  "database",
  "functions",
  "project",
  "monitoring",
  "storage",
  "branching",
  "organization",
];
