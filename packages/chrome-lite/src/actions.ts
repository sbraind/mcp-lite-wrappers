import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Actions,
  ActionSchema,
  PayloadSchemas,
  ToolResult,
  type ToolInput,
} from "./types.js";
import { BrowserManager, BrowserClient } from "./browser/index.js";
import { shortcutsManager } from "./shortcuts/manager.js";

// Singleton browser manager
let browserManager: BrowserManager | null = null;
let browserClient: BrowserClient | null = null;

function getBrowserClient(): BrowserClient {
  if (!browserManager) {
    // Default to visible browser (headless=false)
    // Set CHROME_HEADLESS=true for CI/CD or server environments
    const headless = process.env.CHROME_HEADLESS === "true";
    browserManager = new BrowserManager({ headless });
  }
  if (!browserClient) {
    browserClient = new BrowserClient(browserManager);
  }
  return browserClient;
}

function success(data: unknown): ToolResult {
  // Handle screenshot data specially to return as image
  if (typeof data === "object" && data !== null && "screenshot" in data) {
    const result = data as { screenshot: string; format: string; outputPath?: string };
    if (!result.outputPath && result.screenshot.length > 100) {
      // It's base64 data, return as image
      return {
        content: [
          {
            type: "image",
            data: result.screenshot,
            mimeType: `image/${result.format === "jpeg" ? "jpeg" : result.format === "webp" ? "webp" : "png"}`,
          },
        ],
      };
    }
  }

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function error(message: string, code?: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: true, message, code }) }],
    isError: true,
  };
}

