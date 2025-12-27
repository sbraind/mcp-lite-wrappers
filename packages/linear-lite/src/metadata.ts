import { Actions } from "./types.js";

export type ActionCategory = "issues" | "comments" | "teams" | "projects" | "labels" | "users" | "cycles" | "workflow";

export interface ActionMeta {
  description: string;
  category: ActionCategory;
  examples: Array<Record<string, unknown>>;
  commonParams?: string[];
}

export const ActionMetadata: Record<string, ActionMeta> = {
  // ==================== Issues ====================
  [Actions.CREATE_ISSUE]: {
    description: "Create a new issue in a team",
    category: "issues",
    examples: [
      { title: "Fix login bug", teamName: "Engineering", priority: 1 },
      { title: "Update docs", teamName: "Product", description: "Add API docs", labelIds: ["docs-label-id"] },
    ],
    commonParams: ["title", "teamName", "priority", "description"],
  },

  [Actions.UPDATE_ISSUE]: {
    description: "Update an existing issue",
    category: "issues",
    examples: [
      { issueId: "TEAM-123", stateName: "In Progress" },
      { issueId: "TEAM-456", priority: 1, assigneeId: "user-uuid" },
      { issueId: "TEAM-789", cycleName: "Sprint 1" },
    ],
    commonParams: ["issueId", "stateName", "priority", "assigneeId"],
  },

  [Actions.GET_ISSUE]: {
    description: "Get issue details by ID or identifier",
    category: "issues",
    examples: [
      { issueId: "TEAM-123" },
      { id: "issue-uuid" },
    ],
    commonParams: ["issueId"],
  },

  [Actions.SEARCH_ISSUES]: {
    description: "Search issues by text in title/description",
    category: "issues",
    examples: [
      { query: "login bug" },
      { query: "API error", limit: 20, includeArchived: true },
    ],
    commonParams: ["query", "limit"],
  },

  [Actions.GET_USER_ISSUES]: {
    description: "Get issues assigned to a user",
    category: "issues",
    examples: [
      {},
      { userId: "user-uuid", limit: 100 },
    ],
    commonParams: ["userId", "limit"],
  },

  [Actions.GET_TEAM_ISSUES]: {
    description: "Get all issues for a team",
    category: "issues",
    examples: [
      { teamName: "Engineering" },
      { teamId: "team-uuid", limit: 100 },
    ],
    commonParams: ["teamName", "limit"],
  },

  [Actions.GET_PROJECT_ISSUES]: {
    description: "Get issues in a project",
    category: "issues",
    examples: [
      { projectId: "project-uuid" },
    ],
    commonParams: ["projectId", "limit"],
  },

  // ==================== Comments ====================
  [Actions.ADD_COMMENT]: {
    description: "Add a comment to an issue",
    category: "comments",
    examples: [
      { issueId: "TEAM-123", body: "This looks good to merge!" },
      { issueId: "TEAM-456", body: "Needs more testing", createAsUser: "CI Bot" },
    ],
    commonParams: ["issueId", "body"],
  },

  [Actions.GET_COMMENTS]: {
    description: "Get comments on an issue",
    category: "comments",
    examples: [
      { issueId: "TEAM-123" },
      { issueId: "TEAM-456", limit: 10 },
    ],
    commonParams: ["issueId"],
  },

  // ==================== Teams ====================
  [Actions.GET_TEAMS]: {
    description: "List all teams in the workspace",
    category: "teams",
    examples: [
      {},
      { includeArchived: true, limit: 100 },
    ],
    commonParams: [],
  },

  [Actions.GET_TEAM]: {
    description: "Get details of a specific team",
    category: "teams",
    examples: [
      { teamId: "team-uuid" },
    ],
    commonParams: ["teamId"],
  },

  // ==================== Projects ====================
  [Actions.GET_PROJECTS]: {
    description: "List projects, optionally filtered by team",
    category: "projects",
    examples: [
      {},
      { teamId: "team-uuid", limit: 50 },
    ],
    commonParams: ["teamId"],
  },

  [Actions.GET_PROJECT]: {
    description: "Get project details",
    category: "projects",
    examples: [
      { projectId: "project-uuid" },
    ],
    commonParams: ["projectId"],
  },

  // ==================== Labels ====================
  [Actions.GET_LABELS]: {
    description: "List labels, optionally filtered by team",
    category: "labels",
    examples: [
      {},
      { teamId: "team-uuid" },
    ],
    commonParams: ["teamId"],
  },

  [Actions.CREATE_LABEL]: {
    description: "Create a new label for a team",
    category: "labels",
    examples: [
      { teamName: "Engineering", name: "bug", color: "#FF0000" },
      { teamId: "team-uuid", name: "feature", description: "New features" },
    ],
    commonParams: ["teamName", "name", "color"],
  },

  [Actions.UPDATE_LABEL]: {
    description: "Update an existing label",
    category: "labels",
    examples: [
      { labelId: "label-uuid", name: "critical-bug", color: "#FF0000" },
    ],
    commonParams: ["labelId", "name", "color"],
  },

  // ==================== Users ====================
  [Actions.GET_VIEWER]: {
    description: "Get the authenticated user's info",
    category: "users",
    examples: [{}],
    commonParams: [],
  },

  [Actions.GET_USERS]: {
    description: "List all users in the workspace",
    category: "users",
    examples: [
      {},
      { limit: 100 },
    ],
    commonParams: ["limit"],
  },

  [Actions.GET_USER_TEAMS]: {
    description: "Get teams a user belongs to",
    category: "users",
    examples: [
      {},
      { userId: "user-uuid" },
    ],
    commonParams: ["userId"],
  },

  [Actions.GET_USER_PROJECTS]: {
    description: "Get projects a user is member of",
    category: "users",
    examples: [
      {},
      { userId: "user-uuid" },
    ],
    commonParams: ["userId"],
  },

  // ==================== Workflow ====================
  [Actions.GET_WORKFLOW_STATES]: {
    description: "Get workflow states for a team (Backlog, Todo, In Progress, Done, etc.)",
    category: "workflow",
    examples: [
      { teamName: "Engineering" },
      { teamId: "team-uuid" },
    ],
    commonParams: ["teamName"],
  },

  [Actions.LINK_ISSUES]: {
    description: "Create a relationship between two issues",
    category: "workflow",
    examples: [
      { issueId: "TEAM-123", relatedIssueId: "TEAM-456", type: "blocks" },
      { issueId: "TEAM-789", relatedIssueId: "TEAM-012", type: "related" },
    ],
    commonParams: ["issueId", "relatedIssueId", "type"],
  },

  [Actions.GET_ISSUE_RELATIONS]: {
    description: "Get all relationships for an issue",
    category: "workflow",
    examples: [
      { issueId: "TEAM-123" },
    ],
    commonParams: ["issueId"],
  },

  [Actions.ADD_ATTACHMENT]: {
    description: "Add a URL attachment to an issue",
    category: "workflow",
    examples: [
      { issueId: "TEAM-123", url: "https://figma.com/file/...", title: "Design mockup" },
    ],
    commonParams: ["issueId", "url", "title"],
  },

  [Actions.GET_ATTACHMENTS]: {
    description: "Get attachments on an issue",
    category: "workflow",
    examples: [
      { issueId: "TEAM-123" },
    ],
    commonParams: ["issueId"],
  },

  // ==================== Cycles ====================
  [Actions.GET_CYCLES]: {
    description: "Get cycles (sprints) for a team",
    category: "cycles",
    examples: [
      { teamName: "Engineering" },
      { teamId: "team-uuid", limit: 10 },
    ],
    commonParams: ["teamName", "limit"],
  },

  [Actions.GET_CYCLE]: {
    description: "Get cycle details",
    category: "cycles",
    examples: [
      { cycleId: "cycle-uuid" },
    ],
    commonParams: ["cycleId"],
  },

  [Actions.CREATE_CYCLE]: {
    description: "Create a new cycle (sprint)",
    category: "cycles",
    examples: [
      { teamName: "Engineering", startsAt: "2024-01-15", endsAt: "2024-01-28" },
      { teamId: "team-uuid", name: "Sprint 5", startsAt: "2024-02-01", endsAt: "2024-02-14" },
    ],
    commonParams: ["teamName", "startsAt", "endsAt", "name"],
  },

  // ==================== Milestones ====================
  [Actions.GET_MILESTONES]: {
    description: "Get milestones for a project",
    category: "projects",
    examples: [
      { projectId: "project-uuid" },
    ],
    commonParams: ["projectId"],
  },

  [Actions.CREATE_MILESTONE]: {
    description: "Create a project milestone",
    category: "projects",
    examples: [
      { projectId: "project-uuid", name: "MVP Launch", targetDate: "2024-03-01" },
    ],
    commonParams: ["projectId", "name", "targetDate"],
  },

  [Actions.UPDATE_MILESTONE]: {
    description: "Update a milestone",
    category: "projects",
    examples: [
      { milestoneId: "milestone-uuid", name: "Beta Launch", targetDate: "2024-04-01" },
    ],
    commonParams: ["milestoneId", "name"],
  },
};

// Top actions for discriminated union (most commonly used)
export const TopActions = [
  Actions.CREATE_ISSUE,
  Actions.UPDATE_ISSUE,
  Actions.GET_ISSUE,
  Actions.SEARCH_ISSUES,
  Actions.GET_TEAM_ISSUES,
  Actions.ADD_COMMENT,
  Actions.GET_TEAMS,
  Actions.GET_WORKFLOW_STATES,
] as const;

// Category display order
export const CategoryOrder: ActionCategory[] = [
  "issues",
  "comments",
  "workflow",
  "teams",
  "projects",
  "cycles",
  "labels",
  "users",
];
