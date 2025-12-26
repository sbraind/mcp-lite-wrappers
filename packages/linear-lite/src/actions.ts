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
          teamId: string;
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
        const result = await client.createIssue(p);
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
          teamId: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getTeamIssues(p.teamId, {
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
          teamId: string;
          name: string;
          color?: string;
          description?: string;
          parentId?: string;
        };
        const result = await client.createLabel(p);
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
          teamId: string;
          includeArchived?: boolean;
        };
        const result = await client.getWorkflowStates(p.teamId, {
          includeArchived: p.includeArchived,
        });
        return success(result);
      }

      // ==================== Cycles ====================
      case Actions.GET_CYCLES: {
        const p = validatedPayload as {
          teamId: string;
          includeArchived?: boolean;
          limit?: number;
        };
        const result = await client.getCycles(p.teamId, {
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
          teamId: string;
          name?: string;
          startsAt: string;
          endsAt: string;
          description?: string;
        };
        const result = await client.createCycle(p);
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
  const actions = Object.values(Actions).join(", ");
  return `Linear operations. Actions: ${actions}. Use action parameter to select operation, payload for action-specific parameters.`;
}

export function registerTools(server: McpServer): void {
  server.tool(
    "linear",
    buildDescription(),
    {
      action: ActionSchema.describe("Action to perform"),
      payload: z.record(z.unknown()).optional().describe("Action-specific parameters"),
    },
    async (args) => {
      return dispatch(args);
    }
  );
}
