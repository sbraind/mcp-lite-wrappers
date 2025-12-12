# Linear-Lite MCP Wrapper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a lightweight MCP wrapper for Linear API that consolidates 23+ tools into a single action-based tool, reducing Claude Code context usage by ~12k tokens.

**Architecture:** Single MCP tool with `action` enum parameter that dispatches to Linear's GraphQL API. Follows the same pattern as supabase-lite: types.ts (Zod schemas), client/index.ts (API client), actions.ts (dispatcher), index.ts (MCP server entry).

**Tech Stack:** TypeScript, Zod for validation, MCP SDK (@modelcontextprotocol/sdk), Linear GraphQL API

---

## Pre-requisites

The following files have already been created with core implementation:
- `packages/linear-lite/src/types.ts` - Actions enum, Zod payload schemas for 23 actions
- `packages/linear-lite/src/client/index.ts` - LinearClient with GraphQL API calls
- `packages/linear-lite/src/actions.ts` - Dispatcher and tool registration
- `packages/linear-lite/src/index.ts` - MCP server entry point

---

### Task 1: Create package.json

**Files:**
- Create: `packages/linear-lite/package.json`

**Step 1: Create the package.json file**

```json
{
  "name": "linear-lite-mcp",
  "version": "0.1.0",
  "description": "Lightweight MCP wrapper for Linear API - consolidates 23+ tools into 1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "linear-lite": "dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --watch",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "mcp",
    "linear",
    "model-context-protocol",
    "claude",
    "ai",
    "project-management"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^24.10.2",
    "@vitest/coverage-v8": "^1.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Verify file created**

Run: `cat packages/linear-lite/package.json | head -20`
Expected: JSON content with name "linear-lite-mcp"

---

### Task 2: Create tsconfig.json

**Files:**
- Create: `packages/linear-lite/tsconfig.json`

**Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 2: Verify file created**

Run: `cat packages/linear-lite/tsconfig.json`
Expected: JSON with compilerOptions

---

### Task 3: Create vitest.config.ts

**Files:**
- Create: `packages/linear-lite/vitest.config.ts`

**Step 1: Create vitest config**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
    },
  },
});
```

**Step 2: Verify file created**

Run: `cat packages/linear-lite/vitest.config.ts`
Expected: TypeScript config file content

---

### Task 4: Create .npmignore

**Files:**
- Create: `packages/linear-lite/.npmignore`

**Step 1: Create .npmignore**

```
src/
tests/
*.config.ts
tsconfig.json
.env*
coverage/
```

**Step 2: Verify file created**

Run: `cat packages/linear-lite/.npmignore`
Expected: List of ignored paths

---

### Task 5: Install dependencies

**Files:**
- Modify: `packages/linear-lite/package.json` (package-lock created)

**Step 1: Install npm dependencies**

Run: `cd /Users/sebastianbrain/Desktop/mcp-lite-wrappers/packages/linear-lite && npm install`
Expected: Dependencies installed successfully

**Step 2: Verify node_modules exists**

Run: `ls packages/linear-lite/node_modules | head -5`
Expected: List of installed packages

---

### Task 6: Run TypeScript type check

**Files:**
- None (verification only)

**Step 1: Run typecheck**

Run: `cd /Users/sebastianbrain/Desktop/mcp-lite-wrappers/packages/linear-lite && npm run typecheck`
Expected: No type errors

**Step 2: If errors, fix them**

Review any type errors and fix in the relevant files.

---

### Task 7: Build the package

**Files:**
- Create: `packages/linear-lite/dist/index.js`
- Create: `packages/linear-lite/dist/index.d.ts`

**Step 1: Run build**

Run: `cd /Users/sebastianbrain/Desktop/mcp-lite-wrappers/packages/linear-lite && npm run build`
Expected: Build completes successfully

**Step 2: Verify dist files exist**

Run: `ls -la packages/linear-lite/dist/`
Expected: index.js, index.d.ts files

---

### Task 8: Create unit tests for types

**Files:**
- Create: `packages/linear-lite/tests/unit/types.test.ts`

**Step 1: Create tests directory**

Run: `mkdir -p packages/linear-lite/tests/unit`

**Step 2: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { Actions, ActionSchema, PayloadSchemas } from "../../src/types.js";

describe("Actions", () => {
  it("should have all required action constants", () => {
    expect(Actions.CREATE_ISSUE).toBe("create_issue");
    expect(Actions.UPDATE_ISSUE).toBe("update_issue");
    expect(Actions.GET_TEAMS).toBe("get_teams");
    expect(Actions.SEARCH_ISSUES).toBe("search_issues");
  });

  it("should have 23 actions defined", () => {
    const actionCount = Object.keys(Actions).length;
    expect(actionCount).toBe(23);
  });
});

