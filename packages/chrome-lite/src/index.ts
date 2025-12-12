#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools, cleanup } from "./actions.js";

const server = new McpServer(
  { name: "chrome-lite", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

registerTools(server);

// Handle graceful shutdown
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

const transport = new StdioServerTransport();
await server.connect(transport);
