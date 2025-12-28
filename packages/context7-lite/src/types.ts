import { z } from "zod";

// Action constants
export const Actions = {
  // Library resolution
  RESOLVE_LIBRARY_ID: "resolve_library_id",

  // Documentation retrieval
  GET_LIBRARY_DOCS: "get_library_docs",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

export const ActionSchema = z.enum([
  Actions.RESOLVE_LIBRARY_ID,
  Actions.GET_LIBRARY_DOCS,
]);

// Payload schemas per action
export const PayloadSchemas = {
  [Actions.RESOLVE_LIBRARY_ID]: z.object({
    libraryName: z.string().describe("Name of the library to search for (e.g., 'react', 'next.js', 'typescript')"),
  }),

  [Actions.GET_LIBRARY_DOCS]: z.object({
    context7CompatibleLibraryID: z.string().describe("Context7-compatible library ID (e.g., '/vercel/next.js', '/mongodb/docs'). Must call resolve_library_id first to obtain this."),
    topic: z.string().optional().describe("Focus the docs on a specific topic (e.g., 'routing', 'hooks', 'authentication')"),
    tokens: z.number().optional().default(5000).describe("Maximum number of tokens to return. Default: 5000. Values less than 1000 are automatically increased to 1000."),
  }),
} as const;

// Infer types from schemas
export type ResolveLibraryIdPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.RESOLVE_LIBRARY_ID]>;
export type GetLibraryDocsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_LIBRARY_DOCS]>;

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
