# MCP Lite Wrappers

Lightweight MCP wrapper plugins that consolidate multiple tools into single-action tools, reducing Claude Code context usage by ~80%.

## Problem

MCP servers expose many individual tools, each consuming context tokens. For example, `supabase-mcp` exposes 20+ tools, using ~11k tokens just for tool definitions.

## Solution

Wrap multiple tools into a single tool with an `action` parameter. One tool, one description, massive token savings.

```
Before: 20 tools × ~500 tokens = ~10,000 tokens
After:  1 tool  × ~1,000 tokens = ~1,000 tokens
Savings: ~80%
```

## Packages

| Package | Wraps | Tools → 1 | Est. Savings |
|---------|-------|-----------|--------------|
| [`supabase-lite-mcp`](https://www.npmjs.com/package/supabase-lite-mcp) | [supabase-mcp](https://github.com/supabase-community/supabase-mcp) | 30 → 1 | ~11k tokens |
| `linear-lite-mcp` | Linear MCP | 23 → 1 | ~12k tokens (planned) |

## Installation

### supabase-lite-mcp

```bash
npm install supabase-lite-mcp
```

Add to your Claude Code MCP config (`.mcp.json`):

```json
{
  "mcpServers": {
    "supabase-lite": {
      "command": "npx",
      "args": ["supabase-lite-mcp"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your-access-token",
        "SUPABASE_PROJECT_REF": "your-project-ref"
      }
    }
  }
}
```

## Usage

All actions go through a single `supabase` tool:

```typescript
// List projects
{ action: "list_projects" }

// Execute SQL
{ action: "execute_sql", payload: { query: "SELECT * FROM users" } }

// Deploy edge function
{ action: "deploy_edge_function", payload: { slug: "my-func", code: "..." } }
```

### Available Actions

**Projects & Organizations**
- `list_projects`, `get_project`, `create_project`, `pause_project`, `restore_project`
- `list_organizations`, `get_organization`

**Cost Management**
- `get_cost`, `confirm_cost`

**Database**
- `execute_sql`, `list_tables`, `list_extensions`
- `list_migrations`, `apply_migration`

**Monitoring**
- `get_logs`, `get_advisors`

**Project Info**
- `get_project_url`, `get_publishable_keys`, `generate_typescript_types`

**Edge Functions**
- `list_edge_functions`, `get_edge_function`, `deploy_edge_function`

**Branching**
- `create_branch`, `list_branches`, `delete_branch`
- `merge_branch`, `reset_branch`, `rebase_branch`

**Storage**
- `list_storage_buckets`, `get_storage_config`, `update_storage_config`

**Documentation**
- `search_docs`

## Architecture

Follows the [superpowers-chrome](https://github.com/obra/superpowers-chrome) pattern:

1. Single tool with `action` enum parameter
2. Switch/dispatch based on action
3. Proxy calls to underlying Supabase Management API

```
packages/
├── supabase-lite/
│   ├── src/
│   │   ├── index.ts      # MCP server entry
│   │   ├── actions.ts    # Action dispatcher
│   │   ├── types.ts      # Zod schemas
│   │   └── client/       # Supabase API client
│   └── package.json
└── linear-lite/          # (planned)
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## Tech Stack

- TypeScript
- Zod for validation
- MCP SDK (@modelcontextprotocol/sdk)
- Zero external dependencies beyond MCP

## License

MIT

## References

- [superpowers-chrome](https://github.com/obra/superpowers-chrome) - Pattern reference
- [supabase-mcp](https://github.com/supabase-community/supabase-mcp) - Original MCP being wrapped
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Model Context Protocol SDK
