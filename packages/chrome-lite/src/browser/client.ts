import { Page, KeyInput } from "puppeteer-core";
import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { BrowserManager, ProfileInfo } from "./manager.js";
import { gifRecorder } from "./gif-recorder.js";
import type {
  ClickPayload,
  DragPayload,
  FillPayload,
  FillFormPayload,
  HandleDialogPayload,
  HoverPayload,
  PressKeyPayload,
  UploadFilePayload,
  ClosePagePayload,
  NavigatePagePayload,
  NewPagePayload,
  SelectPagePayload,
  WaitForPayload,
  EmulatePayload,
  ResizePagePayload,
  PerformanceStartTracePayload,
  PerformanceStopTracePayload,
  PerformanceAnalyzeInsightPayload,
  GetNetworkRequestPayload,
  ListNetworkRequestsPayload,
  EvaluateScriptPayload,
  GetConsoleMessagePayload,
  ListConsoleMessagesPayload,
  TakeScreenshotPayload,
  TakeSnapshotPayload,
  SelectPayload,
  ExtractPayload,
  GetAttrPayload,
  BrowserModePayload,
  SetProfilePayload,
  GifStartPayload,
  GifExportPayload,
  TabsContextPayload,
  TabsCreatePayload,
  PlanUpdatePayload,
  UploadImagePayload,
} from "../types.js";

