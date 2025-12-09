---
name: package-setup
description: Use when creating a new MCP wrapper package. Standardizes package.json, tsconfig, and build setup.
---

# Package Setup Skill

## When to Use
- Creating new package in packages/
- Setting up build tooling
- Configuring TypeScript

## Package Structure

```
packages/[name]-lite/
├── src/
│   ├── index.ts        # MCP server entry
│   ├── types.ts        # Zod schemas & types
│   ├── actions.ts      # Action dispatcher
│   ├── handlers/       # One file per action group
│   │   ├── database.ts
│   │   ├── functions.ts
│   │   └── ...
│   └── client/         # API client
│       └── index.ts
├── tests/
│   ├── actions.test.ts
│   └── handlers/
├── package.json
├── tsconfig.json
└── README.md
```

## package.json Template

```json
{
  "name": "@mcp-lite/[name]-lite",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "[name]-lite": "dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

## tsconfig.json Template

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Entry Point Template

```typescript
#!/usr/bin/env node
// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./actions.js";

const server = new Server(
  { name: "[name]-lite", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

registerTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```
