---
name: swarm
description: Multi-agent orchestration for parallel issue execution. Use when user wants to work on multiple Linear issues simultaneously with multiple Claude Code instances.
---

# Swarm: Multi-Agent Orchestration System

Execute multiple Linear issues in parallel using separate Claude Code instances, with intelligent overlap detection and learning from historical patterns.

## Quick Start

```bash
# Initialize (first time only)
swarm init
swarm bootstrap

# Get batch suggestions (recommended first step)
LINEAR_API_KEY='your_key' swarm suggest

# Start swarm with suggested batch
swarm start BT-101 BT-102 BT-103

# Monitor progress
swarm monitor

# Merge when complete
swarm merge
```

## When to Use

Use `/swarm` when:
- User has 2-5 independent issues to work on
- Issues have low predicted overlap
- User wants to parallelize work across terminals
- User says "work on these in parallel" or "swarm mode"

Do NOT use when:
- Single issue
- Issues have high dependency (must be sequential)
- Issues modify same critical files

## Batch Suggestion (Phase 0)

Before starting a swarm, use `suggest` to find optimal issue groupings:

```bash
# Fetch Todo issues and suggest batches
LINEAR_API_KEY='...' swarm suggest

# Options
--status <status>    Filter by status (default: Todo)
--max-batch <n>      Max issues per batch (default: 3)
--num-batches <n>    Number of batches to suggest (default: 3)
```

### Assignee Preference

Suggest prioritizes issues you can work on:
- 👤 **Mine** (1.0) - Assigned to you, highest priority
- 🔓 **Unassigned** (0.9) - Available for pickup
- ➡️ **Others** (0.3) - Assigned to others, low priority

### What Suggest Analyzes

1. **File Overlap (40%)**: Issues touching different files score higher
2. **Layer Independence (25%)**: UI + API + DB is better than UI + UI + UI
3. **Complexity Balance (15%)**: Mix medium with medium, not trivial with complex
4. **Priority Alignment (10%)**: P1 + P2 is better than P1 + P4
5. **Historical Conflicts (10%)**: Avoid files that conflicted before

### Example Output

```
Found 35 issues: 20 mine, 8 unassigned, 7 others

┌───────────────────────────────────────────────────────────┐
│ 📊 BATCH 1 (Recommended) - Score: 93%                     │
├───────────────────────────────────────────────────────────┤
│ Issues: BT-88, BT-56, BT-31                               │
│ Est: 1080min total → 480min parallel                      │
│ Risk: 🟢 LOW                                             │
├───────────────────────────────────────────────────────────┤
│ Why this works:                                           │
│   ✓ Zero predicted file overlap                           │
│   ✓ Different layers: hooks, database, ui                 │
├───────────────────────────────────────────────────────────┤
│ BT-88: Backfill existing prompts...        👤 Mine [P2]  │
│ BT-56: AI Search Blending...               👤 Mine [P3]  │
│ BT-31: Evals                               👤 Mine [P3]  │
└───────────────────────────────────────────────────────────┘
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SWARM ORCHESTRATOR                       │
│                    (Main Terminal)                          │
├─────────────────────────────────────────────────────────────┤
│  1. Fetch issues from Linear                               │
│  2. Analyze overlap using Knowledge Base                   │
│  3. Create git worktrees + branches                        │
│  4. Distribute issues to workers                           │
│  5. Monitor progress via heartbeats                        │
│  6. Coordinate merge sequence                              │
│  7. Capture outcomes for learning                          │
└─────────────────────────────────────────────────────────────┘
        │
        │ Creates worktrees
        ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│Worker 1 │ │Worker 2 │ │Worker 3 │ │Worker 4 │ │Worker 5 │
│Terminal │ │Terminal │ │Terminal │ │Terminal │ │Terminal │
│  2      │ │  3      │ │  4      │ │  5      │ │  6      │
└─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
```

## Workflow Phases

### Phase 1: Analysis
- Load Knowledge Base (historical patterns)
- Predict affected files for each issue
- Build overlap matrix
- Recommend: `proceed` | `reorder` | `sequential`

### Phase 2: Planning
- Create patterns for each issue
- Extract keywords and file hints
- Generate predictions (cold start or learned)

### Phase 3: Preparation
- Create git worktrees (isolated directories)
- Create feature branches
- Write worker config files

### Phase 4: Execution (User-driven)
- User opens terminals
- Each worker runs Claude Code in its worktree
- Workers update heartbeats
- Orchestrator monitors progress

### Phase 5: Merge
- Verify all workers completed
- Merge branches in order
- Capture outcomes for learning
- Cleanup worktrees
- **Update Linear issues to "In Review"** (not "Done" - requires human review)

### Linear Workflow

Issues completed via Swarm follow this status progression:
```
Todo → In Progress → In Review → Done
                     ↑
              Swarm sets this
```

**IMPORTANT:** Swarm sets issues to "In Review" after merge, NOT "Done".
The human reviews the implementation and moves to "Done" after validation.

## Learning System

The swarm learns from every execution:

