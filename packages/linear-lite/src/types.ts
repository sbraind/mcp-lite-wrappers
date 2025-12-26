import { z } from "zod";

// Action constants
export const Actions = {
  // Issue operations
  CREATE_ISSUE: "create_issue",
  UPDATE_ISSUE: "update_issue",
  GET_ISSUE: "get_issue",
  SEARCH_ISSUES: "search_issues",
  GET_USER_ISSUES: "get_user_issues",
  GET_TEAM_ISSUES: "get_team_issues",
  GET_PROJECT_ISSUES: "get_project_issues",

  // Comment operations
  ADD_COMMENT: "add_comment",
  GET_COMMENTS: "get_comments",

  // Team operations
  GET_TEAMS: "get_teams",
  GET_TEAM: "get_team",

  // Project operations
  GET_PROJECTS: "get_projects",
  GET_PROJECT: "get_project",

  // Label operations
  GET_LABELS: "get_labels",
  CREATE_LABEL: "create_label",
  UPDATE_LABEL: "update_label",

  // User operations
  GET_VIEWER: "get_viewer",
  GET_USERS: "get_users",
  GET_USER_TEAMS: "get_user_teams",
  GET_USER_PROJECTS: "get_user_projects",

  // Issue relations
  LINK_ISSUES: "link_issues",
  GET_ISSUE_RELATIONS: "get_issue_relations",

  // Attachments
  ADD_ATTACHMENT: "add_attachment",
  GET_ATTACHMENTS: "get_attachments",

  // Workflow states
  GET_WORKFLOW_STATES: "get_workflow_states",

  // Cycles
  GET_CYCLES: "get_cycles",
  GET_CYCLE: "get_cycle",
  CREATE_CYCLE: "create_cycle",

  // Milestones (Project Milestones)
  GET_MILESTONES: "get_milestones",
  CREATE_MILESTONE: "create_milestone",
  UPDATE_MILESTONE: "update_milestone",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

export const ActionSchema = z.enum([
  // Issues
  Actions.CREATE_ISSUE,
  Actions.UPDATE_ISSUE,
  Actions.GET_ISSUE,
  Actions.SEARCH_ISSUES,
  Actions.GET_USER_ISSUES,
  Actions.GET_TEAM_ISSUES,
  Actions.GET_PROJECT_ISSUES,
  // Comments
  Actions.ADD_COMMENT,
  Actions.GET_COMMENTS,
  // Teams
  Actions.GET_TEAMS,
  Actions.GET_TEAM,
  // Projects
  Actions.GET_PROJECTS,
  Actions.GET_PROJECT,
  // Labels
  Actions.GET_LABELS,
  Actions.CREATE_LABEL,
  Actions.UPDATE_LABEL,
  // Users
  Actions.GET_VIEWER,
  Actions.GET_USERS,
  Actions.GET_USER_TEAMS,
  Actions.GET_USER_PROJECTS,
  // Relations
  Actions.LINK_ISSUES,
  Actions.GET_ISSUE_RELATIONS,
  // Attachments
  Actions.ADD_ATTACHMENT,
  Actions.GET_ATTACHMENTS,
  // Workflow
  Actions.GET_WORKFLOW_STATES,
  // Cycles
  Actions.GET_CYCLES,
  Actions.GET_CYCLE,
  Actions.CREATE_CYCLE,
  // Milestones
  Actions.GET_MILESTONES,
  Actions.CREATE_MILESTONE,
  Actions.UPDATE_MILESTONE,
]);

// Priority levels: 0=no priority, 1=urgent, 2=high, 3=medium, 4=low
export const PrioritySchema = z.number().min(0).max(4).optional();

// Relation types
export const RelationTypeSchema = z.enum([
  "blocks",
  "blocked_by",
  "related",
  "duplicate",
  "duplicates",
  "is_duplicated_by",
]);

// Payload schemas per action
export const PayloadSchemas = {
  // ==================== Issue Operations ====================
  [Actions.CREATE_ISSUE]: z.object({
    title: z.string().describe("Issue title"),
    teamId: z.string().describe("Team ID to create issue in"),
    description: z.string().optional().describe("Issue description (markdown supported)"),
    priority: PrioritySchema.describe("Priority level (0-4): 0=no priority, 1=urgent, 2=high, 3=medium, 4=low"),
    stateId: z.string().optional().describe("Workflow state ID"),
    assigneeId: z.string().optional().describe("User ID to assign the issue to"),
    labelIds: z.array(z.string()).optional().describe("Label IDs to apply"),
    projectId: z.string().optional().describe("Project ID to associate with"),
    dueDate: z.string().optional().describe("Due date (ISO 8601 format)"),
    estimate: z.number().optional().describe("Issue estimate points"),
    parentId: z.string().optional().describe("Parent issue ID for sub-issues"),
  }),

  [Actions.UPDATE_ISSUE]: z.object({
    issueId: z.string().describe("Issue ID to update"),
    title: z.string().optional().describe("New issue title"),
    description: z.string().optional().describe("New issue description (markdown supported)"),
    stateId: z.string().optional().describe("New workflow state ID (UUID)"),
    stateName: z.string().optional().describe("Workflow state name (e.g., 'In Progress', 'Done') - will be resolved to stateId"),
    cycleId: z.string().optional().describe("Cycle ID to add the issue to (UUID)"),
    cycleName: z.string().optional().describe("Cycle name (e.g., 'Sprint 1') - will be resolved to cycleId"),
    teamId: z.string().optional().describe("New team ID"),
    assigneeId: z.string().optional().describe("User ID to assign the issue to"),
    priority: PrioritySchema.describe("Priority level (0-4)"),
    dueDate: z.string().optional().describe("New due date (ISO 8601 format)"),
    labelIds: z.array(z.string()).optional().describe("Label IDs to apply"),
    projectId: z.string().optional().describe("Project ID to associate with"),
    estimate: z.number().optional().describe("Issue estimate points"),
  }),

  [Actions.GET_ISSUE]: z.object({
    issueId: z.string().optional().describe("Issue ID or identifier (e.g., 'TEAM-123')"),
    id: z.string().optional().describe("Alias for issueId - Issue ID or identifier"),
  }).refine(data => data.issueId || data.id, {
    message: "Either 'issueId' or 'id' is required",
  }),

  [Actions.SEARCH_ISSUES]: z.object({
    query: z.string().describe("Text to search in title/description"),
    includeArchived: z.boolean().optional().describe("Include archived issues"),
    limit: z.number().optional().default(10).describe("Maximum number of issues to return"),
  }),

  [Actions.GET_USER_ISSUES]: z.object({
    userId: z.string().optional().describe("User ID (omit for authenticated user)"),
    includeArchived: z.boolean().optional().describe("Include archived issues"),
    limit: z.number().optional().default(50).describe("Maximum number of issues to return"),
  }),

  [Actions.GET_TEAM_ISSUES]: z.object({
    teamId: z.string().describe("Team ID"),
    includeArchived: z.boolean().optional().describe("Include archived issues"),
    limit: z.number().optional().default(50).describe("Maximum number of issues to return"),
  }),

  [Actions.GET_PROJECT_ISSUES]: z.object({
    projectId: z.string().describe("Project ID"),
    includeArchived: z.boolean().optional().describe("Include archived issues"),
    limit: z.number().optional().default(50).describe("Maximum number of issues to return"),
  }),

  // ==================== Comment Operations ====================
  [Actions.ADD_COMMENT]: z.object({
    issueId: z.string().describe("Issue ID to comment on"),
    body: z.string().describe("Comment text (markdown supported)"),
    createAsUser: z.string().optional().describe("Custom username for the comment creator"),
    displayIconUrl: z.string().optional().describe("Custom avatar URL for the comment creator"),
  }),

  [Actions.GET_COMMENTS]: z.object({
    issueId: z.string().describe("Issue ID to get comments for"),
    limit: z.number().optional().default(50).describe("Maximum number of comments to return"),
  }),

  // ==================== Team Operations ====================
  [Actions.GET_TEAMS]: z.object({
    includeArchived: z.boolean().optional().describe("Include archived teams"),
    limit: z.number().optional().default(50).describe("Maximum number of teams to return"),
  }),

  [Actions.GET_TEAM]: z.object({
    teamId: z.string().describe("Team ID or key"),
  }),

  // ==================== Project Operations ====================
  [Actions.GET_PROJECTS]: z.object({
    teamId: z.string().optional().describe("Filter projects by team ID"),
    includeArchived: z.boolean().optional().describe("Include archived projects"),
    limit: z.number().optional().default(50).describe("Maximum number of projects to return"),
  }),

  [Actions.GET_PROJECT]: z.object({
    projectId: z.string().describe("Project ID"),
  }),

  // ==================== Label Operations ====================
  [Actions.GET_LABELS]: z.object({
    teamId: z.string().optional().describe("Filter labels by team ID"),
    includeArchived: z.boolean().optional().describe("Include archived labels"),
    limit: z.number().optional().default(50).describe("Maximum number of labels to return"),
  }),

  [Actions.CREATE_LABEL]: z.object({
    teamId: z.string().describe("Team ID to create the label for"),
    name: z.string().describe("Label name"),
    color: z.string().optional().describe("Label color in hex format (e.g., '#FF0000')"),
    description: z.string().optional().describe("Label description"),
    parentId: z.string().optional().describe("Parent label ID for nested labels"),
  }),

  [Actions.UPDATE_LABEL]: z.object({
    labelId: z.string().describe("Label ID to update"),
    name: z.string().optional().describe("New label name"),
    color: z.string().optional().describe("New label color in hex format"),
    description: z.string().optional().describe("New label description"),
  }),

  // ==================== User Operations ====================
  [Actions.GET_VIEWER]: z.object({}),

  [Actions.GET_USERS]: z.object({
    includeArchived: z.boolean().optional().describe("Include deactivated users"),
    limit: z.number().optional().default(50).describe("Maximum number of users to return"),
  }),

  [Actions.GET_USER_TEAMS]: z.object({
    userId: z.string().optional().describe("User ID (omit for authenticated user)"),
  }),

  [Actions.GET_USER_PROJECTS]: z.object({
    userId: z.string().optional().describe("User ID (omit for authenticated user)"),
    includeArchived: z.boolean().optional().describe("Include archived projects"),
    limit: z.number().optional().default(50).describe("Maximum number of projects to return"),
  }),

  // ==================== Issue Relations ====================
  [Actions.LINK_ISSUES]: z.object({
    issueId: z.string().describe("Source issue ID"),
    relatedIssueId: z.string().describe("Target issue ID"),
    type: RelationTypeSchema.describe("Relationship type"),
  }),

  [Actions.GET_ISSUE_RELATIONS]: z.object({
    issueId: z.string().describe("Issue ID to get relations for"),
  }),

  // ==================== Attachments ====================
  [Actions.ADD_ATTACHMENT]: z.object({
    issueId: z.string().describe("Issue ID to attach to"),
    url: z.string().describe("URL of the attachment"),
    title: z.string().optional().describe("Attachment title"),
    subtitle: z.string().optional().describe("Attachment subtitle"),
    iconUrl: z.string().optional().describe("Icon URL for the attachment"),
  }),

  [Actions.GET_ATTACHMENTS]: z.object({
    issueId: z.string().describe("Issue ID to get attachments for"),
  }),

  // ==================== Workflow States ====================
  [Actions.GET_WORKFLOW_STATES]: z.object({
    teamId: z.string().describe("Team ID to get workflow states for"),
    includeArchived: z.boolean().optional().describe("Include archived states"),
  }),

  // ==================== Cycles ====================
  [Actions.GET_CYCLES]: z.object({
    teamId: z.string().describe("Team ID to get cycles for"),
    includeArchived: z.boolean().optional().describe("Include archived/completed cycles"),
    limit: z.number().optional().default(50).describe("Maximum number of cycles to return"),
  }),

  [Actions.GET_CYCLE]: z.object({
    cycleId: z.string().describe("Cycle ID"),
  }),

  [Actions.CREATE_CYCLE]: z.object({
    teamId: z.string().describe("Team ID to create the cycle for"),
    name: z.string().optional().describe("Cycle name (optional, Linear auto-generates if not provided)"),
    startsAt: z.string().describe("Start date (ISO 8601 format, e.g., '2024-01-15')"),
    endsAt: z.string().describe("End date (ISO 8601 format, e.g., '2024-01-28')"),
    description: z.string().optional().describe("Cycle description"),
  }),

  // ==================== Milestones ====================
  [Actions.GET_MILESTONES]: z.object({
    projectId: z.string().describe("Project ID to get milestones for"),
    includeArchived: z.boolean().optional().describe("Include archived milestones"),
    limit: z.number().optional().default(50).describe("Maximum number of milestones to return"),
  }),

  [Actions.CREATE_MILESTONE]: z.object({
    projectId: z.string().describe("Project ID to create milestone in"),
    name: z.string().describe("Milestone name"),
    description: z.string().optional().describe("Milestone description"),
    targetDate: z.string().optional().describe("Target date (ISO 8601 format)"),
    sortOrder: z.number().optional().describe("Sort order for the milestone"),
  }),

  [Actions.UPDATE_MILESTONE]: z.object({
    milestoneId: z.string().describe("Milestone ID to update"),
    name: z.string().optional().describe("New milestone name"),
    description: z.string().optional().describe("New milestone description"),
    targetDate: z.string().optional().describe("New target date (ISO 8601 format)"),
    sortOrder: z.number().optional().describe("New sort order"),
  }),
} as const;

// Infer types from schemas
export type CreateIssuePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CREATE_ISSUE]>;
export type UpdateIssuePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.UPDATE_ISSUE]>;
export type GetIssuePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_ISSUE]>;
export type SearchIssuesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.SEARCH_ISSUES]>;
export type GetUserIssuesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_USER_ISSUES]>;
export type GetTeamIssuesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_TEAM_ISSUES]>;
export type GetProjectIssuesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_PROJECT_ISSUES]>;
export type AddCommentPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.ADD_COMMENT]>;
export type GetCommentsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_COMMENTS]>;
export type GetTeamsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_TEAMS]>;
export type GetTeamPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_TEAM]>;
export type GetProjectsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_PROJECTS]>;
export type GetProjectPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_PROJECT]>;
export type GetLabelsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_LABELS]>;
export type CreateLabelPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CREATE_LABEL]>;
export type UpdateLabelPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.UPDATE_LABEL]>;
export type GetViewerPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_VIEWER]>;
export type GetUsersPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_USERS]>;
export type GetUserTeamsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_USER_TEAMS]>;
export type GetUserProjectsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_USER_PROJECTS]>;
export type LinkIssuesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LINK_ISSUES]>;
export type GetIssueRelationsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_ISSUE_RELATIONS]>;
export type AddAttachmentPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.ADD_ATTACHMENT]>;
export type GetAttachmentsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_ATTACHMENTS]>;
export type GetWorkflowStatesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_WORKFLOW_STATES]>;
export type GetCyclesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_CYCLES]>;
export type GetCyclePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_CYCLE]>;
export type CreateCyclePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CREATE_CYCLE]>;
export type GetMilestonesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_MILESTONES]>;
export type CreateMilestonePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CREATE_MILESTONE]>;
export type UpdateMilestonePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.UPDATE_MILESTONE]>;

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
