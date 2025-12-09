---
name: mcp-tool-pattern
description: Use when implementing MCP tools with the single-action pattern. Ensures consistent structure across all wrapper packages.
---

# MCP Single-Action Tool Pattern

## When to Use
- Creating a new MCP wrapper package
- Adding actions to existing wrapper
- Refactoring multi-tool MCP to single-action

## Structure Checklist

### 1. Define Action Enum
```typescript
// src/types.ts
export const Actions = {
  EXECUTE_SQL: "execute_sql",
  LIST_TABLES: "list_tables",
  // ... all actions
} as const;

export const ActionSchema = z.enum([
  Actions.EXECUTE_SQL,
  Actions.LIST_TABLES,
  // ...
]);
```

### 2. Define Payloads per Action
```typescript
// src/types.ts
export const PayloadSchemas = {
  [Actions.EXECUTE_SQL]: z.object({
    query: z.string().describe("SQL query to execute"),
    project_id: z.string().optional()
  }),
  [Actions.LIST_TABLES]: z.object({
    schemas: z.array(z.string()).default(["public"])
  }),
  // ...
};
```

### 3. Create Action Handlers
```typescript
// src/handlers/execute-sql.ts
export async function handleExecuteSql(
  payload: z.infer<typeof PayloadSchemas.execute_sql>,
  context: Context
): Promise<ToolResult> {
  // Implementation
}
```

### 4. Register Single Tool
```typescript
// src/index.ts
server.tool(
  "supabase", // or "linear"
  buildDescription(), // Generate from actions
  {
    action: ActionSchema,
    ...buildPayloadSchema() // Dynamic based on action
  },
  async (args) => dispatch(args)
);
```

### 5. Build Compact Description
```typescript
function buildDescription(): string {
  return `Supabase operations. Actions: ${Object.values(Actions).join(", ")}.
Use action parameter to select operation.`;
}
```

## Anti-Patterns to Avoid

- Don't register multiple tools
- Don't put full docs in description (use help action)
- Don't duplicate payload validation in handler
- Don't hardcode project_id (use env or payload)
