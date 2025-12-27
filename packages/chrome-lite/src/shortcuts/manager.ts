export interface ShortcutStep {
  action: string;
  payload: Record<string, unknown>;
}

export interface Shortcut {
  name: string;
  description: string;
  steps: ShortcutStep[];
}

export interface ShortcutInfo {
  name: string;
  description: string;
  stepCount: number;
}

class ShortcutsManager {
  private shortcuts: Map<string, Shortcut> = new Map();

  constructor() {
    // Register built-in shortcuts
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    // Scroll shortcuts
    this.register({
      name: "scroll_to_bottom",
      description: "Scroll to the bottom of the page",
      steps: [
        {
          action: "evaluate_script",
          payload: { script: "window.scrollTo(0, document.body.scrollHeight)" },
        },
      ],
    });

    this.register({
      name: "scroll_to_top",
      description: "Scroll to the top of the page",
      steps: [
        {
          action: "evaluate_script",
          payload: { script: "window.scrollTo(0, 0)" },
        },
      ],
    });

    // Cookie consent
    this.register({
      name: "accept_cookies",
      description: "Try to click common cookie accept buttons",
      steps: [
        {
          action: "evaluate_script",
          payload: {
            script: `
              const selectors = [
                '[class*="accept"]', '[id*="accept"]',
                '[class*="cookie"] button', '[id*="cookie"] button',
                'button[class*="consent"]', 'button[id*="consent"]',
                '[aria-label*="accept"]', '[aria-label*="Accept"]',
                'button:has-text("Accept")', 'button:has-text("I agree")',
                'button:has-text("OK")', 'button:has-text("Got it")'
              ];
              for (const sel of selectors) {
                try {
                  const el = document.querySelector(sel);
                  if (el) { el.click(); break; }
                } catch (e) {}
              }
            `,
          },
        },
      ],
    });

    this.register({
      name: "reject_cookies",
      description: "Try to click common cookie reject buttons",
      steps: [
        {
          action: "evaluate_script",
          payload: {
            script: `
              const selectors = [
                '[class*="reject"]', '[id*="reject"]',
                '[class*="decline"]', '[id*="decline"]',
                'button:has-text("Reject")', 'button:has-text("Decline")',
                'button:has-text("No thanks")', 'button:has-text("Deny")'
              ];
              for (const sel of selectors) {
                try {
                  const el = document.querySelector(sel);
                  if (el) { el.click(); break; }
                } catch (e) {}
              }
            `,
          },
        },
      ],
    });

    // Page utilities
    this.register({
      name: "clear_local_storage",
      description: "Clear localStorage and sessionStorage",
      steps: [
        {
          action: "evaluate_script",
          payload: {
            script: "localStorage.clear(); sessionStorage.clear(); 'Storage cleared'",
          },
        },
      ],
    });

    this.register({
      name: "get_page_info",
      description: "Get basic page information (title, URL, meta)",
      steps: [
        {
          action: "evaluate_script",
          payload: {
            script: `
              JSON.stringify({
                title: document.title,
                url: window.location.href,
                description: document.querySelector('meta[name="description"]')?.content || '',
                canonical: document.querySelector('link[rel="canonical"]')?.href || '',
                language: document.documentElement.lang || '',
              }, null, 2)
            `,
          },
        },
      ],
    });

    // Form utilities
    this.register({
      name: "clear_all_inputs",
      description: "Clear all input fields on the page",
      steps: [
        {
          action: "evaluate_script",
          payload: {
            script: `
              document.querySelectorAll('input, textarea').forEach(el => {
                if (el.type !== 'submit' && el.type !== 'button') {
                  el.value = '';
                }
              });
              'All inputs cleared'
            `,
          },
        },
      ],
    });

    // Debug utilities
    this.register({
      name: "highlight_interactive",
      description: "Highlight all interactive elements on the page",
      steps: [
        {
          action: "evaluate_script",
          payload: {
            script: `
              const style = document.createElement('style');
              style.id = 'chrome-lite-highlight';
              style.textContent = \`
                a, button, input, select, textarea, [onclick], [role="button"] {
                  outline: 2px solid red !important;
                  outline-offset: 2px !important;
                }
              \`;
              document.head.appendChild(style);
              'Interactive elements highlighted'
            `,
          },
        },
      ],
    });

    this.register({
      name: "remove_highlight",
      description: "Remove highlight from interactive elements",
      steps: [
        {
          action: "evaluate_script",
          payload: {
            script: `
              document.getElementById('chrome-lite-highlight')?.remove();
              'Highlight removed'
            `,
          },
        },
      ],
    });
  }

  register(shortcut: Shortcut): void {
    this.shortcuts.set(shortcut.name, shortcut);
  }

  unregister(name: string): boolean {
    return this.shortcuts.delete(name);
  }

  list(): ShortcutInfo[] {
    return Array.from(this.shortcuts.values()).map((s) => ({
      name: s.name,
      description: s.description,
      stepCount: s.steps.length,
    }));
  }

  get(name: string): Shortcut | undefined {
    return this.shortcuts.get(name);
  }

  has(name: string): boolean {
    return this.shortcuts.has(name);
  }
}

// Singleton instance
export const shortcutsManager = new ShortcutsManager();
