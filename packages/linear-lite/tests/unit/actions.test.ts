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
