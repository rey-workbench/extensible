import { renderIcon } from "@/shared/index";
import { DEFAULT_CAVEMAN_SETTINGS, isValidCavemanLevel } from "../constants/ai-exporter.constants";
import type { CavemanSettings, ExportFormat } from "../types/ai-exporter.types";
import { ChatComposerUtils } from "../utils/chat-composer.utils";

export interface AiExporterComposerViewCallbacks {
  onExport: (format: ExportFormat) => Promise<void>;
  onCopy: () => Promise<void>;
  onToggleCaveman: () => Promise<CavemanSettings>;
  onCycleCavemanLevel: () => Promise<CavemanSettings>;
}

export class AiExporterComposerView {
  private container: HTMLElement | null = null;
  private menuEl: HTMLElement | null = null;
  private backdropEl: HTMLElement | null = null;
  private isOpen = false;
  private observer: MutationObserver | null = null;
  private currentSettings: CavemanSettings = DEFAULT_CAVEMAN_SETTINGS;
  private alignScheduled = false;

  constructor(private readonly callbacks: AiExporterComposerViewCallbacks) {}

  public mount(initialSettings?: CavemanSettings): void {
    if (initialSettings) {
      this.currentSettings = initialSettings;
    }

    this.renderToolbar();
    this.startComposerWatcher();
  }

  public updateSettings(settings: CavemanSettings): void {
    this.currentSettings = settings;
    this.updateCavemanButtonUi();
  }

  private renderToolbar(): void {
    const existing = document.getElementById("aio-composer-bar-root");
    if (existing) existing.remove();

    this.container = document.createElement("div");
    this.container.id = "aio-composer-bar-root";
    this.container.className = "aio-composer-bar-root";

    const { enabled, level } = this.currentSettings;
    // Invalid/stale level surfaces as STOP — next send injects the stop directive
    const levelValid = isValidCavemanLevel(level);
    const statusText = enabled ? (levelValid ? level.toUpperCase() : "STOP") : "OFF";
    const badgeClass = enabled && levelValid ? `aio-lvl-${level}` : "";

    this.container.innerHTML = `
      <div class="aio-composer-bar ${enabled ? "aio-caveman-on" : ""}">
        <!-- Caveman Toggle Button -->
        <button type="button" class="aio-bar-btn aio-caveman-toggle-btn" title="Caveman Mode: ${statusText} (Click to cycle level)">
          ${renderIcon("flame", 13, "aio-flame-icon")}
          <span class="aio-bar-btn-text">Caveman</span>
          <span class="aio-bar-badge aio-lvl-badge ${badgeClass}">${statusText}</span>
        </button>

        <div class="aio-bar-divider"></div>

        <!-- Export Menu Button -->
        <div class="aio-export-wrapper">
          <button type="button" class="aio-bar-btn aio-export-trigger-btn" title="Export Conversation">
            ${renderIcon("download", 13)}
            <span class="aio-bar-btn-text">Export</span>
            <span class="aio-export-caret">▾</span>
          </button>
        </div>
      </div>
    `;

    this.positionDock();
    this.renderMenu();
    this.bindEvents();
  }

