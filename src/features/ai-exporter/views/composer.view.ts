import { renderIcon } from "@/lib/icons";
import { DEFAULT_CAVEMAN_SETTINGS, isValidCavemanLevel } from "../constants/ai-exporter.constants";
import type { CavemanSettings, ExportFormat } from "../types/ai-exporter.types";
import { ChatComposerUtils } from "../utils/chat-composer.utils";

export interface AiExporterComposerViewCallbacks {
  onExport: (format: ExportFormat) => Promise<void>;
  onCopy: () => Promise<void>;
  onToggleCaveman: () => Promise<CavemanSettings>;
  onCycleCavemanLevel: () => Promise<CavemanSettings>;
}

/** Floating pill toolbar docked above the chat composer (Caveman + Export). */
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
    const levelValid = isValidCavemanLevel(level);
    const statusText = enabled ? (levelValid ? level.toUpperCase() : "STOP") : "OFF";
    const badgeClass = enabled && levelValid ? `aio-lvl-${level}` : "";

    this.container.innerHTML = `
      <div class="aio-composer-bar flex h-7 select-none items-center gap-0.5 whitespace-nowrap rounded-full border border-white/10 bg-slate-900/70 px-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-colors ${enabled ? "aio-caveman-on border-orange-400/35 bg-[#281c14]/85 shadow-[0_0_10px_rgba(249,115,22,0.15),0_2px_8px_rgba(0,0,0,0.25)]" : ""}">
        <!-- Caveman Toggle Button -->
        <button type="button" class="aio-bar-btn aio-caveman-toggle-btn flex h-5.5 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-1.5 text-[11.5px] font-medium text-slate-300 outline-none transition-all hover:bg-white/10 hover:text-white" title="Caveman Mode: ${statusText} (Click to cycle level)">
          ${renderIcon("flame", 13, "aio-flame-icon")}
          <span class="aio-bar-btn-text text-[11px] font-medium tracking-[0.1px]">Caveman</span>
          <span class="aio-bar-badge aio-lvl-badge ${badgeClass} rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase leading-none tracking-[0.4px] transition-colors ${enabled ? "text-orange-200" : "bg-white/10 text-slate-400"}">${statusText}</span>
        </button>

        <div class="aio-bar-divider mx-0.5 h-3 w-px bg-white/10"></div>

        <!-- Export Menu Button -->
        <div class="aio-export-wrapper inline-flex">
          <button type="button" class="aio-bar-btn aio-export-trigger-btn flex h-5.5 cursor-pointer items-center gap-1 rounded-full border-0 bg-transparent px-1.5 text-[11.5px] font-medium text-slate-300 outline-none transition-all hover:bg-white/10 hover:text-white" title="Export Conversation">
            ${renderIcon("download", 13)}
            <span class="aio-bar-btn-text text-[11px] font-medium tracking-[0.1px]">Export</span>
            <span class="aio-export-caret text-[8px] opacity-55 transition-transform">▾</span>
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
    this.menuEl.className =
      "aio-composer-menu fixed z-2147483647 flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.65),0_2px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl [font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif]";
    this.menuEl.style.display = "none";
    this.menuEl.innerHTML = `
      <div class="aio-composer-menu-header flex items-center justify-between px-2.5 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-[0.6px] text-slate-500">
        <span>Export Conversation</span>
        <button type="button" class="aio-composer-menu-close flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-[13px] leading-none text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-100" title="Close menu">✕</button>
      </div>
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-medium text-slate-200 outline-none transition-all hover:bg-white/10 hover:text-white" data-format="markdown">
        ${renderIcon("markdown", 13)}
        <span>Markdown (.md)</span>
      </button>
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-medium text-slate-200 outline-none transition-all hover:bg-white/10 hover:text-white" data-format="pdf">
        ${renderIcon("pdf", 13)}
        <span>Print to PDF</span>
      </button>
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-medium text-slate-200 outline-none transition-all hover:bg-white/10 hover:text-white" data-format="json">
        ${renderIcon("json", 13)}
        <span>JSON (.json)</span>
      </button>
      <button type="button" class="aio-composer-menu-item flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-medium text-slate-200 outline-none transition-all hover:bg-white/10 hover:text-white" data-format="html">
        ${renderIcon("html", 13)}
        <span>HTML Document</span>
      </button>
      <div class="aio-composer-menu-divider my-1 h-px bg-white/10"></div>
      <button type="button" class="aio-composer-menu-item aio-composer-copy-btn flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-xs font-medium text-slate-200 outline-none transition-all hover:bg-white/10 hover:text-white">
        ${renderIcon("copy", 13)}
        <span>Copy to Clipboard</span>
      </button>
    `;
    document.body.appendChild(this.menuEl);
    this.bindMenuEvents();
  }

  /** Anchors the toolbar as a viewport-fixed overlay above the composer box. */
  private positionDock(): void {
    if (!this.container) return;

    const composerBox = ChatComposerUtils.getComposerBox(document);
    const editor = ChatComposerUtils.getEditor(document);

    if (!composerBox || composerBox === editor || editor?.contains(composerBox)) {
      this.applyFallbackDock();
      return;
    }

    this.container.classList.remove("aio-fallback-dock");
    this.container.classList.add("aio-composer-floating");
    this.container.style.position = "fixed";
    this.container.style.zIndex = "2147483641";
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
    this.container.style.position = "fixed";
    this.container.style.zIndex = "2147483640";
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
    const levelValid = isValidCavemanLevel(level);
    const statusText = enabled ? (levelValid ? level.toUpperCase() : "STOP") : "OFF";

    if (bar) {
      if (enabled) {
        bar.classList.add(
          "aio-caveman-on",
          "border-orange-400/35",
          "bg-[#281c14]/85",
          "shadow-[0_0_10px_rgba(249,115,22,0.15),0_2px_8px_rgba(0,0,0,0.25)]"
        );
        bar.classList.remove(
          "border-white/10",
          "bg-slate-900/70",
          "shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
        );
      } else {
        bar.classList.remove(
          "aio-caveman-on",
          "border-orange-400/35",
          "bg-[#281c14]/85",
          "shadow-[0_0_10px_rgba(249,115,22,0.15),0_2px_8px_rgba(0,0,0,0.25)]"
        );
        bar.classList.add(
          "border-white/10",
          "bg-slate-900/70",
          "shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
        );
      }
    }
    if (icon) {
      icon.style.color = enabled ? "#f97316" : "#94a3b8";
    }
    if (badge) {
      badge.textContent = statusText;
      badge.className = `aio-bar-badge aio-lvl-badge rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase leading-none tracking-[0.4px] transition-colors ${
        enabled ? `aio-lvl-${level} text-orange-200` : "bg-white/10 text-slate-400"
      }`;
      if (enabled && levelValid) {
        badge.classList.add(`aio-lvl-${level}`);
      }
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

    if (this.backdropEl) {
      this.backdropEl.style.position = "fixed";
      this.backdropEl.style.inset = "0";
      this.backdropEl.style.zIndex = "2147483646";
      this.backdropEl.style.display = "block";
    }
    this.menuEl.style.display = "flex";

    const menuHeight = this.menuEl.offsetHeight || 220;
    const menuWidth = this.menuEl.offsetWidth || 185;

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
    if (this.backdropEl) this.backdropEl.style.display = "none";
    if (this.menuEl) {
      this.menuEl.style.display = "none";
      this.isOpen = false;
    }
    const caret = this.container?.querySelector<HTMLElement>(".aio-export-caret");
    if (caret) caret.style.transform = "";
  }

  public showToast(message: string, isError = false): void {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const toast = document.createElement("div");
    toast.className = `aio-composer-toast fixed whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11.5px] font-medium text-slate-100 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all pointer-events-none ${
      isError ? "border-red-400/40 text-red-300" : "border-white/15 bg-slate-950/95"
    }`;
    toast.textContent = message;

    toast.style.zIndex = "2147483647";
    toast.style.bottom = `${Math.max(12, window.innerHeight - rect.top + 8)}px`;
    toast.style.left = `${rect.left + rect.width / 2}px`;
    toast.style.transform = "translateX(-50%) translateY(4px)";

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(() => {
      toast.style.transform = "translateX(-50%) translateY(4px)";
      toast.style.opacity = "0";
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
