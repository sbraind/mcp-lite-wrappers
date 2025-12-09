# CLAUDE.md — MCP Lite Wrappers

## Project Goal

Create lightweight MCP wrapper plugins that consolidate multiple tools into single-action tools, reducing Claude Code context usage by ~80%.

## Architecture Pattern

Follow the **superpowers-chrome** pattern:
- Single tool with `action` enum parameter
- Switch/dispatch based on action
- Proxy calls to underlying MCP or API

Reference: https://github.com/obra/superpowers-chrome

## Packages

| Package | Wraps | Tools → 1 | Est. Savings |
|---------|-------|-----------|--------------|
| `supabase-lite` | supabase-community/supabase-mcp | 20 → 1 | ~11k tokens |
| `linear-lite` | Linear MCP | 23 → 1 | ~12k tokens |

## Tech Stack

- TypeScript
- Zod for validation
- MCP SDK (@modelcontextprotocol/sdk)
- Zero external dependencies beyond MCP

## Structure

```
packages/
├── supabase-lite/
│   ├── src/
│   │   ├── index.ts      # MCP server entry
│   │   ├── actions.ts    # Action dispatcher
│   │   └── types.ts      # Zod schemas
│   └── package.json
└── linear-lite/
    └── (same structure)
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```

## Key References

- superpowers-chrome (pattern): https://github.com/obra/superpowers-chrome
- supabase-mcp (to wrap): https://github.com/supabase-community/supabase-mcp
- MCP SDK: https://github.com/modelcontextprotocol/typescript-sdk