  private renderMenu(): void {
    const existing = document.getElementById("aio-composer-menu-root");
    if (existing) existing.remove();
    const existingBackdrop = document.getElementById("aio-composer-backdrop-root");
    if (existingBackdrop) existingBackdrop.remove();

    this.backdropEl = document.createElement("div");
    this.backdropEl.id = "aio-composer-backdrop-root";
    this.backdropEl.className = "aio-menu-backdrop";
    this.backdropEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeMenu();
    });
    this.backdropEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeMenu();
    });
    document.body.appendChild(this.backdropEl);

    this.menuEl = document.createElement("div");
    this.menuEl.id = "aio-composer-menu-root";
    this.menuEl.className = "aio-composer-menu";
    this.menuEl.innerHTML = `
      <div class="aio-composer-menu-header">
        <span>Export Conversation</span>
        <button type="button" class="aio-composer-menu-close" title="Close menu">✕</button>
      </div>
      <button type="button" class="aio-composer-menu-item" data-format="markdown">
        ${renderIcon("markdown", 13)}
        <span>Markdown (.md)</span>
      </button>
      <button type="button" class="aio-composer-menu-item" data-format="pdf">
        ${renderIcon("pdf", 13)}
        <span>Print to PDF</span>
      </button>
      <button type="button" class="aio-composer-menu-item" data-format="json">
        ${renderIcon("json", 13)}
        <span>JSON (.json)</span>
      </button>
      <button type="button" class="aio-composer-menu-item" data-format="html">
        ${renderIcon("html", 13)}
        <span>HTML Document</span>
      </button>
      <div class="aio-composer-menu-divider"></div>
      <button type="button" class="aio-composer-menu-item aio-composer-copy-btn">
        ${renderIcon("copy", 13)}
        <span>Copy to Clipboard</span>
      </button>
    `;
    document.body.appendChild(this.menuEl);
    this.bindMenuEvents();
  }

  /**
   * Positions the toolbar as a viewport-fixed overlay anchored to the composer box.
   * Nothing is inserted into the host's flex rows, so host layout churn (Gemini/ChatGPT
   * re-renders) can never displace, wrap, or clip the bar. Same inputs → same position.
   */
  private positionDock(): void {
    if (!this.container) return;

    const composerBox = ChatComposerUtils.getComposerBox(document);
    const editor = ChatComposerUtils.getEditor(document);

    if (!composerBox || composerBox === editor || (editor && editor.contains(composerBox))) {
      this.applyFallbackDock();
      return;
    }

    this.container.classList.remove("aio-fallback-dock");
    this.container.classList.add("aio-composer-floating");
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.alignDockTo(composerBox);
  }

  /** Places the floating bar just above the composer (or below when no headroom). */
  private alignDockTo(composerBox: HTMLElement): void {
    if (!this.container) return;
    const rect = composerBox.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const width = this.container.offsetWidth || 170;
    const height = this.container.offsetHeight || 30;

    let left = rect.left + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    let top = rect.top - height - 6;
    if (top < 8) top = rect.bottom + 6;

    this.container.style.left = `${Math.round(left)}px`;
    this.container.style.top = `${Math.round(top)}px`;
  }

  private applyFallbackDock(): void {
    if (!this.container) return;
    this.container.classList.remove("aio-composer-floating");
    this.container.classList.add("aio-fallback-dock");
    this.container.style.left = "";
    this.container.style.top = "";
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
  }

  /** rAF-coalesced re-align — safe to call on every mutation/scroll/resize. */
  private scheduleDockAlign(): void {
    if (this.alignScheduled) return;
    this.alignScheduled = true;
    requestAnimationFrame(() => {
      this.alignScheduled = false;
      if (!this.container) return;
      const composerBox = ChatComposerUtils.getComposerBox(document);
      if (composerBox && this.container.classList.contains("aio-composer-floating")) {
        this.alignDockTo(composerBox);
      } else {
        this.positionDock();
      }
    });
  }

  private startComposerWatcher(): void {
    if (this.observer) return;

    this.observer = new MutationObserver(() => {
      this.scheduleDockAlign();
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private bindMenuEvents(): void {
    if (!this.menuEl) return;

    const closeBtn = this.menuEl.querySelector(".aio-composer-menu-close");
    closeBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeMenu();
    });

    const formatButtons = this.menuEl.querySelectorAll<HTMLButtonElement>(
      ".aio-composer-menu-item[data-format]"
    );
    formatButtons.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const format = btn.getAttribute("data-format") as ExportFormat;
        this.closeMenu();
        if (format) {
          try {
            await this.callbacks.onExport(format);
            this.showToast(format === "pdf" ? "Print dialog opened!" : "Exported!");
          } catch (_err) {
            this.showToast("Export failed", true);
          }
        }
      });
    });

    const copyBtn = this.menuEl.querySelector(".aio-composer-copy-btn");
    copyBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeMenu();
      try {
        await this.callbacks.onCopy();
        this.showToast("Copied to clipboard!");
      } catch (_err) {
        this.showToast("Copy failed", true);
      }
    });
  }

  private onDocPointerDown = (e: Event): void => {
    if (!this.isOpen) return;
    const target = e.target as Node | null;
    if (!target) return;

    if (this.menuEl?.contains(target)) return;
    const trigger = this.container?.querySelector(".aio-export-trigger-btn");
    if (trigger?.contains(target)) return;

    this.closeMenu();
  };

  private onWindowScrollOrResize = (): void => {
    this.scheduleDockAlign();
    if (this.isOpen) {
      this.closeMenu();
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && this.isOpen) {
      e.preventDefault();
      e.stopPropagation();
      this.closeMenu();
    }
  };

  private bindEvents(): void {
    if (!this.container) return;

    const cavemanBtn = this.container.querySelector(".aio-caveman-toggle-btn");
    cavemanBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      // Click cycles: OFF -> LITE -> FULL -> ULTRA -> OFF
      const updated = await this.callbacks.onCycleCavemanLevel();
      this.updateSettings(updated);
      this.showToast(updated.enabled ? `Caveman: ${updated.level.toUpperCase()}` : "Caveman: OFF");
    });

    const exportBtn = this.container.querySelector(".aio-export-trigger-btn");
    exportBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    window.addEventListener("pointerdown", this.onDocPointerDown, true);
    window.addEventListener("scroll", this.onWindowScrollOrResize, true);
    window.addEventListener("resize", this.onWindowScrollOrResize, true);
    window.addEventListener("keydown", this.onKeyDown, true);
  }

  private updateCavemanButtonUi(): void {
    if (!this.container) return;
    const bar = this.container.querySelector(".aio-composer-bar");
    const icon = this.container.querySelector<SVGElement>(".aio-flame-icon");
    const badge = this.container.querySelector(".aio-lvl-badge");
    const btn = this.container.querySelector<HTMLButtonElement>(".aio-caveman-toggle-btn");

    const { enabled, level } = this.currentSettings;
    const flameColor = enabled ? "#f97316" : "#94a3b8";
    const levelValid = isValidCavemanLevel(level);
    const statusText = enabled ? (levelValid ? level.toUpperCase() : "STOP") : "OFF";

    if (bar) {
      enabled ? bar.classList.add("aio-caveman-on") : bar.classList.remove("aio-caveman-on");
    }
    if (icon) {
      icon.style.color = flameColor;
    }
    if (badge) {
      badge.textContent = statusText;
      badge.className = `aio-bar-badge aio-lvl-badge ${enabled && levelValid ? `aio-lvl-${level}` : ""}`;
    }
    if (btn) {
      btn.title = `Caveman Mode: ${statusText} (Click to cycle level)`;
    }
  }

  public toggleMenu(): void {
    this.isOpen ? this.closeMenu() : this.openMenu();
  }

  public openMenu(): void {
    if (!this.menuEl || !document.body.contains(this.menuEl) || !this.backdropEl) {
      this.renderMenu();
    }
    if (!this.menuEl || !this.container) return;

    const trigger = this.container.querySelector<HTMLElement>(".aio-export-trigger-btn");
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    this.backdropEl?.classList.add("open");
    this.menuEl.classList.add("open");

    const menuHeight = this.menuEl.offsetHeight || 220;
    const menuWidth = this.menuEl.offsetWidth || 185;

    // Position floating above trigger button, aligned to trigger left
    let top = rect.top - menuHeight - 8;
    if (top < 10) {
      top = rect.bottom + 8;
    }

    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (left < 12) {
      left = 12;
    }

    this.menuEl.style.top = `${Math.round(top)}px`;
    this.menuEl.style.left = `${Math.round(left)}px`;
    this.menuEl.style.bottom = "auto";
    this.menuEl.style.right = "auto";

    this.isOpen = true;

    const caret = this.container.querySelector<HTMLElement>(".aio-export-caret");
    if (caret) caret.style.transform = "rotate(180deg)";
  }

  public closeMenu(): void {
    this.backdropEl?.classList.remove("open");
    if (this.menuEl) {
      this.menuEl.classList.remove("open");
      this.isOpen = false;
    }
    const caret = this.container?.querySelector<HTMLElement>(".aio-export-caret");
    if (caret) caret.style.transform = "";
  }

  public showToast(message: string, isError = false): void {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const toast = document.createElement("div");
    toast.className = `aio-composer-toast ${isError ? "error" : "success"}`;
    toast.textContent = message;

    toast.style.position = "fixed";
    toast.style.zIndex = "2147483647";
    toast.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
    toast.style.left = `${rect.left + rect.width / 2}px`;
    toast.style.transform = "translateX(-50%) translateY(4px)";

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("show");
      toast.style.transform = "translateX(-50%) translateY(0)";
    }, 10);
    setTimeout(() => {
      toast.classList.remove("show");
      toast.style.transform = "translateX(-50%) translateY(4px)";
      setTimeout(() => toast.remove(), 250);
    }, 2000);
  }

  public unmount(): void {
    this.observer?.disconnect();
    this.observer = null;
    window.removeEventListener("pointerdown", this.onDocPointerDown, true);
    window.removeEventListener("scroll", this.onWindowScrollOrResize, true);
    window.removeEventListener("resize", this.onWindowScrollOrResize, true);
    window.removeEventListener("keydown", this.onKeyDown, true);
    this.backdropEl?.remove();
    this.backdropEl = null;
    this.container?.remove();
    this.container = null;
    this.menuEl?.remove();
    this.menuEl = null;
    this.isOpen = false;
  }
}
