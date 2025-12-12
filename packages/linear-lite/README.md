# linear-lite-mcp

Lightweight MCP (Model Context Protocol) wrapper for the Linear API. Consolidates 23+ Linear tools into a single action-based tool, reducing Claude Code context usage by ~12k tokens.

## Installation

```bash
npm install linear-lite-mcp
```

Or run directly with npx:
```bash
npx linear-lite-mcp
```

## Configuration

Set your Linear API key as an environment variable:

```bash
export LINEAR_API_KEY="lin_api_xxxxx"
```

Get your API key from [Linear Settings > API](https://linear.app/settings/api).

## Usage with Claude Code

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["linear-lite-mcp"],
      "env": {
        "LINEAR_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Actions

The tool exposes a single `linear` tool with an `action` parameter. Available actions:

### Issues
| Action | Description |
|--------|-------------|
| `create_issue` | Create a new issue |
| `update_issue` | Update an existing issue |
| `get_issue` | Get issue details |
| `search_issues` | Search issues by text |
| `get_user_issues` | Get issues assigned to a user |
| `get_team_issues` | Get issues for a team |
| `get_project_issues` | Get issues for a project |

### Comments
| Action | Description |
|--------|-------------|
| `add_comment` | Add a comment to an issue |
| `get_comments` | Get comments for an issue |

### Teams
| Action | Description |
|--------|-------------|
| `get_teams` | List all teams |
| `get_team` | Get team details |

### Projects
| Action | Description |
|--------|-------------|
| `get_projects` | List all projects |
| `get_project` | Get project details |

### Labels
| Action | Description |
|--------|-------------|
| `get_labels` | List labels |
| `create_label` | Create a new label |
| `update_label` | Update a label |

### Users
| Action | Description |
|--------|-------------|
| `get_viewer` | Get current authenticated user |
| `get_users` | List all users |

### Issue Relations
| Action | Description |
|--------|-------------|
| `link_issues` | Create a relationship between issues |
| `get_issue_relations` | Get issue relationships |

### Attachments
| Action | Description |
|--------|-------------|
| `add_attachment` | Add an attachment to an issue |
| `get_attachments` | Get attachments for an issue |

### Workflow
| Action | Description |
|--------|-------------|
| `get_workflow_states` | Get workflow states for a team |

## Example Usage

```javascript
// Create an issue
{
  "action": "create_issue",
  "payload": {
    "title": "Fix login bug",
    "teamId": "TEAM-ID",
    "description": "Users cannot login with SSO",
    "priority": 1
  }
}

// Search issues
{
  "action": "search_issues",
  "payload": {
    "query": "login bug",
    "limit": 10
  }
}

// Get teams
{
  "action": "get_teams",
  "payload": {}
}
```

## Priority Levels

| Value | Level |
|-------|-------|
| 0 | No priority |
| 1 | Urgent |
| 2 | High |
| 3 | Medium |
| 4 | Low |

## Relation Types

For `link_issues` action:
- `blocks` / `blocked_by`
- `related`
- `duplicate` / `duplicates` / `is_duplicated_by`

## License

MIT
