import { z } from "zod";

// Action constants
export const Actions = {
  // Account/Project operations
  LIST_PROJECTS: "list_projects",
  GET_PROJECT: "get_project",
  CREATE_PROJECT: "create_project",
  PAUSE_PROJECT: "pause_project",
  RESTORE_PROJECT: "restore_project",

  // Organization operations
  LIST_ORGANIZATIONS: "list_organizations",
  GET_ORGANIZATION: "get_organization",

  // Cost operations
  GET_COST: "get_cost",
  CONFIRM_COST: "confirm_cost",

  // Database operations
  EXECUTE_SQL: "execute_sql",
  LIST_TABLES: "list_tables",
  LIST_EXTENSIONS: "list_extensions",
  LIST_MIGRATIONS: "list_migrations",
  APPLY_MIGRATION: "apply_migration",

  // Monitoring
  GET_LOGS: "get_logs",
  GET_ADVISORS: "get_advisors",

  // Project info
  GET_PROJECT_URL: "get_project_url",
  GET_PUBLISHABLE_KEYS: "get_publishable_keys",
  GENERATE_TYPESCRIPT_TYPES: "generate_typescript_types",

  // Edge functions
  LIST_EDGE_FUNCTIONS: "list_edge_functions",
  GET_EDGE_FUNCTION: "get_edge_function",
  DEPLOY_EDGE_FUNCTION: "deploy_edge_function",

  // Branching
  CREATE_BRANCH: "create_branch",
  LIST_BRANCHES: "list_branches",
  DELETE_BRANCH: "delete_branch",
  MERGE_BRANCH: "merge_branch",
  RESET_BRANCH: "reset_branch",
  REBASE_BRANCH: "rebase_branch",

  // Storage
  LIST_STORAGE_BUCKETS: "list_storage_buckets",
  GET_STORAGE_CONFIG: "get_storage_config",
  UPDATE_STORAGE_CONFIG: "update_storage_config",

  // Docs
  SEARCH_DOCS: "search_docs",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

export const ActionSchema = z.enum([
  // Account/Project
  Actions.LIST_PROJECTS,
  Actions.GET_PROJECT,
  Actions.CREATE_PROJECT,
  Actions.PAUSE_PROJECT,
  Actions.RESTORE_PROJECT,
  // Organization
  Actions.LIST_ORGANIZATIONS,
  Actions.GET_ORGANIZATION,
  // Cost
  Actions.GET_COST,
  Actions.CONFIRM_COST,
  // Database
  Actions.EXECUTE_SQL,
  Actions.LIST_TABLES,
  Actions.LIST_EXTENSIONS,
  Actions.LIST_MIGRATIONS,
  Actions.APPLY_MIGRATION,
  // Monitoring
  Actions.GET_LOGS,
  Actions.GET_ADVISORS,
  // Project info
  Actions.GET_PROJECT_URL,
  Actions.GET_PUBLISHABLE_KEYS,
  Actions.GENERATE_TYPESCRIPT_TYPES,
  // Edge functions
  Actions.LIST_EDGE_FUNCTIONS,
  Actions.GET_EDGE_FUNCTION,
  Actions.DEPLOY_EDGE_FUNCTION,
  // Branching
  Actions.CREATE_BRANCH,
  Actions.LIST_BRANCHES,
  Actions.DELETE_BRANCH,
  Actions.MERGE_BRANCH,
  Actions.RESET_BRANCH,
  Actions.REBASE_BRANCH,
  // Storage
  Actions.LIST_STORAGE_BUCKETS,
  Actions.GET_STORAGE_CONFIG,
  Actions.UPDATE_STORAGE_CONFIG,
  // Docs
  Actions.SEARCH_DOCS,
]);

// AWS region codes for project creation
export const AwsRegions = z.enum([
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ap-east-1",
  "ap-south-1",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ca-central-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "sa-east-1",
]);

// Payload schemas per action
export const PayloadSchemas = {
  // Account/Project operations
  [Actions.LIST_PROJECTS]: z.object({}),

  [Actions.GET_PROJECT]: z.object({
    id: z.string().describe("The project ID"),
  }),

  [Actions.CREATE_PROJECT]: z.object({
    name: z.string().describe("The name of the project"),
    region: AwsRegions.describe("AWS region for the project"),
    organization_id: z.string().describe("The organization ID"),
    confirm_cost_id: z.string().describe("Cost confirmation ID from confirm_cost"),
  }),

  [Actions.PAUSE_PROJECT]: z.object({
    project_id: z.string().describe("The project ID to pause"),
  }),

  [Actions.RESTORE_PROJECT]: z.object({
    project_id: z.string().describe("The project ID to restore"),
  }),

  // Organization operations
  [Actions.LIST_ORGANIZATIONS]: z.object({}),

  [Actions.GET_ORGANIZATION]: z.object({
    id: z.string().describe("The organization ID or slug"),
  }),

  // Cost operations
  [Actions.GET_COST]: z.object({
    type: z.enum(["project", "branch"]).describe("Type of resource"),
    organization_id: z.string().describe("The organization ID"),
  }),

  [Actions.CONFIRM_COST]: z.object({
    type: z.enum(["project", "branch"]).describe("Type of resource"),
    recurrence: z.enum(["hourly", "monthly"]).describe("Cost recurrence"),
    amount: z.number().describe("Cost amount"),
  }),

  // Database operations
  [Actions.EXECUTE_SQL]: z.object({
    query: z.string().describe("SQL query to execute"),
    project_id: z.string().optional().describe("Project ID (uses env if not provided)"),
  }),

  [Actions.LIST_TABLES]: z.object({
    schemas: z.array(z.string()).default(["public"]).describe("Schemas to list tables from"),
    project_id: z.string().optional(),
  }),

  [Actions.LIST_EXTENSIONS]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.LIST_MIGRATIONS]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.APPLY_MIGRATION]: z.object({
    name: z.string().describe("Migration name"),
    sql: z.string().describe("Migration SQL"),
    project_id: z.string().optional(),
  }),

  [Actions.GET_LOGS]: z.object({
    service: z
      .enum(["api", "postgres", "edge_functions", "auth", "storage", "realtime"])
      .default("postgres")
      .describe("Service to get logs from"),
    limit: z.number().default(100).describe("Number of log entries"),
    project_id: z.string().optional(),
  }),

  [Actions.GET_ADVISORS]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.GET_PROJECT_URL]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.GET_PUBLISHABLE_KEYS]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.GENERATE_TYPESCRIPT_TYPES]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.LIST_EDGE_FUNCTIONS]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.GET_EDGE_FUNCTION]: z.object({
    slug: z.string().describe("Edge function slug"),
    project_id: z.string().optional(),
  }),

  [Actions.DEPLOY_EDGE_FUNCTION]: z.object({
    slug: z.string().describe("Edge function slug"),
    code: z.string().describe("Edge function code"),
    verify_jwt: z.boolean().default(true).describe("Require JWT verification"),
    project_id: z.string().optional(),
  }),

  [Actions.CREATE_BRANCH]: z.object({
    name: z.string().describe("Branch name"),
    project_id: z.string().optional(),
  }),

  [Actions.LIST_BRANCHES]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.DELETE_BRANCH]: z.object({
    branch_id: z.string().describe("Branch ID to delete"),
    project_id: z.string().optional(),
  }),

  [Actions.MERGE_BRANCH]: z.object({
    branch_id: z.string().describe("Branch ID to merge"),
    project_id: z.string().optional(),
  }),

  [Actions.RESET_BRANCH]: z.object({
    branch_id: z.string().describe("Branch ID to reset"),
    project_id: z.string().optional(),
  }),

  [Actions.REBASE_BRANCH]: z.object({
    branch_id: z.string().describe("Branch ID to rebase"),
    project_id: z.string().optional(),
  }),

  [Actions.SEARCH_DOCS]: z.object({
    query: z.string().describe("Search query for Supabase docs"),
  }),

  // Storage operations
  [Actions.LIST_STORAGE_BUCKETS]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.GET_STORAGE_CONFIG]: z.object({
    project_id: z.string().optional(),
  }),

  [Actions.UPDATE_STORAGE_CONFIG]: z.object({
    project_id: z.string().optional(),
    config: z.object({
      fileSizeLimit: z.number().optional().describe("Max file size in bytes"),
      features: z.object({
        imageTransformation: z.object({
          enabled: z.boolean(),
        }).optional(),
        s3Protocol: z.object({
          enabled: z.boolean(),
        }).optional(),
      }).optional(),
    }).describe("Storage configuration to update"),
  }),
} as const;