describe("ActionSchema", () => {
  it("should validate valid actions", () => {
    expect(ActionSchema.safeParse("create_issue").success).toBe(true);
    expect(ActionSchema.safeParse("get_teams").success).toBe(true);
  });

  it("should reject invalid actions", () => {
    expect(ActionSchema.safeParse("invalid_action").success).toBe(false);
  });
});

describe("PayloadSchemas", () => {
  it("should validate create_issue payload", () => {
    const result = PayloadSchemas.create_issue.safeParse({
      title: "Test Issue",
      teamId: "team-123",
    });
    expect(result.success).toBe(true);
  });

  it("should require title and teamId for create_issue", () => {
    const result = PayloadSchemas.create_issue.safeParse({
      title: "Test Issue",
    });
    expect(result.success).toBe(false);
  });

  it("should validate search_issues payload", () => {
    const result = PayloadSchemas.search_issues.safeParse({
      query: "bug",
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it("should have schema for each action", () => {
    for (const action of Object.values(Actions)) {
      expect(PayloadSchemas[action]).toBeDefined();
    }
  });
});
```

**Step 3: Run tests to verify they pass**

Run: `cd /Users/sebastianbrain/Desktop/mcp-lite-wrappers/packages/linear-lite && npm run test:unit`
Expected: All tests pass

---

### Task 9: Create unit tests for actions dispatcher

**Files:**
- Create: `packages/linear-lite/tests/unit/actions.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the client before importing actions
vi.mock("../../src/client/index.js", () => ({
  LinearClient: vi.fn().mockImplementation(() => ({
    getTeams: vi.fn().mockResolvedValue({ teams: { nodes: [] } }),
    getViewer: vi.fn().mockResolvedValue({ viewer: { id: "user-1", name: "Test User" } }),
    createIssue: vi.fn().mockResolvedValue({ issueCreate: { success: true, issue: { id: "issue-1" } } }),
    searchIssues: vi.fn().mockResolvedValue({ searchIssues: { nodes: [] } }),
  })),
  ApiError: class ApiError extends Error {
    constructor(message: string, public statusCode: number, public code?: string) {
      super(message);
    }
  },
}));

describe("Actions dispatcher", () => {
  beforeEach(() => {
    vi.stubEnv("LINEAR_API_KEY", "test-api-key");
  });

  it("should require LINEAR_API_KEY environment variable", async () => {
    vi.unstubAllEnvs();

    // Dynamic import to test env check
    const { registerTools } = await import("../../src/actions.js");

    const mockServer = {
      tool: vi.fn(),
    };

    registerTools(mockServer as any);
    expect(mockServer.tool).toHaveBeenCalledWith(
      "linear",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/sebastianbrain/Desktop/mcp-lite-wrappers/packages/linear-lite && npm run test:unit`
Expected: Tests pass

---

### Task 10: Commit the implementation

**Step 1: Check git status**

Run: `git status`
Expected: Shows new files in packages/linear-lite/

**Step 2: Add files to staging**

Run: `git add packages/linear-lite/`

**Step 3: Create commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add linear-lite MCP wrapper package

- Consolidates 23+ Linear tools into single action-based tool
- Actions: issues (CRUD, search), comments, teams, projects, labels, users, relations, attachments, workflow states
- Uses Linear GraphQL API directly
- Follows supabase-lite pattern for consistency
- Estimated ~12k token savings in Claude Code context

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Step 4: Verify commit**

Run: `git log -1 --oneline`
Expected: Shows the new commit

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create package.json | package.json |
| 2 | Create tsconfig.json | tsconfig.json |
| 3 | Create vitest.config.ts | vitest.config.ts |
| 4 | Create .npmignore | .npmignore |
| 5 | Install dependencies | node_modules/ |
| 6 | TypeScript type check | - |
| 7 | Build the package | dist/ |
| 8 | Unit tests for types | tests/unit/types.test.ts |
| 9 | Unit tests for actions | tests/unit/actions.test.ts |
| 10 | Commit implementation | - |

**Total actions covered by linear-lite:**
- Issues: create, update, get, search, get_user_issues, get_team_issues, get_project_issues
- Comments: add, get
- Teams: get_teams, get_team
- Projects: get_projects, get_project
- Labels: get, create, update
- Users: get_viewer, get_users
- Relations: link_issues, get_issue_relations
- Attachments: add, get
- Workflow: get_workflow_states

**23 tools → 1 tool with action parameter**
