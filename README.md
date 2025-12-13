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
| [`linear-lite-mcp`](https://www.npmjs.com/package/linear-lite-mcp) | [Linear GraphQL API](https://developers.linear.app/docs/graphql/working-with-the-graphql-api) | 28 → 1 | ~12k tokens |
| [`chrome-lite-mcp`](https://www.npmjs.com/package/chrome-lite-mcp) | [Chrome DevTools](https://github.com/AEscarcha/chrome-devtools-mcp) | 34 → 1 | ~14k tokens |

## Installation

### supabase-lite-mcp

```bash
npm install supabase-lite-mcp
```

Add to your Claude Code MCP config (`~/.claude/settings.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "supabase": {
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

### linear-lite-mcp

```bash
npm install linear-lite-mcp
```

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["linear-lite-mcp"],
      "env": {
        "LINEAR_API_KEY": "lin_api_xxxxx"
      }
    }
  }
}
```

Get your Linear API key from [Linear Settings > API](https://linear.app/settings/api).

### chrome-lite-mcp

```bash
npm install chrome-lite-mcp
```

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "chrome": {
      "command": "npx",
      "args": ["chrome-lite-mcp"],
      "env": {
        "CHROME_PATH": "/path/to/chrome",
        "CHROME_HEADLESS": "true"
      }
    }
  }
}
```

Environment variables (optional):
- `CHROME_PATH` - Path to Chrome executable (auto-detected if not set)
- `CHROME_HEADLESS` - Set to "false" for visible browser (default: headless)

## Usage

### Supabase

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

### Linear

All actions go through a single `linear` tool:

```typescript
// Create an issue
{ action: "create_issue", payload: { title: "Fix bug", teamId: "TEAM-ID" } }

// Search issues
{ action: "search_issues", payload: { query: "login bug", limit: 10 } }

// Get user's teams
{ action: "get_user_teams" }
```

### Linear Available Actions

**Issues**
- `create_issue`, `update_issue`, `get_issue`, `search_issues`
- `get_user_issues`, `get_team_issues`, `get_project_issues`

**Comments**
- `add_comment`, `get_comments`

**Teams & Projects**
- `get_teams`, `get_team`, `get_projects`, `get_project`

**Labels**
- `get_labels`, `create_label`, `update_label`

**Users**
- `get_viewer`, `get_users`, `get_user_teams`, `get_user_projects`

**Issue Relations**
- `link_issues`, `get_issue_relations`

**Attachments**
- `add_attachment`, `get_attachments`

**Workflow & Milestones**
- `get_workflow_states`, `get_milestones`, `create_milestone`, `update_milestone`

### Chrome

All actions go through a single `chrome` tool:

```typescript
// Navigate to a URL with auto-capture (saves .md, .html, .png)
{ action: "navigate_page", payload: { url: "https://example.com", autoCapture: true, outputDir: "./captures" } }

// Click an element
{ action: "click", payload: { selector: "#submit-btn" } }

// Fill a form field
{ action: "fill", payload: { selector: "#email", value: "test@example.com" } }

// Select option from dropdown
{ action: "select", payload: { selector: "#country", value: "US" } }

// Extract content in different formats
{ action: "extract", payload: { selector: ".article", format: "markdown" } }

// Take a screenshot
{ action: "take_screenshot", payload: { fullPage: true } }

// Show browser (switch from headless to visible)
{ action: "show_browser" }

// Set browser profile
{ action: "set_profile", payload: { name: "work", userDataDir: "~/.chrome-profiles/work" } }
```

### Chrome Available Actions

**Input Automation**
- `click`, `drag`, `fill`, `fill_form`, `handle_dialog`, `hover`, `press_key`, `upload_file`, `select`

**Navigation**
- `navigate_page` (with auto-capture support), `new_page`, `list_pages`, `select_page`, `close_page`, `wait_for`

**Emulation**
- `emulate`, `resize_page`

**Performance**
- `performance_start_trace`, `performance_stop_trace`, `performance_analyze_insight`

**Network**
- `get_network_request`, `list_network_requests`

**Extraction & Debugging**
- `extract` (text/html/markdown), `get_attr`, `evaluate_script`, `take_screenshot`, `take_snapshot`, `list_console_messages`, `get_console_message`

**Browser Control**
- `show_browser`, `hide_browser`, `browser_mode`

**Profile Management**
- `set_profile`, `get_profile`

## Architecture

Follows the [superpowers-chrome](https://github.com/obra/superpowers-chrome) pattern:

1. Single tool with `action` enum parameter
2. Switch/dispatch based on action
3. Proxy calls to underlying API (Supabase Management API, Linear GraphQL API)

```
packages/
├── supabase-lite/
│   ├── src/
│   │   ├── index.ts      # MCP server entry
│   │   ├── actions.ts    # Action dispatcher
│   │   ├── types.ts      # Zod schemas
│   │   └── client/       # API client
│   └── package.json
├── linear-lite/
│   ├── src/
│   │   ├── index.ts      # MCP server entry
│   │   ├── actions.ts    # Action dispatcher
│   │   ├── types.ts      # Zod schemas
│   │   └── client/       # GraphQL client
│   └── package.json
└── chrome-lite/
    ├── src/
    │   ├── index.ts      # MCP server entry
    │   ├── actions.ts    # Action dispatcher
    │   ├── types.ts      # Zod schemas
    │   └── browser/      # Puppeteer wrapper
    └── package.json
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
- puppeteer-core (for chrome-lite)

## License

MIT

## References

- [superpowers-chrome](https://github.com/obra/superpowers-chrome) - Pattern reference
- [supabase-mcp](https://github.com/supabase-community/supabase-mcp) - Supabase MCP being wrapped
- [Linear GraphQL API](https://developers.linear.app/docs/graphql/working-with-the-graphql-api) - Linear API documentation
- [Chrome DevTools MCP](https://github.com/AEscarcha/chrome-devtools-mcp) - Chrome DevTools reference
- [Puppeteer](https://pptr.dev/) - Browser automation library
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Model Context Protocol SDK
