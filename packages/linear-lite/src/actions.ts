import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Actions,
  ActionSchema,
  PayloadSchemas,
  ToolResult,
  type ToolInput,
} from "./types.js";
import { LinearClient, ApiError } from "./client/index.js";
import { ActionMetadata, TopActions, CategoryOrder } from "./metadata.js";

function getConfig() {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error("LINEAR_API_KEY environment variable is required");
  }

  return { apiKey };
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

// Helper to resolve team name/key to team ID
async function resolveTeamId(
  client: LinearClient,
  teamId?: string,
  teamName?: string
): Promise<{ teamId: string } | { error: ToolResult }> {
  // If teamId is provided and looks like a UUID, use it directly
  if (teamId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) {
    return { teamId };
  }

  // If teamId is provided but not a UUID, treat it as a team name/key
  const nameToResolve = teamName || teamId;

  if (!nameToResolve) {
    return { error: error("Either 'teamId' (UUID) or 'teamName' is required", "TEAM_REQUIRED") };
  }

  // Fetch all teams and find matching one
  const teamsData = await client.getTeams({}) as {
    teams: { nodes: Array<{ id: string; name: string; key: string }> }
  };
  const teams = teamsData.teams.nodes;

  const matchingTeam = teams.find(
    t => t.name.toLowerCase() === nameToResolve.toLowerCase() ||
         t.key.toLowerCase() === nameToResolve.toLowerCase()
  );

  if (!matchingTeam) {
    const availableTeams = teams.map(t => `${t.name} (${t.key})`).join(", ");
    return {
      error: error(
        `Team "${nameToResolve}" not found. Available teams: ${availableTeams}`,
        "TEAM_NOT_FOUND"
      )
    };
  }

  return { teamId: matchingTeam.id };
}