### What It Learns
1. **File associations**: keyword → files mapping
2. **Conflict patterns**: which files often conflict
3. **Time estimates**: actual vs predicted duration
4. **Accuracy scores**: precision and recall of predictions

### Knowledge Base Structure
```
.claude/swarm/kb/
├── patterns.jsonl       # Issue patterns (append-only)
├── file-associations.jsonl  # Keyword → file mappings
├── conflict-pairs.jsonl # File conflict history
├── metrics.json         # Accuracy tracking
└── index.json           # Inverted index for search
```

### Cold Start Heuristics
When KB has few patterns, uses keyword-based heuristics:
- `auth` → `**/auth/**`, `**/login/**`
- `button` → `**/components/**/*Button*`
- `api` → `**/api/**`, `**/services/**`
- etc.

### Prediction Confidence Ladder
```
< 5 patterns  → Cold start (heuristics only)
5-20 patterns → Low confidence (heuristics + some learning)
20-50 patterns → Medium confidence
> 50 patterns → High confidence (learned patterns)
```

## Worker Protocol

Each worker MUST follow this protocol:

### On Start
```typescript
// Read worker config
const config = JSON.parse(fs.readFileSync('.claude/swarm/worker.json'));

// Update status
worker.updateStatus({
  status: 'initializing',
  currentStep: 'Starting',
  completedSteps: 0,
  totalSteps: 0
});
```

### During Execution
```typescript
// Report progress periodically
worker.reportProgress('Implementing feature X', 3, 10);

// Use skills as normal
// /ultra-think for analysis
// /superpowers:write-plan for planning
// /superpowers:execute-plan for implementation
```

### On Complete
```typescript
// Commit changes
git add . && git commit -m "[SWARM] BT-101: Feature implementation"

// Mark complete
worker.complete();
```

### On Failure
```typescript
worker.fail('Error description');
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize swarm system |
| `bootstrap` | Bootstrap KB from git history |
| `suggest` | Suggest optimal batches from Linear issues |
| `start <issues>` | Start swarm with issues |
| `monitor` | Monitor active swarm |
| `merge` | Merge completed branches |
| `stats` | Show KB statistics |
| `predict <title>` | Predict files for issue |
| `clean` | Clean up artifacts |

## Execution Modes

After `start` creates worktrees, choose how to execute:

**"Swarm ready. Two execution options:**

### 1. Subagent-Driven (this session)
Dispatch fresh subagent per issue via Task tool. Fast iteration, stays in current session.

```typescript
// Orchestrator dispatches parallel agents
Task("Work on BT-88 in /path/to/worker-1", subagent_type: "fullstack-developer")
Task("Work on BT-77 in /path/to/worker-2", subagent_type: "fullstack-developer")
```

**Pros:** No terminal switching, automatic coordination
**Cons:** Shares context budget, less visibility

### 2. Parallel Sessions (separate terminals)
Open new Claude Code sessions in each worktree. Manual but more control.

**Steps:**
1. Open N new terminals in Cursor (Cmd+Shift+`)
2. In each terminal, cd to the worktree and start claude with explicit workflow:
   ```bash
   cd /path/to/swarm-worktrees/worker-1
   claude "Work on BT-88. Read .claude/swarm/worker.json and follow guidance.workflow. Use /ultra-think and /superpowers:write-plan."
   ```
3. Monitor from orchestrator terminal
4. Merge when all complete

**Worker Prompt Template:**
```
Work on [ISSUE_ID]. Read .claude/swarm/worker.json and follow the guidance.workflow steps.

MANDATORY WORKFLOW:
1. /ultra-think - Deep analysis before coding
2. /superpowers:write-plan - Create implementation plan
3. /superpowers:execute-plan - Implement with SUBAGENTS

SUBAGENT USAGE (REQUIRED for parallel acceleration):
- When plan has 2+ independent tasks → dispatch parallel subagents
- Example: Task("Create hook", subagent_type: "frontend-developer", run_in_background: true)
- Wait for results with TaskOutput before continuing

4. Run tests: npm run test:smoke && npm run typecheck
5. Commit with issue reference [ISSUE_ID]
```

**Pros:** Full context per worker, visible progress
**Cons:** Manual terminal management

**Which approach?"**

## Worker Acceleration with Subagents

**CRITICAL:** Each worker MUST use subagents internally to achieve parallel acceleration.

### When to Use Subagents (Decision Rules)

| Situation | Action |
|-----------|--------|
| Plan has 2+ independent tasks | Launch parallel subagents |
| Need to create 2+ files | Parallel file creation |
| Implementation done | Launch code-reviewer subagent |
| Need tests | Launch test-automator subagent |
| Need research while coding | Background Explore subagent |

### How to Launch Subagents

```typescript
// PARALLEL EXECUTION (run_in_background: true)
Task("Create component", subagent_type: "frontend-developer", run_in_background: true)
Task("Create tests", subagent_type: "test-automator", run_in_background: true)

// Wait for all to complete
TaskOutput({ task_id: "component_task_id" })
TaskOutput({ task_id: "tests_task_id" })
```

### Worker Config Reference

The `worker.json` includes guidance:

