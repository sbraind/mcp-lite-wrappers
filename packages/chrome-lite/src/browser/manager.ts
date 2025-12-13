import puppeteer, { Browser, Page, CDPSession, Dialog } from "puppeteer-core";
import { execSync } from "child_process";
import { platform } from "os";

export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  resourceType: string;
  timestamp: number;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  responseBody?: string;
  requestBody?: string;
}

export interface ConsoleMessage {
  id: string;
  level: string;
  text: string;
  timestamp: number;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
}

export interface BrowserConfig {
  headless?: boolean;
  executablePath?: string;
  defaultViewport?: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };
  args?: string[];
  userDataDir?: string;
  profileName?: string;
}

export interface ProfileInfo {
  name: string;
  userDataDir?: string;
  isActive: boolean;
}

function findChromePath(): string {
  const os = platform();

  if (os === "darwin") {
    const paths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const p of paths) {
      try {
        execSync(`test -f "${p}"`);
        return p;
      } catch {
        continue;
      }
    }
  } else if (os === "win32") {
    const paths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const p of paths) {
      try {
        execSync(`if exist "${p}" echo found`, { encoding: "utf8" });
        return p;
      } catch {
        continue;
      }
    }
  } else {
    // Linux
    const paths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    ];
    for (const p of paths) {
      try {
        execSync(`test -f "${p}"`);
        return p;
      } catch {
        continue;
      }
    }
  }

  throw new Error(
    "Chrome executable not found. Please set CHROME_PATH environment variable or install Chrome."
  );
}

export class BrowserManager {
  private browser: Browser | null = null;
  private pages: Page[] = [];
  private currentPageIndex = 0;
  private cdpSession: CDPSession | null = null;
  private config: BrowserConfig;

  // State tracking
  private networkRequests: Map<string, NetworkRequest> = new Map();
  private consoleMessages: ConsoleMessage[] = [];
  private pendingDialog: Dialog | null = null;
  private traceData: string | null = null;
  private isTracing = false;

