import { z } from "zod";

// Action constants organized by category
export const Actions = {
  // Input Automation (8)
  CLICK: "click",
  DRAG: "drag",
  FILL: "fill",
  FILL_FORM: "fill_form",
  HANDLE_DIALOG: "handle_dialog",
  HOVER: "hover",
  PRESS_KEY: "press_key",
  UPLOAD_FILE: "upload_file",

  // Navigation (6)
  CLOSE_PAGE: "close_page",
  LIST_PAGES: "list_pages",
  NAVIGATE_PAGE: "navigate_page",
  NEW_PAGE: "new_page",
  SELECT_PAGE: "select_page",
  WAIT_FOR: "wait_for",

  // Emulation (2)
  EMULATE: "emulate",
  RESIZE_PAGE: "resize_page",

  // Performance (3)
  PERFORMANCE_START_TRACE: "performance_start_trace",
  PERFORMANCE_STOP_TRACE: "performance_stop_trace",
  PERFORMANCE_ANALYZE_INSIGHT: "performance_analyze_insight",

  // Network (2)
  GET_NETWORK_REQUEST: "get_network_request",
  LIST_NETWORK_REQUESTS: "list_network_requests",

  // Debugging (5)
  EVALUATE_SCRIPT: "evaluate_script",
  GET_CONSOLE_MESSAGE: "get_console_message",
  LIST_CONSOLE_MESSAGES: "list_console_messages",
  TAKE_SCREENSHOT: "take_screenshot",
  TAKE_SNAPSHOT: "take_snapshot",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

export const ActionSchema = z.enum([
  // Input Automation
  Actions.CLICK,
  Actions.DRAG,
  Actions.FILL,
  Actions.FILL_FORM,
  Actions.HANDLE_DIALOG,
  Actions.HOVER,
  Actions.PRESS_KEY,
  Actions.UPLOAD_FILE,
  // Navigation
  Actions.CLOSE_PAGE,
  Actions.LIST_PAGES,
  Actions.NAVIGATE_PAGE,
  Actions.NEW_PAGE,
  Actions.SELECT_PAGE,
  Actions.WAIT_FOR,
  // Emulation
  Actions.EMULATE,
  Actions.RESIZE_PAGE,
  // Performance
  Actions.PERFORMANCE_START_TRACE,
  Actions.PERFORMANCE_STOP_TRACE,
  Actions.PERFORMANCE_ANALYZE_INSIGHT,
  // Network
  Actions.GET_NETWORK_REQUEST,
  Actions.LIST_NETWORK_REQUESTS,
  // Debugging
  Actions.EVALUATE_SCRIPT,
  Actions.GET_CONSOLE_MESSAGE,
  Actions.LIST_CONSOLE_MESSAGES,
  Actions.TAKE_SCREENSHOT,
  Actions.TAKE_SNAPSHOT,
]);

// Common schemas
const SelectorSchema = z.string().describe("CSS selector or XPath (XPath must start with / or //)");
const TimeoutSchema = z.number().optional().describe("Timeout in milliseconds");
const PageIndexSchema = z.number().optional().describe("Page/tab index (0-based)");

// Mouse button enum
const MouseButtonSchema = z.enum(["left", "right", "middle"]).optional().default("left");

// Payload schemas per action
export const PayloadSchemas = {
  // ==================== Input Automation ====================
  [Actions.CLICK]: z.object({
    selector: SelectorSchema.describe("Element selector to click"),
    button: MouseButtonSchema.describe("Mouse button to use"),
    clickCount: z.number().optional().default(1).describe("Number of clicks"),
    delay: z.number().optional().describe("Delay between mousedown and mouseup in ms"),
    timeout: TimeoutSchema,
  }),

  [Actions.DRAG]: z.object({
    sourceSelector: SelectorSchema.describe("Element selector to drag from"),
    targetSelector: SelectorSchema.describe("Element selector to drag to"),
    sourcePosition: z.object({
      x: z.number(),
      y: z.number(),
    }).optional().describe("Starting position offset within source element"),
    targetPosition: z.object({
      x: z.number(),
      y: z.number(),
    }).optional().describe("Target position offset within target element"),
    timeout: TimeoutSchema,
  }),

  [Actions.FILL]: z.object({
    selector: SelectorSchema.describe("Input element selector"),
    value: z.string().describe("Text value to fill"),
    clear: z.boolean().optional().default(true).describe("Clear existing value before filling"),
    timeout: TimeoutSchema,
  }),

  [Actions.FILL_FORM]: z.object({
    fields: z.array(z.object({
      selector: SelectorSchema.describe("Field selector"),
      value: z.string().describe("Value to fill"),
    })).describe("Array of form fields to fill"),
    submit: z.boolean().optional().describe("Submit the form after filling"),
    submitSelector: z.string().optional().describe("Submit button selector if submit is true"),
    timeout: TimeoutSchema,
  }),

  [Actions.HANDLE_DIALOG]: z.object({
    action: z.enum(["accept", "dismiss"]).describe("Action to take on the dialog"),
    promptText: z.string().optional().describe("Text to enter for prompt dialogs"),
  }),

  [Actions.HOVER]: z.object({
    selector: SelectorSchema.describe("Element selector to hover over"),
    timeout: TimeoutSchema,
  }),

  [Actions.PRESS_KEY]: z.object({
    key: z.string().describe("Key or key combination (e.g., 'Enter', 'Control+A', 'Control+Shift+R')"),
    selector: SelectorSchema.optional().describe("Optional element to focus before pressing key"),
    delay: z.number().optional().describe("Delay between keydown and keyup in ms"),
  }),

  [Actions.UPLOAD_FILE]: z.object({
    selector: SelectorSchema.describe("File input element selector"),
    filePaths: z.array(z.string()).describe("Array of absolute file paths to upload"),
    timeout: TimeoutSchema,
  }),

  // ==================== Navigation ====================
  [Actions.CLOSE_PAGE]: z.object({
    pageIndex: PageIndexSchema.describe("Index of the page/tab to close (closes current if not specified)"),
  }),

  [Actions.LIST_PAGES]: z.object({}),

  [Actions.NAVIGATE_PAGE]: z.object({
    url: z.string().optional().describe("URL to navigate to"),
    type: z.enum(["url", "back", "forward", "reload"]).optional().default("url").describe("Navigation type"),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional().default("load").describe("When to consider navigation complete"),
    timeout: TimeoutSchema,
  }),

  [Actions.NEW_PAGE]: z.object({
    url: z.string().optional().describe("URL to open in new page (blank if not specified)"),
  }),

  [Actions.SELECT_PAGE]: z.object({
    pageIndex: z.number().describe("Index of the page/tab to select (0-based)"),
  }),

  [Actions.WAIT_FOR]: z.object({
    selector: SelectorSchema.optional().describe("Wait for element matching selector"),
    text: z.string().optional().describe("Wait for text to appear on page"),
    timeout: TimeoutSchema.default(30000),
    state: z.enum(["visible", "hidden", "attached", "detached"]).optional().default("visible").describe("Element state to wait for"),
  }),

  // ==================== Emulation ====================
  [Actions.EMULATE]: z.object({
    device: z.string().optional().describe("Device name to emulate (e.g., 'iPhone 12', 'iPad Pro')"),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
      deviceScaleFactor: z.number().optional(),
      isMobile: z.boolean().optional(),
      hasTouch: z.boolean().optional(),
      isLandscape: z.boolean().optional(),
    }).optional().describe("Custom viewport settings"),
    userAgent: z.string().optional().describe("Custom user agent string"),
    geolocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
    }).optional().describe("Geolocation to emulate"),
    locale: z.string().optional().describe("Locale to emulate (e.g., 'en-US')"),
    timezoneId: z.string().optional().describe("Timezone to emulate (e.g., 'America/New_York')"),
    offline: z.boolean().optional().describe("Emulate offline mode"),
    cpuThrottling: z.number().optional().describe("CPU throttling factor (e.g., 4 for 4x slowdown)"),
    networkConditions: z.object({
      download: z.number().describe("Download speed in bytes/second"),
      upload: z.number().describe("Upload speed in bytes/second"),
      latency: z.number().describe("Latency in milliseconds"),
    }).optional().describe("Network throttling conditions"),
  }),

  [Actions.RESIZE_PAGE]: z.object({
    width: z.number().describe("Viewport width in pixels"),
    height: z.number().describe("Viewport height in pixels"),
    deviceScaleFactor: z.number().optional().default(1).describe("Device scale factor"),
  }),

  // ==================== Performance ====================
  [Actions.PERFORMANCE_START_TRACE]: z.object({
    categories: z.array(z.string()).optional().describe("Trace categories to capture"),
    screenshots: z.boolean().optional().default(true).describe("Capture screenshots during trace"),
  }),

  [Actions.PERFORMANCE_STOP_TRACE]: z.object({
    outputPath: z.string().optional().describe("Path to save trace file (returns data if not specified)"),
  }),

  [Actions.PERFORMANCE_ANALYZE_INSIGHT]: z.object({
    traceData: z.string().optional().describe("Trace data to analyze (uses last trace if not specified)"),
    metrics: z.array(z.enum([
      "FCP", "LCP", "CLS", "TBT", "TTI", "TTFB", "FID", "INP"
    ])).optional().describe("Specific metrics to analyze"),
  }),

  // ==================== Network ====================
  [Actions.GET_NETWORK_REQUEST]: z.object({
    requestId: z.string().optional().describe("Specific request ID to get"),
    url: z.string().optional().describe("URL pattern to match"),
    includeBody: z.boolean().optional().default(false).describe("Include request/response body"),
  }),

  [Actions.LIST_NETWORK_REQUESTS]: z.object({
    urlPattern: z.string().optional().describe("Filter by URL pattern (regex)"),
    resourceType: z.enum([
      "document", "stylesheet", "image", "media", "font",
      "script", "texttrack", "xhr", "fetch", "eventsource",
      "websocket", "manifest", "other"
    ]).optional().describe("Filter by resource type"),
    statusCode: z.number().optional().describe("Filter by status code"),
    limit: z.number().optional().default(100).describe("Maximum number of requests to return"),
  }),

  // ==================== Debugging ====================
  [Actions.EVALUATE_SCRIPT]: z.object({
    script: z.string().describe("JavaScript code to execute in page context"),
    returnByValue: z.boolean().optional().default(true).describe("Return result by value"),
    awaitPromise: z.boolean().optional().default(true).describe("Await if result is a promise"),
  }),

  [Actions.GET_CONSOLE_MESSAGE]: z.object({
    messageId: z.string().optional().describe("Specific message ID to get"),
    index: z.number().optional().describe("Message index (0-based, negative for last N)"),
  }),

  [Actions.LIST_CONSOLE_MESSAGES]: z.object({
    level: z.enum(["log", "debug", "info", "warning", "error"]).optional().describe("Filter by log level"),
    textPattern: z.string().optional().describe("Filter by text pattern (regex)"),
    limit: z.number().optional().default(100).describe("Maximum number of messages to return"),
    clear: z.boolean().optional().describe("Clear console after listing"),
  }),

  [Actions.TAKE_SCREENSHOT]: z.object({
    selector: SelectorSchema.optional().describe("Element to screenshot (full page if not specified)"),
    fullPage: z.boolean().optional().default(false).describe("Capture full scrollable page"),
    outputPath: z.string().optional().describe("Path to save screenshot (returns base64 if not specified)"),
    format: z.enum(["png", "jpeg", "webp"]).optional().default("png").describe("Image format"),
    quality: z.number().min(0).max(100).optional().describe("Quality for jpeg/webp (0-100)"),
    clip: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional().describe("Clip region to capture"),
  }),

  [Actions.TAKE_SNAPSHOT]: z.object({
    format: z.enum(["html", "mhtml", "text"]).optional().default("html").describe("Snapshot format"),
    selector: SelectorSchema.optional().describe("Element to snapshot (full page if not specified)"),
    outputPath: z.string().optional().describe("Path to save snapshot (returns content if not specified)"),
  }),
} as const;