async function dispatch(input: ToolInput): Promise<ToolResult> {
  const { action, payload = {} } = input;

  try {
    const client = getBrowserClient();

    // Validate and parse payload for the specific action
    const schema = PayloadSchemas[action as keyof typeof PayloadSchemas];
    const validatedPayload = schema.parse(payload);

    switch (action) {
      // ==================== Input Automation ====================
      case Actions.CLICK: {
        const result = await client.click(validatedPayload as Parameters<typeof client.click>[0]);
        return success(result);
      }

      case Actions.DRAG: {
        const result = await client.drag(validatedPayload as Parameters<typeof client.drag>[0]);
        return success(result);
      }

      case Actions.FILL: {
        const result = await client.fill(validatedPayload as Parameters<typeof client.fill>[0]);
        return success(result);
      }

      case Actions.FILL_FORM: {
        const result = await client.fillForm(validatedPayload as Parameters<typeof client.fillForm>[0]);
        return success(result);
      }

      case Actions.HANDLE_DIALOG: {
        const result = await client.handleDialog(validatedPayload as Parameters<typeof client.handleDialog>[0]);
        return success(result);
      }

      case Actions.HOVER: {
        const result = await client.hover(validatedPayload as Parameters<typeof client.hover>[0]);
        return success(result);
      }

      case Actions.PRESS_KEY: {
        const result = await client.pressKey(validatedPayload as Parameters<typeof client.pressKey>[0]);
        return success(result);
      }

      case Actions.UPLOAD_FILE: {
        const result = await client.uploadFile(validatedPayload as Parameters<typeof client.uploadFile>[0]);
        return success(result);
      }

      case Actions.SELECT: {
        const result = await client.select(validatedPayload as Parameters<typeof client.select>[0]);
        return success(result);
      }

      // ==================== Navigation ====================
      case Actions.CLOSE_PAGE: {
        const result = await client.closePage(validatedPayload as Parameters<typeof client.closePage>[0]);
        return success(result);
      }

      case Actions.LIST_PAGES: {
        const result = await client.listPages();
        return success(result);
      }

      case Actions.NAVIGATE_PAGE: {
        const result = await client.navigatePage(validatedPayload as Parameters<typeof client.navigatePage>[0]);
        return success(result);
      }

      case Actions.NEW_PAGE: {
        const result = await client.newPage(validatedPayload as Parameters<typeof client.newPage>[0]);
        return success(result);
      }

      case Actions.SELECT_PAGE: {
        const result = await client.selectPage(validatedPayload as Parameters<typeof client.selectPage>[0]);
        return success(result);
      }

      case Actions.WAIT_FOR: {
        const result = await client.waitFor(validatedPayload as Parameters<typeof client.waitFor>[0]);
        return success(result);
      }

      // ==================== Emulation ====================
      case Actions.EMULATE: {
        const result = await client.emulate(validatedPayload as Parameters<typeof client.emulate>[0]);
        return success(result);
      }

      case Actions.RESIZE_PAGE: {
        const result = await client.resizePage(validatedPayload as Parameters<typeof client.resizePage>[0]);
        return success(result);
      }

      // ==================== Performance ====================
      case Actions.PERFORMANCE_START_TRACE: {
        const result = await client.performanceStartTrace(validatedPayload as Parameters<typeof client.performanceStartTrace>[0]);
        return success(result);
      }

      case Actions.PERFORMANCE_STOP_TRACE: {
        const result = await client.performanceStopTrace(validatedPayload as Parameters<typeof client.performanceStopTrace>[0]);
        return success(result);
      }

      case Actions.PERFORMANCE_ANALYZE_INSIGHT: {
        const result = await client.performanceAnalyzeInsight(validatedPayload as Parameters<typeof client.performanceAnalyzeInsight>[0]);
        return success(result);
      }

      // ==================== Network ====================
      case Actions.GET_NETWORK_REQUEST: {
        const result = await client.getNetworkRequest(validatedPayload as Parameters<typeof client.getNetworkRequest>[0]);
        return success(result);
      }

      case Actions.LIST_NETWORK_REQUESTS: {
        const result = await client.listNetworkRequests(validatedPayload as Parameters<typeof client.listNetworkRequests>[0]);
        return success(result);
      }

      // ==================== Debugging ====================
      case Actions.EVALUATE_SCRIPT: {
        const result = await client.evaluateScript(validatedPayload as Parameters<typeof client.evaluateScript>[0]);
        return success(result);
      }

      case Actions.GET_CONSOLE_MESSAGE: {
        const result = await client.getConsoleMessage(validatedPayload as Parameters<typeof client.getConsoleMessage>[0]);
        return success(result);
      }

      case Actions.LIST_CONSOLE_MESSAGES: {
        const result = await client.listConsoleMessages(validatedPayload as Parameters<typeof client.listConsoleMessages>[0]);
        return success(result);
      }

      case Actions.TAKE_SCREENSHOT: {
        const result = await client.takeScreenshot(validatedPayload as Parameters<typeof client.takeScreenshot>[0]);
        return success(result);
      }

      case Actions.TAKE_SNAPSHOT: {
        const result = await client.takeSnapshot(validatedPayload as Parameters<typeof client.takeSnapshot>[0]);
        return success(result);
      }

      case Actions.EXTRACT: {
        const result = await client.extract(validatedPayload as Parameters<typeof client.extract>[0]);
        return success(result);
      }

      case Actions.GET_ATTR: {
        const result = await client.getAttr(validatedPayload as Parameters<typeof client.getAttr>[0]);
        return success(result);
      }

      // ==================== Browser Control ====================
      case Actions.SHOW_BROWSER: {
        const result = await client.showBrowser();
        return success(result);
      }

      case Actions.HIDE_BROWSER: {
        const result = await client.hideBrowser();
        return success(result);
      }

      case Actions.BROWSER_MODE: {
        const result = await client.browserMode(validatedPayload as Parameters<typeof client.browserMode>[0]);
        return success(result);
      }

      // ==================== Profiles ====================
      case Actions.SET_PROFILE: {
        const result = await client.setProfile(validatedPayload as Parameters<typeof client.setProfile>[0]);
        return success(result);
      }

      case Actions.GET_PROFILE: {
        const result = await client.getProfile();
        return success(result);
      }

      // ==================== GIF Recording ====================
      case Actions.GIF_START: {
        const result = await client.gifStart(validatedPayload as Parameters<typeof client.gifStart>[0]);
        return success(result);
      }

      case Actions.GIF_STOP: {
        const result = await client.gifStop();
        return success(result);
      }

      case Actions.GIF_EXPORT: {
        const result = await client.gifExport(validatedPayload as Parameters<typeof client.gifExport>[0]);
        return success(result);
      }

      case Actions.GIF_CLEAR: {
        const result = await client.gifClear();
        return success(result);
      }

      // ==================== Tab Management ====================
      case Actions.TABS_CONTEXT: {
        const result = await client.tabsContext(validatedPayload as Parameters<typeof client.tabsContext>[0]);
        return success(result);
      }

      case Actions.TABS_CREATE: {
        const result = await client.tabsCreate(validatedPayload as Parameters<typeof client.tabsCreate>[0]);
        return success(result);
      }

      // ==================== Shortcuts ====================
      case Actions.SHORTCUTS_LIST: {
        const result = shortcutsManager.list();
        return success({ shortcuts: result });
      }

      case Actions.SHORTCUTS_EXECUTE: {
        const payload = validatedPayload as { name: string; args?: Record<string, unknown> };
        const shortcut = shortcutsManager.get(payload.name);
        if (!shortcut) {
          return error(`Shortcut not found: ${payload.name}`);
        }

        // Execute each step in the shortcut
        const results: unknown[] = [];
        for (const step of shortcut.steps) {
          const stepInput: ToolInput = {
            action: step.action as ToolInput["action"],
            payload: { ...step.payload, ...payload.args },
          };
          const stepResult = await dispatch(stepInput);
          results.push(stepResult);
          if (stepResult.isError) {
            return error(`Shortcut step failed: ${step.action}`);
          }
        }

        return success({ executed: shortcut.name, steps: shortcut.steps.length, results });
      }

      // ==================== Plan ====================
      case Actions.PLAN_UPDATE: {
        const result = await client.planUpdate(validatedPayload as Parameters<typeof client.planUpdate>[0]);
        return success(result);
      }

      // ==================== Upload Image ====================
      case Actions.UPLOAD_IMAGE: {
        const result = await client.uploadImage(validatedPayload as Parameters<typeof client.uploadImage>[0]);
        return success(result);
      }

      default:
        return error(`Unknown action: ${action}`);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error(`Validation error: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`, "VALIDATION_ERROR");
    }
    return error(err instanceof Error ? err.message : String(err));
  }
}

function buildDescription(): string {
  const actions = Object.values(Actions).join(", ");
  return `Chrome DevTools operations. Actions: ${actions}. Use action parameter to select operation, payload for action-specific parameters.`;
}

export function registerTools(server: McpServer): void {
  server.tool(
    "chrome",
    buildDescription(),
    {
      action: ActionSchema.describe("Action to perform"),
      payload: z.record(z.unknown()).optional().describe("Action-specific parameters"),
    },
    async (args) => {
      return dispatch(args);
    }
  );
}

// Cleanup function for graceful shutdown
export async function cleanup(): Promise<void> {
  if (browserManager) {
    await browserManager.close();
    browserManager = null;
    browserClient = null;
  }
}