async function dispatch(input: ToolInput): Promise<ToolResult> {
  const { action, payload = {} } = input;

  try {
    const config = getConfig();
    const client = new LinearClient(config.apiKey);
    // Validate and parse payload for the specific action
    const schema = PayloadSchemas[action as keyof typeof PayloadSchemas];
    const validatedPayload = schema.parse(payload);

    switch (action) {
      // ==================== Issue Operations ====================
      case Actions.CREATE_ISSUE: {
        const p = validatedPayload as {
          title: string;
          teamId?: string;
          teamName?: string;
          description?: string;
          priority?: number;
          stateId?: string;
          assigneeId?: string;
          labelIds?: string[];
          projectId?: string;
          dueDate?: string;
          estimate?: number;
          parentId?: string;
        };

        // Resolve team name to ID if needed
        const teamResult = await resolveTeamId(client, p.teamId, p.teamName);
        if ('error' in teamResult) return teamResult.error;

        const { teamName: _, ...createInput } = p;
        const result = await client.createIssue({ ...createInput, teamId: teamResult.teamId });
        return success(result);
      }

      case Actions.UPDATE_ISSUE: {
        const p = validatedPayload as {
          issueId: string;
          title?: string;
          description?: string;
          stateId?: string;
          stateName?: string;
          cycleId?: string;
          cycleName?: string;
          teamId?: string;
          assigneeId?: string;
          priority?: number;
          dueDate?: string;
          labelIds?: string[];
          projectId?: string;
          estimate?: number;
        };
        const { issueId, stateName, cycleName, ...updateInput } = p;

        // Get the issue to find its team (needed for state/cycle resolution)
        let teamId: string | undefined;
        if (stateName || cycleName) {
          const issueData = await client.getIssue(issueId) as { issue: { team: { id: string } } };
          teamId = issueData.issue.team.id;
        }

        // If stateName is provided, resolve it to stateId
        if (stateName && !updateInput.stateId && teamId) {
          const statesData = await client.getWorkflowStates(teamId) as {
            team: { states: { nodes: Array<{ id: string; name: string }> } }
          };
          const states = statesData.team.states.nodes;

          const matchingState = states.find(
            s => s.name.toLowerCase() === stateName.toLowerCase()
          );

          if (!matchingState) {
            const availableStates = states.map(s => s.name).join(", ");
            return error(
              `State "${stateName}" not found. Available states: ${availableStates}`,
              "STATE_NOT_FOUND"
            );
          }

          updateInput.stateId = matchingState.id;
        }

        // If cycleName is provided, resolve it to cycleId
        if (cycleName && !updateInput.cycleId && teamId) {
          const cyclesData = await client.getCycles(teamId) as {
            team: { cycles: { nodes: Array<{ id: string; name: string; number: number }> } }
          };
          const cycles = cyclesData.team.cycles.nodes;

          // Try to match by name or number
          const matchingCycle = cycles.find(
            c => c.name?.toLowerCase() === cycleName.toLowerCase() ||
                 c.number?.toString() === cycleName
          );

          if (!matchingCycle) {
            const availableCycles = cycles.map(c => c.name || `Cycle ${c.number}`).join(", ");
            return error(
              `Cycle "${cycleName}" not found. Available cycles: ${availableCycles}`,
              "CYCLE_NOT_FOUND"
            );
          }

          updateInput.cycleId = matchingCycle.id;
        }

        const result = await client.updateIssue(issueId, updateInput);
        return success(result);
      }

      case Actions.GET_ISSUE: {
        const p = validatedPayload as { issueId?: string; id?: string };
        const issueId = p.issueId || p.id!;
        const result = await client.getIssue(issueId);
        return success(result);
      }

      case Actions.SEARCH_ISSUES: {
        const p = validatedPayload as {
          query: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.searchIssues(p.query, {
          includeArchived: p.includeArchived,
          limit: p.limit,
        });
        return success(result);
      }

      case Actions.GET_USER_ISSUES: {
        const p = validatedPayload as {
          userId?: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getUserIssues(p);
        return success(result);
      }

      case Actions.GET_TEAM_ISSUES: {
        const p = validatedPayload as {
          teamId?: string;
          teamName?: string;
          includeArchived?: boolean;
          limit?: number;
        };

        // Resolve team name to ID if needed
        const teamResult = await resolveTeamId(client, p.teamId, p.teamName);
        if ('error' in teamResult) return teamResult.error;

        const result = await client.getTeamIssues(teamResult.teamId, {
          includeArchived: p.includeArchived,
          limit: p.limit,
        });
        return success(result);
      }

      case Actions.GET_PROJECT_ISSUES: {
        const p = validatedPayload as {
          projectId: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getProjectIssues(p.projectId, {
          includeArchived: p.includeArchived,
          limit: p.limit,
        });
        return success(result);
      }

      // ==================== Comment Operations ====================
      case Actions.ADD_COMMENT: {
        const p = validatedPayload as {
          issueId: string;
          body: string;
          createAsUser?: string;
          displayIconUrl?: string;
        };
        const result = await client.addComment(p);
        return success(result);
      }

      case Actions.GET_COMMENTS: {
        const p = validatedPayload as { issueId: string; limit?: number };
        const result = await client.getComments(p.issueId, { limit: p.limit });
        return success(result);
      }

      // ==================== Team Operations ====================
      case Actions.GET_TEAMS: {
        const p = validatedPayload as {
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getTeams(p);
        return success(result);
      }

      case Actions.GET_TEAM: {
        const p = validatedPayload as { teamId: string };
        const result = await client.getTeam(p.teamId);
        return success(result);
      }

      // ==================== Project Operations ====================
      case Actions.GET_PROJECTS: {
        const p = validatedPayload as {
          teamId?: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getProjects(p);
        return success(result);
      }

      case Actions.GET_PROJECT: {
        const p = validatedPayload as { projectId: string };
        const result = await client.getProject(p.projectId);
        return success(result);
      }

      // ==================== Label Operations ====================
      case Actions.GET_LABELS: {
        const p = validatedPayload as {
          teamId?: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getLabels(p);
        return success(result);
      }

      case Actions.CREATE_LABEL: {
        const p = validatedPayload as {
          teamId?: string;
          teamName?: string;
          name: string;
          color?: string;
          description?: string;
          parentId?: string;
        };

        // Resolve team name to ID if needed
        const teamResult = await resolveTeamId(client, p.teamId, p.teamName);
        if ('error' in teamResult) return teamResult.error;

        const { teamName: _, ...createInput } = p;
        const result = await client.createLabel({ ...createInput, teamId: teamResult.teamId });
        return success(result);
      }

      case Actions.UPDATE_LABEL: {
        const p = validatedPayload as {
          labelId: string;
          name?: string;
          color?: string;
          description?: string;
        };
        const { labelId, ...updateInput } = p;
        const result = await client.updateLabel(labelId, updateInput);
        return success(result);
      }

      // ==================== User Operations ====================
      case Actions.GET_VIEWER: {
        const result = await client.getViewer();
        return success(result);
      }

      case Actions.GET_USERS: {
        const p = validatedPayload as {
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getUsers(p);
        return success(result);
      }

      case Actions.GET_USER_TEAMS: {
        const p = validatedPayload as { userId?: string };
        const result = await client.getUserTeams(p.userId);
        return success(result);
      }

      case Actions.GET_USER_PROJECTS: {
        const p = validatedPayload as {
          userId?: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getUserProjects(p);
        return success(result);
      }

      // ==================== Issue Relations ====================
      case Actions.LINK_ISSUES: {
        const p = validatedPayload as {
          issueId: string;
          relatedIssueId: string;
          type: string;
        };
        const result = await client.linkIssues(p);
        return success(result);
      }

      case Actions.GET_ISSUE_RELATIONS: {
        const p = validatedPayload as { issueId: string };
        const result = await client.getIssueRelations(p.issueId);
        return success(result);
      }

      // ==================== Attachments ====================
      case Actions.ADD_ATTACHMENT: {
        const p = validatedPayload as {
          issueId: string;
          url: string;
          title?: string;
          subtitle?: string;
          iconUrl?: string;
        };
        const result = await client.addAttachment(p);
        return success(result);
      }

      case Actions.GET_ATTACHMENTS: {
        const p = validatedPayload as { issueId: string };
        const result = await client.getAttachments(p.issueId);
        return success(result);
      }

      // ==================== Workflow States ====================
      case Actions.GET_WORKFLOW_STATES: {
        const p = validatedPayload as {
          teamId?: string;
          teamName?: string;
          includeArchived?: boolean;
        };

        // Resolve team name to ID if needed
        const teamResult = await resolveTeamId(client, p.teamId, p.teamName);
        if ('error' in teamResult) return teamResult.error;

        const result = await client.getWorkflowStates(teamResult.teamId, {
          includeArchived: p.includeArchived,
        });
        return success(result);
      }

      // ==================== Cycles ====================
      case Actions.GET_CYCLES: {
        const p = validatedPayload as {
          teamId?: string;
          teamName?: string;
          includeArchived?: boolean;
          limit?: number;
        };

        // Resolve team name to ID if needed
        const teamResult = await resolveTeamId(client, p.teamId, p.teamName);
        if ('error' in teamResult) return teamResult.error;

        const result = await client.getCycles(teamResult.teamId, {
          includeArchived: p.includeArchived,
          limit: p.limit,
        });
        return success(result);
      }

      case Actions.GET_CYCLE: {
        const p = validatedPayload as { cycleId: string };
        const result = await client.getCycle(p.cycleId);
        return success(result);
      }

      case Actions.CREATE_CYCLE: {
        const p = validatedPayload as {
          teamId?: string;
          teamName?: string;
          name?: string;
          startsAt: string;
          endsAt: string;
          description?: string;
        };

        // Resolve team name to ID if needed
        const teamResult = await resolveTeamId(client, p.teamId, p.teamName);
        if ('error' in teamResult) return teamResult.error;

        const { teamName: _, ...createInput } = p;
        const result = await client.createCycle({ ...createInput, teamId: teamResult.teamId });
        return success(result);
      }

      // ==================== Milestones ====================
      case Actions.GET_MILESTONES: {
        const p = validatedPayload as {
          projectId: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getMilestones(p.projectId, {
          includeArchived: p.includeArchived,
          limit: p.limit,
        });
        return success(result);
      }

      case Actions.CREATE_MILESTONE: {
        const p = validatedPayload as {
          projectId: string;
          name: string;
          description?: string;
          targetDate?: string;
          sortOrder?: number;
        };
        const result = await client.createMilestone(p);
        return success(result);
      }

      case Actions.UPDATE_MILESTONE: {
        const p = validatedPayload as {
          milestoneId: string;
          name?: string;
          description?: string;
          targetDate?: string;
          sortOrder?: number;
        };
        const { milestoneId, ...updateInput } = p;
        const result = await client.updateMilestone(milestoneId, updateInput);
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
  const lines: string[] = ["Linear operations.", ""];

  for (const category of CategoryOrder) {
    const actions = byCategory[category];
    if (!actions?.length) continue;

    const label = category.charAt(0).toUpperCase() + category.slice(1);
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
    "linear",
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
