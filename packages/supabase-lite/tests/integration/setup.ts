import { beforeAll, afterAll } from "vitest";

// Verify required environment variables
beforeAll(() => {
  const required = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for integration tests: ${missing.join(", ")}\n` +
        "Set these in your environment or create a .env.test file."
    );
  }

  console.log("Integration test setup complete");
  console.log(`Project ref: ${process.env.SUPABASE_PROJECT_REF}`);
});

afterAll(() => {
  console.log("Integration test teardown complete");
});

// Helper to get config
export function getTestConfig() {
  return {
    accessToken: process.env.SUPABASE_ACCESS_TOKEN!,
    projectRef: process.env.SUPABASE_PROJECT_REF!,
  };
}

// Helper to wait between API calls to avoid rate limits
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test data cleanup tracker
export const cleanupTasks: Array<() => Promise<void>> = [];

export function addCleanupTask(task: () => Promise<void>): void {
  cleanupTasks.push(task);
}

afterAll(async () => {
  // Run cleanup tasks in reverse order
  for (const task of cleanupTasks.reverse()) {
    try {
      await task();
    } catch (error) {
      console.warn("Cleanup task failed:", error);
    }
  }
  cleanupTasks.length = 0;
});