// Infer types from schemas
export type ClickPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CLICK]>;
export type DragPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.DRAG]>;
export type FillPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.FILL]>;
export type FillFormPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.FILL_FORM]>;
export type HandleDialogPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.HANDLE_DIALOG]>;
export type HoverPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.HOVER]>;
export type PressKeyPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.PRESS_KEY]>;
export type UploadFilePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.UPLOAD_FILE]>;
export type ClosePagePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.CLOSE_PAGE]>;
export type ListPagesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_PAGES]>;
export type NavigatePagePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.NAVIGATE_PAGE]>;
export type NewPagePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.NEW_PAGE]>;
export type SelectPagePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.SELECT_PAGE]>;
export type WaitForPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.WAIT_FOR]>;
export type EmulatePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.EMULATE]>;
export type ResizePagePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.RESIZE_PAGE]>;
export type PerformanceStartTracePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.PERFORMANCE_START_TRACE]>;
export type PerformanceStopTracePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.PERFORMANCE_STOP_TRACE]>;
export type PerformanceAnalyzeInsightPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.PERFORMANCE_ANALYZE_INSIGHT]>;
export type GetNetworkRequestPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_NETWORK_REQUEST]>;
export type ListNetworkRequestsPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_NETWORK_REQUESTS]>;
export type EvaluateScriptPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.EVALUATE_SCRIPT]>;
export type GetConsoleMessagePayload = z.infer<(typeof PayloadSchemas)[typeof Actions.GET_CONSOLE_MESSAGE]>;
export type ListConsoleMessagesPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.LIST_CONSOLE_MESSAGES]>;
export type TakeScreenshotPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.TAKE_SCREENSHOT]>;
export type TakeSnapshotPayload = z.infer<(typeof PayloadSchemas)[typeof Actions.TAKE_SNAPSHOT]>;

// Tool input schema
export const ToolInputSchema = z.object({
  action: ActionSchema.describe("Action to perform"),
  payload: z.record(z.unknown()).optional().describe("Action-specific parameters"),
});

export type ToolInput = z.infer<typeof ToolInputSchema>;

// Tool result type (compatible with MCP CallToolResult)
export interface ToolResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
  isError?: boolean;
  [key: string]: unknown;
}
