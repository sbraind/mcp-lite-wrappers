import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Actions,
  ActionSchema,
  PayloadSchemas,
  ToolResult,
  type ToolInput,
} from "./types.js";
import { Context7Client, ApiError } from "./client/index.js";

function getConfig() {
  // API key is optional - Context7 works without it but with lower rate limits
  const apiKey = process.env.CONTEXT7_API_KEY;
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
    const client = new Context7Client(config.apiKey);

    // Validate and parse payload for the specific action
    const schema = PayloadSchemas[action as keyof typeof PayloadSchemas];
    const validatedPayload = schema.parse(payload);

    switch (action) {
      case Actions.RESOLVE_LIBRARY_ID: {
        const p = validatedPayload as { libraryName: string };
        const result = await client.resolveLibraryId(p.libraryName);
        return success({
          matches: result,
          message: result.length > 0
            ? `Found ${result.length} matching ${result.length === 1 ? 'library' : 'libraries'}. Use the 'id' field as context7CompatibleLibraryID for get_library_docs.`
            : `No libraries found matching "${p.libraryName}". Try a different search term.`,
        });
      }

      case Actions.GET_LIBRARY_DOCS: {
        const p = validatedPayload as {
          context7CompatibleLibraryID: string;
          topic?: string;
          tokens?: number;
        };
        const result = await client.getLibraryDocs(
          p.context7CompatibleLibraryID,
          {
            topic: p.topic,
            tokens: p.tokens,
          }
        );
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
  return `Context7 documentation operations. Actions: ${actions}. Use action parameter to select operation, payload for action-specific parameters. Provides up-to-date, version-specific library documentation.`;
}

export function registerTools(server: McpServer): void {
  server.tool(
    "context7",
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