```json
{
  "guidance": {
    "useSubagents": true,
    "workflow": [
      "1. /ultra-think - analyze problem",
      "2. /superpowers:write-plan - create plan",
      "3. /superpowers:execute-plan - implement WITH SUBAGENTS",
      "4. Run tests",
      "5. Commit"
    ]
  }
}
```

### Subagent Patterns for Workers

Workers MUST use subagents for:

1. **Parallel File Operations**
   ```typescript
   // Create multiple files in parallel
   Task("Create component file", subagent_type: "frontend-developer", run_in_background: true)
   Task("Create test file", subagent_type: "test-automator", run_in_background: true)
   Task("Create types file", subagent_type: "typescript-pro", run_in_background: true)
   ```

2. **Code Review After Implementation**
   ```typescript
   // Review changes before committing
   Task("Review the implementation for quality and security", subagent_type: "code-reviewer")
   ```

3. **Test Generation**
   ```typescript
   // Generate unit tests for the new hook
   Task("Generate unit tests for the new hook", subagent_type: "test-automator")
   ```

4. **Research + Implementation Split**
   ```typescript
   // Research while implementing
   Task("Research best practices for X", subagent_type: "Explore", run_in_background: true)
   // Continue with implementation using existing knowledge
   ```

### Nested Parallelism

The swarm operates at two levels:
- **Level 1 (Swarm)**: Multiple workers on different issues
- **Level 2 (Worker)**: Each worker uses subagents for subtasks

This creates exponential acceleration:
- 3 workers × 3 parallel subagents each = up to 9x parallelism

## Example Session

```bash
# Terminal 1 (Orchestrator)

# Step 1: Get suggestions
LINEAR_API_KEY='...' swarm suggest
# Output shows 3 recommended batches with compatibility scores

# Step 2: Start the recommended batch
swarm start BT-88 BT-77

# Output shows:
# 📍 Base branch: main
# 📊 PHASE 1: ANALYSIS
# Knowledge Base: 47 patterns
# Analyzing BT-101: Add dark mode toggle
#    Found 3 similar patterns (learned)
# ...
# 🔧 PHASE 3: PREPARATION
# Creating worktree for BT-101...
# ...
# 🐝 SWARM READY - Open terminals:
#
# 📌 WORKER 1 (BT-101):
#    cd ../swarm-worktrees/worker-1
#    claude "Work on BT-101..."

# Terminal 2 (Worker 1)
cd ../swarm-worktrees/worker-1
claude "Work on BT-101. Read .claude/swarm/worker.json"

# Terminal 3 (Worker 2)
cd ../swarm-worktrees/worker-2
claude "Work on BT-102. Read .claude/swarm/worker.json"

# Terminal 4 (Worker 3)
cd ../swarm-worktrees/worker-3
claude "Work on BT-103. Read .claude/swarm/worker.json"

# Back to Terminal 1 (Monitor)
swarm monitor

# When all complete:
swarm merge
```

## Configuration

Edit `.claude/swarm/config.json`:

```json
{
  "maxWorkers": 5,
  "heartbeatIntervalMs": 30000,
  "heartbeatTimeoutMs": 120000,
  "worktreeBaseDir": "../swarm-worktrees",
  "branchPrefix": "swarm/",
  "learning": {
    "enabled": true,
    "minPatternsForPrediction": 5,
    "similarPatternsToRetrieve": 5,
    "decayDays": 90
  }
}
```

## Overlap Risk Levels

| Risk | Shared Files | Action |
|------|--------------|--------|
| None | 0 | Proceed |
| Low | 1-2 | Proceed with caution |
| Medium | 3-5 | Consider reordering |
| High | >5 | Run sequentially |

## Best Practices

1. **Start small**: Begin with 2 workers, scale up
2. **Independent issues**: Choose issues that don't touch same files
3. **Commit frequently**: Workers should commit often
4. **Monitor actively**: Check progress periodically
5. **Clean up**: Run `clean` after failed swarms

## Troubleshooting

### Worker timeout
- Check heartbeat interval
- Verify worker is running
- May need to restart worker

### Merge conflicts
- **Interactive resolution via Claude Code**: Conflicts are saved and resolved in conversation
- Uses your Claude Code subscription (no separate API key needed)
- AI analyzes both sides and merges intelligently (not just picking one side)
- You review and approve resolutions before applying

**Conflict Resolution Flow:**
```
swarm merge
    ↓
Conflict detected → Saved to pending-conflicts.json
    ↓
Run /resolve-conflicts in Claude Code
    ↓
Claude analyzes and resolves each conflict
    ↓
git add + git commit
    ↓
Run merge again to continue
```

**No API key required** - uses your Claude Code Max subscription

### Worktree issues
- Run `git worktree prune` to clean stale entries
- Use `clean` command to reset

## Future Enhancements

- [ ] Auto-spawn terminal windows
- [ ] Supabase sync for cross-machine learning
- [x] Smart conflict resolution with LLM (implemented!)
- [ ] Dynamic worker scaling
- [ ] Integration with Linear webhooks
- [ ] Create PRs instead of direct merge (optional flag)
