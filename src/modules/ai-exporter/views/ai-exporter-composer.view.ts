import { renderIcon } from "@/shared/index";
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
  private currentSettings: CavemanSettings = { enabled: false, level: "full", sites: {} };

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
    const flameColor = enabled ? "#f97316" : "#94a3b8";
    const statusText = enabled ? level.toUpperCase() : "OFF";
    const badgeClass = enabled ? `aio-lvl-${level}` : "";

    this.container.innerHTML = `
      <div class="aio-composer-bar ${enabled ? "aio-caveman-on" : ""}">
        <!-- Caveman Toggle Button -->
        <button type="button" class="aio-bar-btn aio-caveman-toggle-btn" title="Caveman Mode: ${statusText} (Click to cycle level)">
          <svg class="aio-flame-icon" viewBox="0 0 24 24" width="13" height="13" fill="${flameColor}">
            <path d="M12 23c-4.97 0-9-4.03-9-9 0-3.32 1.8-6.19 4.47-7.68.27-.15.61-.13.86.06.25.18.36.49.28.79-.44 1.76-.04 3.71 1.09 5.09.17.21.43.32.7.3.27-.02.51-.17.63-.41.86-1.74 2.38-3.05 4.19-3.76.3-.12.64-.04.86.2.22.24.26.59.1.87-1.12 1.95-1.16 4.35-.12 6.34.14.26.4.42.7.42.06 0 .12 0 .18-.02.35-.08.6-.37.6-.73 0-2.3 1.15-4.46 3.09-5.78.28-.19.65-.18.91.03.26.21.35.56.23.88C20.67 13.91 21 15.42 21 17c0 3.31-2.69 6-6 6z"/>
          </svg>
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

    this.attachToBestContainer();
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

  private attachToBestContainer(): void {
    if (!this.container) return;

    const actionsRow = ChatComposerUtils.getActionsRow(document);
    const sendBtn = ChatComposerUtils.getSendButton(document);

    if (actionsRow) {
      this.container.classList.remove("aio-fallback-dock");
      this.container.classList.add("aio-docked-in-form");

      // Place right before sendBtn or its group if inside actionsRow
      if (sendBtn && actionsRow.contains(sendBtn)) {
        let insertRef: Node = sendBtn;
        if (
          sendBtn.parentElement &&
          sendBtn.parentElement !== actionsRow &&
          actionsRow.contains(sendBtn.parentElement)
        ) {
          insertRef = sendBtn.parentElement;
        }
        if (insertRef.parentNode === actionsRow && this.container.nextSibling !== insertRef) {
          actionsRow.insertBefore(this.container, insertRef);
          return;
        }
      }

      if (!actionsRow.contains(this.container)) {
        actionsRow.appendChild(this.container);
      }
      return;
    }

    const composerBox = ChatComposerUtils.getComposerBox(document);
    if (composerBox) {
      this.container.classList.remove("aio-fallback-dock");
      this.container.classList.add("aio-docked-in-form");
      if (!composerBox.contains(this.container)) {
        composerBox.appendChild(this.container);
      }
      return;
    }

    // Floating fallback until composer renders
    this.container.classList.remove("aio-docked-in-form");
    this.container.classList.add("aio-fallback-dock");
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
  }

  private startComposerWatcher(): void {
    if (this.observer) return;

    this.observer = new MutationObserver(() => {
      // If detached or still in fallback while composerBox has appeared, re-attach
      const composerBox = ChatComposerUtils.getComposerBox(document);
      if (composerBox && (!this.container || !composerBox.contains(this.container))) {
        this.attachToBestContainer();
      }
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
    const statusText = enabled ? level.toUpperCase() : "OFF";

    if (bar) {
      enabled ? bar.classList.add("aio-caveman-on") : bar.classList.remove("aio-caveman-on");
    }
    if (icon) {
      icon.setAttribute("fill", flameColor);
    }
    if (badge) {
      badge.textContent = statusText;
      badge.className = `aio-bar-badge aio-lvl-badge ${enabled ? `aio-lvl-${level}` : ""}`;
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