// Known device presets
const DEVICE_PRESETS: Record<string, { viewport: { width: number; height: number; deviceScaleFactor: number; isMobile: boolean; hasTouch: boolean }; userAgent: string }> = {
  "iPhone 12": {
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
  },
  "iPhone 14 Pro": {
    viewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  },
  "iPad Pro": {
    viewport: { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
  },
  "Pixel 5": {
    viewport: { width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
  },
  "Desktop 1080p": {
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
};

// Simple HTML to Markdown converter
function htmlToMarkdown(html: string): string {
  return html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n")
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n")
    // Bold and italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    // Links
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    // Images
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, "![$2]($1)")
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*\/?>/gi, "![$1]($2)")
    .replace(/<img[^>]*src=["']([^"']*)["'][^>]*\/?>/gi, "![]($1)")
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<\/?[ou]l[^>]*>/gi, "\n")
    // Paragraphs and breaks
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, "```\n$1\n```\n")
    // Blockquote
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, "> $1\n")
    // Remove remaining tags
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, "")
    // Clean up entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class BrowserClient {
  constructor(private manager: BrowserManager) {}

  // ==================== Input Automation ====================

  async click(payload: ClickPayload): Promise<{ clicked: boolean; selector: string }> {
    const page = await this.manager.getCurrentPage();
    const element = await this.resolveSelector(page, payload.selector);
    await element.click({
      button: payload.button,
      clickCount: payload.clickCount,
      delay: payload.delay,
    });
    return { clicked: true, selector: payload.selector };
  }

  async drag(payload: DragPayload): Promise<{ dragged: boolean }> {
    const page = await this.manager.getCurrentPage();
    const source = await this.resolveSelector(page, payload.sourceSelector);
    const target = await this.resolveSelector(page, payload.targetSelector);

    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error("Could not get bounding box for source or target element");
    }

    const sourceX = sourceBox.x + (payload.sourcePosition?.x ?? sourceBox.width / 2);
    const sourceY = sourceBox.y + (payload.sourcePosition?.y ?? sourceBox.height / 2);
    const targetX = targetBox.x + (payload.targetPosition?.x ?? targetBox.width / 2);
    const targetY = targetBox.y + (payload.targetPosition?.y ?? targetBox.height / 2);

    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 10 });
    await page.mouse.up();

    return { dragged: true };
  }

  async fill(payload: FillPayload): Promise<{ filled: boolean; selector: string; value: string }> {
    const page = await this.manager.getCurrentPage();
    const element = await this.resolveSelector(page, payload.selector);

    if (payload.clear !== false) {
      await element.click({ clickCount: 3 }); // Select all
      await page.keyboard.press("Backspace");
    }

    await element.type(payload.value);
    return { filled: true, selector: payload.selector, value: payload.value };
  }

  async fillForm(payload: FillFormPayload): Promise<{ filled: number; submitted: boolean }> {
    const page = await this.manager.getCurrentPage();

    for (const field of payload.fields) {
      const element = await this.resolveSelector(page, field.selector);
      await element.click({ clickCount: 3 });
      await page.keyboard.press("Backspace");
      await element.type(field.value);
    }

    let submitted = false;
    if (payload.submit) {
      if (payload.submitSelector) {
        const submitBtn = await this.resolveSelector(page, payload.submitSelector);
        await submitBtn.click();
      } else {
        await page.keyboard.press("Enter");
      }
      submitted = true;
    }

    return { filled: payload.fields.length, submitted };
  }

  async handleDialog(payload: HandleDialogPayload): Promise<{ handled: boolean; dialogType: string; message: string }> {
    const dialog = this.manager.getPendingDialog();
    if (!dialog) {
      throw new Error("No dialog is currently open");
    }

    const dialogType = dialog.type();
    const message = dialog.message();

    if (payload.action === "accept") {
      await dialog.accept(payload.promptText);
    } else {
      await dialog.dismiss();
    }

    this.manager.clearPendingDialog();
    return { handled: true, dialogType, message };
  }

  async hover(payload: HoverPayload): Promise<{ hovered: boolean; selector: string }> {
    const page = await this.manager.getCurrentPage();
    const element = await this.resolveSelector(page, payload.selector);
    await element.hover();
    return { hovered: true, selector: payload.selector };
  }

  async pressKey(payload: PressKeyPayload): Promise<{ pressed: boolean; key: string }> {
    const page = await this.manager.getCurrentPage();

    if (payload.selector) {
      const element = await this.resolveSelector(page, payload.selector);
      await element.focus();
    }

    // Handle key combinations like "Control+A" or "Control+Shift+R"
    const keys = payload.key.split("+");
    const modifiers: string[] = [];
    let mainKey = "";

    for (const k of keys) {
      const normalized = k.trim();
      if (["Control", "Shift", "Alt", "Meta"].includes(normalized)) {
        modifiers.push(normalized);
      } else {
        mainKey = normalized;
      }
    }

    // Press modifiers
    for (const mod of modifiers) {
      await page.keyboard.down(mod as KeyInput);
    }

    // Press main key
    if (mainKey) {
      await page.keyboard.press(mainKey as KeyInput, { delay: payload.delay });
    }

    // Release modifiers in reverse order
    for (const mod of modifiers.reverse()) {
      await page.keyboard.up(mod as KeyInput);
    }

    return { pressed: true, key: payload.key };
  }

  async uploadFile(payload: UploadFilePayload): Promise<{ uploaded: boolean; files: string[] }> {
    const page = await this.manager.getCurrentPage();
    const element = await page.$(payload.selector);

    if (!element) {
      throw new Error("Selector does not point to a file input element");
    }

    // Cast to input element handle for uploadFile
    const inputHandle = element as unknown as { uploadFile: (...paths: string[]) => Promise<void> };
    await inputHandle.uploadFile(...payload.filePaths);
    return { uploaded: true, files: payload.filePaths };
  }

  async select(payload: SelectPayload): Promise<{ selected: boolean; value: string }> {
    const page = await this.manager.getCurrentPage();
    const element = await this.resolveSelector(page, payload.selector);

    let values: string[] = [];

    if (payload.value !== undefined) {
      values = await element.select(payload.value);
    } else if (payload.label !== undefined) {
      // Select by visible text/label
      const optionValue = await element.evaluate((el: Element, label: string) => {
        const select = el as HTMLSelectElement;
        for (const option of Array.from(select.options)) {
          if (option.text === label || option.textContent?.trim() === label) {
            return option.value;
          }
        }
        return null;
      }, payload.label);

      if (optionValue === null) {
        throw new Error(`No option found with label: ${payload.label}`);
      }
      values = await element.select(optionValue);
    } else if (payload.index !== undefined) {
      // Select by index
      const optionValue = await element.evaluate((el: Element, idx: number) => {
        const select = el as HTMLSelectElement;
        if (idx >= 0 && idx < select.options.length) {
          return select.options[idx].value;
        }
        return null;
      }, payload.index);

      if (optionValue === null) {
        throw new Error(`No option found at index: ${payload.index}`);
      }
      values = await element.select(optionValue);
    } else {
      throw new Error("Must provide value, label, or index to select");
    }

    return { selected: true, value: values[0] || "" };
  }

  // ==================== Navigation ====================

  async closePage(payload: ClosePagePayload): Promise<{ closed: boolean; remainingPages: number }> {
    await this.manager.closePage(payload.pageIndex);
    return { closed: true, remainingPages: this.manager.listPages().length };
  }

  async listPages(): Promise<Array<{ index: number; url: string; title: string; isCurrent: boolean }>> {
    return this.manager.listPages();
  }

  async navigatePage(payload: NavigatePagePayload): Promise<{ url: string; status: number | null; captured?: { md?: string; html?: string; png?: string } }> {
    const page = await this.manager.getCurrentPage();
    let response;

    switch (payload.type) {
      case "back":
        response = await page.goBack({ waitUntil: payload.waitUntil, timeout: payload.timeout });
        break;
      case "forward":
        response = await page.goForward({ waitUntil: payload.waitUntil, timeout: payload.timeout });
        break;
      case "reload":
        response = await page.reload({ waitUntil: payload.waitUntil, timeout: payload.timeout });
        break;
      case "url":
      default:
        if (!payload.url) {
          throw new Error("URL is required for 'url' navigation type");
        }
        response = await page.goto(payload.url, { waitUntil: payload.waitUntil, timeout: payload.timeout });
        break;
    }

    const result: { url: string; status: number | null; captured?: { md?: string; html?: string; png?: string } } = {
      url: page.url(),
      status: response?.status() ?? null,
    };

    // Auto-capture feature (like superpowers-chrome)
    if (payload.autoCapture) {
      const outputDir = payload.outputDir || process.cwd();
      const prefix = payload.outputPrefix || "page";
      const timestamp = Date.now();

      try {
        await mkdir(outputDir, { recursive: true });

        // Capture HTML
        const html = await page.content();
        const htmlPath = join(outputDir, `${prefix}_${timestamp}.html`);
        await writeFile(htmlPath, html);

        // Capture Markdown
        const markdown = htmlToMarkdown(html);
        const mdPath = join(outputDir, `${prefix}_${timestamp}.md`);
        await writeFile(mdPath, markdown);

        // Capture PNG screenshot
        const screenshot = await page.screenshot({ type: "png", fullPage: true });
        const pngPath = join(outputDir, `${prefix}_${timestamp}.png`);
        await writeFile(pngPath, screenshot);

        result.captured = {
          md: mdPath,
          html: htmlPath,
          png: pngPath,
        };
      } catch (err) {
        // Auto-capture is best-effort, don't fail navigation if capture fails
        console.error("Auto-capture failed:", err);
      }
    }

    return result;
  }

  async newPage(payload: NewPagePayload): Promise<{ index: number; url: string }> {
    const { page, index } = await this.manager.newPage(payload.url);
    return { index, url: page.url() };
  }

  async selectPage(payload: SelectPagePayload): Promise<{ selected: boolean; index: number; url: string }> {
    const page = await this.manager.selectPage(payload.pageIndex);
    return { selected: true, index: payload.pageIndex, url: page.url() };
  }

  async waitFor(payload: WaitForPayload): Promise<{ found: boolean; elapsed: number }> {
    const page = await this.manager.getCurrentPage();
    const startTime = Date.now();

    if (payload.selector) {
      await page.waitForSelector(payload.selector, {
        timeout: payload.timeout,
        visible: payload.state === "visible",
        hidden: payload.state === "hidden",
      });
    } else if (payload.text) {
      await page.waitForFunction(
        (text: string) => document.body.innerText.includes(text),
        { timeout: payload.timeout },
        payload.text
      );
    } else {
      throw new Error("Either selector or text must be provided for wait_for");
    }

    return { found: true, elapsed: Date.now() - startTime };
  }

  // ==================== Emulation ====================

  async emulate(payload: EmulatePayload): Promise<{ emulated: boolean; settings: Record<string, unknown> }> {
    const page = await this.manager.getCurrentPage();
    const settings: Record<string, unknown> = {};

    // Apply device preset if specified
    if (payload.device && DEVICE_PRESETS[payload.device]) {
      const preset = DEVICE_PRESETS[payload.device];
      await page.setViewport(preset.viewport);
      await page.setUserAgent(preset.userAgent);
      settings.device = payload.device;
      settings.viewport = preset.viewport;
      settings.userAgent = preset.userAgent;
    }

    // Custom viewport overrides device preset
    if (payload.viewport) {
      await page.setViewport(payload.viewport);
      settings.viewport = payload.viewport;
    }

    if (payload.userAgent) {
      await page.setUserAgent(payload.userAgent);
      settings.userAgent = payload.userAgent;
    }

    if (payload.geolocation) {
      await page.setGeolocation(payload.geolocation);
      settings.geolocation = payload.geolocation;
    }

    // CDP session for advanced emulation
    const client = await this.manager.getCDPSession();

    if (payload.locale) {
      await client.send("Emulation.setLocaleOverride", {
        locale: payload.locale,
      });
      settings.locale = payload.locale;
    }

    if (payload.timezoneId) {
      await client.send("Emulation.setTimezoneOverride", {
        timezoneId: payload.timezoneId,
      });
      settings.timezoneId = payload.timezoneId;
    }

    if (payload.offline !== undefined) {
      await client.send("Network.emulateNetworkConditions", {
        offline: payload.offline,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
      settings.offline = payload.offline;
    }

    if (payload.networkConditions) {
      await client.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: payload.networkConditions.latency,
        downloadThroughput: payload.networkConditions.download,
        uploadThroughput: payload.networkConditions.upload,
      });
      settings.networkConditions = payload.networkConditions;
    }

    if (payload.cpuThrottling) {
      await client.send("Emulation.setCPUThrottlingRate", {
        rate: payload.cpuThrottling,
      });
      settings.cpuThrottling = payload.cpuThrottling;
    }

    return { emulated: true, settings };
  }

  async resizePage(payload: ResizePagePayload): Promise<{ resized: boolean; viewport: { width: number; height: number } }> {
    const page = await this.manager.getCurrentPage();
    await page.setViewport({
      width: payload.width,
      height: payload.height,
      deviceScaleFactor: payload.deviceScaleFactor,
    });
    return { resized: true, viewport: { width: payload.width, height: payload.height } };
  }

  // ==================== Performance ====================

  async performanceStartTrace(payload: PerformanceStartTracePayload): Promise<{ started: boolean }> {
    await this.manager.startTrace(payload.categories, payload.screenshots);
    return { started: true };
  }

  async performanceStopTrace(payload: PerformanceStopTracePayload): Promise<{ stopped: boolean; outputPath?: string; dataSize: number }> {
    const traceData = await this.manager.stopTrace();

    if (payload.outputPath) {
      await writeFile(payload.outputPath, traceData);
      return { stopped: true, outputPath: payload.outputPath, dataSize: traceData.length };
    }

    return { stopped: true, dataSize: traceData.length };
  }

  async performanceAnalyzeInsight(payload: PerformanceAnalyzeInsightPayload): Promise<Record<string, unknown>> {
    let traceData = payload.traceData;

    if (!traceData) {
      traceData = this.manager.getLastTraceData() ?? undefined;
    }

    if (!traceData) {
      throw new Error("No trace data available. Either provide traceData or run performance_start_trace and performance_stop_trace first.");
    }

    // Parse trace and extract metrics
    const trace = JSON.parse(traceData);
    const events = trace.traceEvents || [];

    const metrics: Record<string, unknown> = {};
    const requestedMetrics = payload.metrics || ["FCP", "LCP", "CLS", "TBT", "TTI", "TTFB"];

    // Extract timing events
    for (const event of events) {
      if (event.name === "firstContentfulPaint" && requestedMetrics.includes("FCP")) {
        metrics.FCP = { value: event.ts / 1000, unit: "ms", name: "First Contentful Paint" };
      }
      if (event.name === "largestContentfulPaint::Candidate" && requestedMetrics.includes("LCP")) {
        metrics.LCP = { value: event.ts / 1000, unit: "ms", name: "Largest Contentful Paint" };
      }
      if (event.name === "LayoutShift" && requestedMetrics.includes("CLS")) {
        const existing = (metrics.CLS as { value: number } | undefined)?.value || 0;
        metrics.CLS = { value: existing + (event.args?.data?.score || 0), unit: "", name: "Cumulative Layout Shift" };
      }
    }

    return {
      analyzed: true,
      metrics,
      eventCount: events.length,
    };
  }

  // ==================== Network ====================

  async getNetworkRequest(payload: GetNetworkRequestPayload): Promise<Record<string, unknown>> {
    let request;

    if (payload.requestId) {
      request = this.manager.getNetworkRequest(payload.requestId);
    } else if (payload.url) {
      request = this.manager.findNetworkRequest(payload.url);
    } else {
      throw new Error("Either requestId or url must be provided");
    }

    if (!request) {
      throw new Error("Network request not found");
    }

    const result: Record<string, unknown> = { ...request };

    if (payload.includeBody && request.requestId) {
      try {
        const client = await this.manager.getCDPSession();
        const response = await client.send("Network.getResponseBody", {
          requestId: request.requestId,
        });
        result.responseBody = response.body;
        result.responseBodyBase64Encoded = response.base64Encoded;
      } catch {
        // Response body may not be available
      }
    }

    return result;
  }

  async listNetworkRequests(payload: ListNetworkRequestsPayload): Promise<{ requests: unknown[]; total: number }> {
    let requests = this.manager.getNetworkRequests();

    if (payload.urlPattern) {
      const regex = new RegExp(payload.urlPattern);
      requests = requests.filter((r) => regex.test(r.url));
    }

    if (payload.resourceType) {
      requests = requests.filter((r) => r.resourceType.toLowerCase() === payload.resourceType?.toLowerCase());
    }

    if (payload.statusCode) {
      requests = requests.filter((r) => r.status === payload.statusCode);
    }

    const total = requests.length;
    const limited = requests.slice(0, payload.limit || 100);

    return { requests: limited, total };
  }

  // ==================== Debugging ====================

  async evaluateScript(payload: EvaluateScriptPayload): Promise<{ result: unknown }> {
    const page = await this.manager.getCurrentPage();
    const result = await page.evaluate(payload.script);
    return { result };
  }

  async getConsoleMessage(payload: GetConsoleMessagePayload): Promise<Record<string, unknown>> {
    let message;

    if (payload.messageId) {
      const messages = this.manager.getConsoleMessages();
      message = messages.find((m) => m.id === payload.messageId);
    } else if (payload.index !== undefined) {
      message = this.manager.getConsoleMessage(payload.index);
    } else {
      // Return last message by default
      message = this.manager.getConsoleMessage(-1);
    }

    if (!message) {
      throw new Error("Console message not found");
    }

    return { ...message };
  }

  async listConsoleMessages(payload: ListConsoleMessagesPayload): Promise<{ messages: unknown[]; total: number; cleared: boolean }> {
    let messages = this.manager.getConsoleMessages();

    if (payload.level) {
      messages = messages.filter((m) => m.level === payload.level);
    }

    if (payload.textPattern) {
      const regex = new RegExp(payload.textPattern);
      messages = messages.filter((m) => regex.test(m.text));
    }

    const total = messages.length;
    const limited = messages.slice(0, payload.limit || 100);

    let cleared = false;
    if (payload.clear) {
      this.manager.clearConsoleMessages();
      cleared = true;
    }

    return { messages: limited, total, cleared };
  }

  async takeScreenshot(payload: TakeScreenshotPayload): Promise<{ screenshot: string; format: string; outputPath?: string }> {
    const page = await this.manager.getCurrentPage();

    const options: Parameters<Page["screenshot"]>[0] = {
      type: payload.format || "png",
      fullPage: payload.fullPage,
      quality: payload.format !== "png" ? payload.quality : undefined,
      clip: payload.clip,
      encoding: payload.outputPath ? "binary" : "base64",
    };

    let screenshot: string;

    if (payload.selector) {
      const element = await this.resolveSelector(page, payload.selector);
      const buffer = await element.screenshot(options);
      screenshot = typeof buffer === "string" ? buffer : Buffer.from(buffer).toString("base64");
    } else {
      const buffer = await page.screenshot(options);
      screenshot = typeof buffer === "string" ? buffer : Buffer.from(buffer).toString("base64");
    }

    if (payload.outputPath) {
      await writeFile(payload.outputPath, Buffer.from(screenshot, "base64"));
      return { screenshot: `Saved to ${payload.outputPath}`, format: payload.format || "png", outputPath: payload.outputPath };
    }

    return { screenshot, format: payload.format || "png" };
  }

  async takeSnapshot(payload: TakeSnapshotPayload): Promise<{ content: string; format: string; outputPath?: string }> {
    const page = await this.manager.getCurrentPage();
    let content: string;

    if (payload.selector) {
      const element = await this.resolveSelector(page, payload.selector);
      if (payload.format === "text") {
        content = await element.evaluate((el: Element) => el.textContent || "");
      } else {
        content = await element.evaluate((el: Element) => el.outerHTML);
      }
    } else {
      switch (payload.format) {
        case "text":
          content = await page.evaluate(() => document.body.innerText);
          break;
        case "markdown": {
          const html = await page.content();
          content = htmlToMarkdown(html);
          break;
        }
        case "mhtml": {
          const client = await this.manager.getCDPSession();
          const result = await client.send("Page.captureSnapshot", { format: "mhtml" });
          content = result.data;
          break;
        }
        case "html":
        default:
          content = await page.content();
          break;
      }
    }

    if (payload.outputPath) {
      await writeFile(payload.outputPath, content);
      return { content: `Saved to ${payload.outputPath}`, format: payload.format || "html", outputPath: payload.outputPath };
    }

    return { content, format: payload.format || "html" };
  }

  // ==================== Extraction ====================

  async extract(payload: ExtractPayload): Promise<{ content: string; format: string }> {
    const page = await this.manager.getCurrentPage();
    let html: string;

    if (payload.selector) {
      const element = await this.resolveSelector(page, payload.selector);
      html = await element.evaluate((el: Element) => el.outerHTML);
    } else {
      html = await page.content();
    }

    let content: string;
    switch (payload.format) {
      case "text":
        content = htmlToMarkdown(html).replace(/[#*`>\[\]!()-]/g, "").replace(/\n{2,}/g, "\n");
        break;
      case "markdown":
        content = htmlToMarkdown(html);
        break;
      case "html":
      default:
        content = html;
        break;
    }

    return { content, format: payload.format || "text" };
  }

  async getAttr(payload: GetAttrPayload): Promise<{ attribute: string; value: string | null }> {
    const page = await this.manager.getCurrentPage();
    const element = await this.resolveSelector(page, payload.selector);

    const value = await element.evaluate((el: Element, attr: string) => {
      return el.getAttribute(attr);
    }, payload.attribute);

    return { attribute: payload.attribute, value };
  }

  // ==================== Browser Control ====================

  async showBrowser(): Promise<{ mode: "visible" }> {
    await this.manager.showBrowser();
    return { mode: "visible" };
  }

  async hideBrowser(): Promise<{ mode: "headless" }> {
    await this.manager.hideBrowser();
    return { mode: "headless" };
  }

  async browserMode(payload: BrowserModePayload): Promise<{ mode: "headless" | "visible" }> {
    await this.manager.setBrowserMode(payload.mode);
    return { mode: payload.mode };
  }

  // ==================== Profile Management ====================

  async setProfile(payload: SetProfilePayload): Promise<ProfileInfo> {
    return this.manager.setProfile(payload.name, payload.userDataDir);
  }

  async getProfile(): Promise<ProfileInfo> {
    return this.manager.getProfile();
  }

  // ==================== GIF Recording ====================

  private screenshotStore: Map<string, Buffer> = new Map();

  async gifStart(payload: GifStartPayload): Promise<{ success: boolean; message: string }> {
    return gifRecorder.start({ captureOnAction: payload.captureOnAction });
  }

  async gifStop(): Promise<{ success: boolean; frameCount: number }> {
    return gifRecorder.stop();
  }

  async gifExport(payload: GifExportPayload): Promise<{ gif?: string; outputPath?: string; frameCount: number }> {
    const result = await gifRecorder.export(payload.options);

    if (payload.outputPath) {
      const outputPath = join(payload.outputPath, payload.filename ?? "recording.gif");
      await mkdir(payload.outputPath, { recursive: true });
      await writeFile(outputPath, result.gif);
      return { outputPath, frameCount: result.frameCount };
    }

    return { gif: result.gif.toString("base64"), frameCount: result.frameCount };
  }

  async gifClear(): Promise<{ success: boolean }> {
    return gifRecorder.clear();
  }

  // Helper to capture frame after actions (called by dispatch)
  async captureFrameIfRecording(action: string, coordinates?: { x: number; y: number }): Promise<void> {
    if (!gifRecorder.shouldCaptureOnAction()) return;

    const page = await this.manager.getCurrentPage();
    const screenshot = await page.screenshot({ type: "png" });
    await gifRecorder.addFrame(Buffer.from(screenshot), action, coordinates);
  }

  // ==================== Tab Management ====================

  async tabsContext(payload: TabsContextPayload): Promise<{
    tabs: Array<{ pageIndex: number; isActive: boolean; url?: string; title?: string }>;
    activeIndex: number;
    count: number;
  }> {
    const pages = this.manager.listPages();
    const currentIndex = pages.findIndex((p) => p.isCurrent);

    if (payload.includeMetadata) {
      return {
        tabs: pages.map((p) => ({
          pageIndex: p.index,
          isActive: p.isCurrent,
          url: p.url,
          title: p.title,
        })),
        activeIndex: currentIndex,
        count: pages.length,
      };
    }

    return {
      tabs: pages.map((p) => ({
        pageIndex: p.index,
        isActive: p.isCurrent,
      })),
      activeIndex: currentIndex,
      count: pages.length,
    };
  }

  async tabsCreate(payload: TabsCreatePayload): Promise<{ pageIndex: number; url: string }> {
    const { page, index } = await this.manager.newPage(payload.url);

    if (!payload.active) {
      // Switch back to previous page if not active
      const currentIndex = index > 0 ? index - 1 : 0;
      await this.manager.selectPage(currentIndex);
    }

    return { pageIndex: index, url: page.url() };
  }

  // ==================== Plan ====================

  async planUpdate(payload: PlanUpdatePayload): Promise<{
    status: string;
    plan: { domains: string[]; approach: string[]; createdAt: string };
    display: string;
  }> {
    const plan = {
      domains: payload.domains,
      approach: payload.approach,
      createdAt: new Date().toISOString(),
    };

    const display = [
      "## Plan",
      "",
      "**Domains:**",
      ...payload.domains.map((d) => `- ${d}`),
      "",
      "**Approach:**",
      ...payload.approach.map((s, i) => `${i + 1}. ${s}`),
    ].join("\n");

    return { status: "pending_approval", plan, display };
  }

  // ==================== Upload Image ====================

  async takeScreenshotWithStore(payload: TakeScreenshotPayload): Promise<{ screenshot: string; format: string; outputPath?: string; screenshotId: string }> {
    const result = await this.takeScreenshot(payload);

    // Store screenshot for later use
    const screenshotId = `ss_${Date.now()}`;
    if (!payload.outputPath && result.screenshot) {
      this.screenshotStore.set(screenshotId, Buffer.from(result.screenshot, "base64"));
    }

    return { ...result, screenshotId };
  }

  async uploadImage(payload: UploadImagePayload): Promise<{ success: boolean; filename: string }> {
    const page = await this.manager.getCurrentPage();
    let imageBuffer: Buffer;

    if (payload.source === "screenshot") {
      if (!payload.screenshotId) {
        throw new Error("screenshotId is required when source is 'screenshot'");
      }
      const stored = this.screenshotStore.get(payload.screenshotId);
      if (!stored) {
        throw new Error(`Screenshot ${payload.screenshotId} not found. Take a screenshot first.`);
      }
      imageBuffer = stored;
    } else {
      if (!payload.filePath) {
        throw new Error("filePath is required when source is 'file'");
      }
      imageBuffer = await readFile(payload.filePath);
    }

    // Create temp file
    const tempPath = join(tmpdir(), payload.filename ?? "image.png");
    await writeFile(tempPath, imageBuffer);

    try {
      // Find the file input element
      const input = await page.$(payload.selector);
      if (!input) {
        throw new Error(`Element not found: ${payload.selector}`);
      }

      // Upload the file
      const inputHandle = input as unknown as { uploadFile: (...paths: string[]) => Promise<void> };
      await inputHandle.uploadFile(tempPath);

      return { success: true, filename: payload.filename ?? "image.png" };
    } finally {
      // Clean up temp file
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  // ==================== Helpers ====================

  private async resolveSelector(page: Page, selector: string) {
    // XPath selectors start with / or //
    if (selector.startsWith("/")) {
      // Use ::-p-xpath() pseudo-selector for XPath in newer Puppeteer
      const element = await page.$(`::-p-xpath(${selector})`);
      if (!element) {
        throw new Error(`No element found for XPath selector: ${selector}`);
      }
      return element;
    }

    // CSS selector
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`No element found for CSS selector: ${selector}`);
    }
    return element;
  }
}