// Infer types from schemas
// Account/Project
export type ListProjectsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_PROJECTS]>;
export type GetProjectPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_PROJECT]>;
export type CreateProjectPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CREATE_PROJECT]>;
export type PauseProjectPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.PAUSE_PROJECT]>;
export type RestoreProjectPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.RESTORE_PROJECT]>;
// Organization
export type ListOrganizationsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_ORGANIZATIONS]>;
export type GetOrganizationPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_ORGANIZATION]>;
// Cost
export type GetCostPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_COST]>;
export type ConfirmCostPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CONFIRM_COST]>;
// Database
export type ExecuteSqlPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.EXECUTE_SQL]>;
export type ListTablesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_TABLES]>;
export type ListExtensionsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_EXTENSIONS]>;
export type ListMigrationsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_MIGRATIONS]>;
export type ApplyMigrationPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.APPLY_MIGRATION]>;
export type GetLogsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_LOGS]>;
export type GetAdvisorsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_ADVISORS]>;
export type GetProjectUrlPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_PROJECT_URL]>;
export type GetPublishableKeysPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_PUBLISHABLE_KEYS]>;
export type GenerateTypescriptTypesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GENERATE_TYPESCRIPT_TYPES]>;
export type ListEdgeFunctionsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_EDGE_FUNCTIONS]>;
export type GetEdgeFunctionPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_EDGE_FUNCTION]>;
export type DeployEdgeFunctionPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.DEPLOY_EDGE_FUNCTION]>;
export type CreateBranchPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CREATE_BRANCH]>;
export type ListBranchesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_BRANCHES]>;
export type DeleteBranchPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.DELETE_BRANCH]>;
export type MergeBranchPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.MERGE_BRANCH]>;
export type ResetBranchPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.RESET_BRANCH]>;
export type RebaseBranchPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.REBASE_BRANCH]>;
export type SearchDocsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.SEARCH_DOCS]>;
// Storage
export type ListStorageBucketsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_STORAGE_BUCKETS]>;
export type GetStorageConfigPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_STORAGE_CONFIG]>;
export type UpdateStorageConfigPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.UPDATE_STORAGE_CONFIG]>;

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
  projectId: string;
  accessToken: string;
}
