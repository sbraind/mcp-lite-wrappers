# Swarm Orchestrator

Multi-agent orchestration for parallel issue execution with Claude Code.

Swarm Orchestrator enables teams to execute multiple Linear issues simultaneously using isolated Claude Code agents in Git worktrees. Each agent works independently while the orchestrator handles conflict detection, knowledge sharing, and merge coordination.

## Installation

### Global Installation

```bash
npm install -g swarm-orchestrator
```

### Run Without Installing

```bash
npx swarm-orchestrator
```

## Quick Start

### 1. Initialize Swarm Configuration

```bash
swarm init
```

Creates `.swarm/config.json` with your team settings.

### 2. Bootstrap Knowledge Base

```bash
swarm bootstrap
```

Analyzes your codebase and creates a shared knowledge base for all agents.

### 3. Get Issue Suggestions

```bash
swarm suggest
```

Analyzes your Linear backlog and recommends parallelizable issues.

### 4. Start Parallel Execution

```bash
swarm start BT-42 BT-10 BT-62
```

Launches isolated agents in Git worktrees to work on multiple issues simultaneously.

### 5. Monitor Progress

```bash
swarm monitor
```

Real-time dashboard showing agent progress, conflicts, and completion status.

### 6. Merge Completed Work

```bash
swarm merge
```

Intelligently merges completed branches, handling conflicts and cleanup.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LINEAR_API_KEY` | Linear API key for issue management | Yes |
| `LINEAR_TEAM_ID` | Your Linear team ID | Yes |

### Setup

```bash
export LINEAR_API_KEY="lin_api_..."
export LINEAR_TEAM_ID="your-team-id"
```

Or create a `.env` file in your project root:

```env
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=your-team-id
```

## Features

### Knowledge Base Learning

- Automatically analyzes codebase structure and patterns
- Shares learnings across all agents via `.swarm/knowledge/`
- Updates dynamically as work progresses

### Overlap Detection

- Identifies file and function-level conflicts before they occur
- Assigns non-overlapping issues to parallel agents
- Warns when potential conflicts are detected

### Conflict Resolution

- Tracks changes across all active worktrees
- Provides guided merge strategies
- Maintains audit trail of all agent decisions

### Intelligent Orchestration

- Prioritizes issues based on dependencies and risk
- Balances workload across available agents
- Handles agent failures and restarts gracefully

## How It Works

1. **Worktree Isolation**: Each agent runs in a separate Git worktree with its own branch
2. **Shared Knowledge**: All agents read from a central knowledge base and contribute learnings
3. **Conflict Tracking**: The orchestrator monitors file changes and flags potential conflicts
4. **Coordinated Merging**: Completed work is merged in dependency order with conflict resolution

## Project Structure

```
.swarm/
├── config.json           # Swarm configuration
├── knowledge/            # Shared knowledge base
│   ├── codebase.json    # Codebase structure
│   ├── patterns.json    # Learned patterns
│   └── decisions.json   # Architecture decisions
├── worktrees/           # Active agent worktrees
└── logs/                # Agent execution logs
```

## Requirements

- Node.js >= 18
- Git >= 2.5 (for worktree support)
- Linear account with API access
- Claude Code CLI installed

## License

MIT

## Author

sbraind9 <sebastianbrain@gmail.com>