  // Profile tracking
  private currentProfile: ProfileInfo = { name: "default", isActive: true };

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      executablePath: config.executablePath ?? process.env.CHROME_PATH,
      defaultViewport: config.defaultViewport ?? { width: 1280, height: 720 },
      args: config.args ?? ["--no-sandbox", "--disable-setuid-sandbox"],
      userDataDir: config.userDataDir,
      profileName: config.profileName ?? "default",
    };
    this.currentProfile = {
      name: this.config.profileName!,
      userDataDir: this.config.userDataDir,
      isActive: false,
    };
  }

  isHeadless(): boolean {
    return this.config.headless ?? true;
  }

  async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      const executablePath = this.config.executablePath || findChromePath();

      this.browser = await puppeteer.launch({
        executablePath,
        headless: this.config.headless,
        defaultViewport: this.config.defaultViewport,
        args: this.config.args,
        userDataDir: this.config.userDataDir,
      });

      this.currentProfile.isActive = true;

      // Create initial page
      const pages = await this.browser.pages();
      if (pages.length > 0) {
        this.pages = pages;
        await this.setupPageListeners(pages[0]);
      } else {
        const page = await this.browser.newPage();
        this.pages = [page];
        await this.setupPageListeners(page);
      }
    }
    return this.browser;
  }

  private async setupPageListeners(page: Page): Promise<void> {
    // Console messages
    page.on("console", (msg) => {
      const loc = msg.location();
      this.consoleMessages.push({
        id: `console-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
        location: loc.url ? { url: loc.url, lineNumber: loc.lineNumber ?? 0, columnNumber: loc.columnNumber ?? 0 } : undefined,
      });
      // Keep only last 1000 messages
      if (this.consoleMessages.length > 1000) {
        this.consoleMessages = this.consoleMessages.slice(-1000);
      }
    });

    // Dialog handling
    page.on("dialog", (dialog) => {
      this.pendingDialog = dialog;
    });

    // Network request tracking via CDP
    const client = await page.createCDPSession();
    this.cdpSession = client;

    await client.send("Network.enable");

    client.on("Network.requestWillBeSent", (event) => {
      this.networkRequests.set(event.requestId, {
        requestId: event.requestId,
        url: event.request.url,
        method: event.request.method,
        resourceType: event.type ?? "other",
        timestamp: event.timestamp,
        requestHeaders: event.request.headers as Record<string, string>,
        requestBody: event.request.postData ?? undefined,
      });
      // Keep only last 500 requests
      if (this.networkRequests.size > 500) {
        const firstKey = this.networkRequests.keys().next().value;
        if (firstKey) this.networkRequests.delete(firstKey);
      }
    });

    client.on("Network.responseReceived", (event) => {
      const request = this.networkRequests.get(event.requestId);
      if (request) {
        request.status = event.response.status;
        request.statusText = event.response.statusText;
        request.responseHeaders = event.response.headers as Record<string, string>;
      }
    });
  }

  async getCurrentPage(): Promise<Page> {
    await this.ensureBrowser();
    if (this.pages.length === 0) {
      const page = await this.browser!.newPage();
      this.pages.push(page);
      await this.setupPageListeners(page);
      this.currentPageIndex = 0;
    }
    return this.pages[this.currentPageIndex];
  }

  async getPage(index: number): Promise<Page> {
    await this.ensureBrowser();
    if (index < 0 || index >= this.pages.length) {
      throw new Error(`Page index ${index} out of range. Available pages: 0-${this.pages.length - 1}`);
    }
    return this.pages[index];
  }

  async newPage(url?: string): Promise<{ page: Page; index: number }> {
    await this.ensureBrowser();
    const page = await this.browser!.newPage();
    await this.setupPageListeners(page);
    this.pages.push(page);
    const index = this.pages.length - 1;
    this.currentPageIndex = index;

    if (url) {
      await page.goto(url, { waitUntil: "load" });
    }

    return { page, index };
  }

  async selectPage(index: number): Promise<Page> {
    const page = await this.getPage(index);
    this.currentPageIndex = index;
    await page.bringToFront();
    return page;
  }

  async closePage(index?: number): Promise<void> {
    const targetIndex = index ?? this.currentPageIndex;
    const page = await this.getPage(targetIndex);
    await page.close();
    this.pages.splice(targetIndex, 1);

    if (this.currentPageIndex >= this.pages.length) {
      this.currentPageIndex = Math.max(0, this.pages.length - 1);
    }
  }

  listPages(): Array<{ index: number; url: string; title: string; isCurrent: boolean }> {
    return this.pages.map((page, index) => ({
      index,
      url: page.url(),
      title: page.url(), // title() is async, using url for sync access
      isCurrent: index === this.currentPageIndex,
    }));
  }

  async getCDPSession(): Promise<CDPSession> {
    const page = await this.getCurrentPage();
    if (!this.cdpSession) {
      this.cdpSession = await page.createCDPSession();
    }
    return this.cdpSession;
  }

  // Dialog handling
  getPendingDialog(): Dialog | null {
    return this.pendingDialog;
  }

  clearPendingDialog(): void {
    this.pendingDialog = null;
  }

  // Network requests
  getNetworkRequests(): NetworkRequest[] {
    return Array.from(this.networkRequests.values());
  }

  getNetworkRequest(requestId: string): NetworkRequest | undefined {
    return this.networkRequests.get(requestId);
  }

  findNetworkRequest(urlPattern: string): NetworkRequest | undefined {
    const regex = new RegExp(urlPattern);
    for (const request of this.networkRequests.values()) {
      if (regex.test(request.url)) {
        return request;
      }
    }
    return undefined;
  }

  // Console messages
  getConsoleMessages(): ConsoleMessage[] {
    return [...this.consoleMessages];
  }

  getConsoleMessage(index: number): ConsoleMessage | undefined {
    if (index < 0) {
      return this.consoleMessages[this.consoleMessages.length + index];
    }
    return this.consoleMessages[index];
  }

  clearConsoleMessages(): void {
    this.consoleMessages = [];
  }

  // Performance tracing
  async startTrace(categories?: string[], screenshots = true): Promise<void> {
    if (this.isTracing) {
      throw new Error("Trace is already running. Stop it first with performance_stop_trace.");
    }
    const page = await this.getCurrentPage();
    await page.tracing.start({
      categories: categories ?? [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "disabled-by-default-devtools.timeline.frame",
      ],
      screenshots,
    });
    this.isTracing = true;
  }

  async stopTrace(): Promise<string> {
    if (!this.isTracing) {
      throw new Error("No trace is running. Start one with performance_start_trace.");
    }
    const page = await this.getCurrentPage();
    const traceBuffer = await page.tracing.stop();
    this.isTracing = false;
    this.traceData = traceBuffer ? Buffer.from(traceBuffer).toString("utf-8") : "";
    return this.traceData;
  }

  getLastTraceData(): string | null {
    return this.traceData;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.pages = [];
      this.currentPageIndex = 0;
      this.cdpSession = null;
      this.networkRequests.clear();
      this.consoleMessages = [];
      this.pendingDialog = null;
      this.traceData = null;
      this.isTracing = false;
      this.currentProfile.isActive = false;
    }
  }

  // ==================== Browser Control ====================

  async setBrowserMode(mode: "headless" | "visible"): Promise<void> {
    const newHeadless = mode === "headless";
    if (this.config.headless !== newHeadless) {
      // Need to restart browser with new mode
      await this.close();
      this.config.headless = newHeadless;
      await this.ensureBrowser();
    }
  }

  async showBrowser(): Promise<void> {
    await this.setBrowserMode("visible");
  }

  async hideBrowser(): Promise<void> {
    await this.setBrowserMode("headless");
  }

  getBrowserMode(): "headless" | "visible" {
    return this.config.headless ? "headless" : "visible";
  }

  // ==================== Profile Management ====================

  async setProfile(name: string, userDataDir?: string): Promise<ProfileInfo> {
    // If profile is different, restart browser with new profile
    if (this.currentProfile.name !== name || this.currentProfile.userDataDir !== userDataDir) {
      await this.close();
      this.config.profileName = name;
      this.config.userDataDir = userDataDir;
      this.currentProfile = {
        name,
        userDataDir,
        isActive: false,
      };
      await this.ensureBrowser();
    }
    return this.currentProfile;
  }

  getProfile(): ProfileInfo {
    return { ...this.currentProfile };
  }
}
