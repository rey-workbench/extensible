import globalCss from "@/styles/global.css?inline";
import { DEFAULT_CAVEMAN_SETTINGS } from "../constants/ai-toolkit.constants";
import type { CavemanSettings, ExportFormat } from "../types/ai-toolkit.types";
import { ChatComposerUtils } from "../utils/chat-composer.utils";
import {
  buildMenuHtml,
  buildToolbarHtml,
  formatExportError,
  updateCavemanButtonUi,
} from "./composer/dom-builder";
import { computeDockPlacement, computeMenuPlacement } from "./composer/positioning";
import { showComposerToast } from "./composer/toast";

export interface AiToolkitComposerViewCallbacks {
  onExport: (format: ExportFormat) => Promise<void>;
  onCopy: () => Promise<void>;
  onToggleCaveman: () => Promise<CavemanSettings>;
  onCycleCavemanLevel: () => Promise<CavemanSettings>;
}

/** Floating pill toolbar docked above the chat composer (Caveman + Export). */
export class AiToolkitComposerView {
  private hostEl: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private container: HTMLElement | null = null;
  private menuEl: HTMLElement | null = null;
  private backdropEl: HTMLElement | null = null;
  private isOpen = false;
  private observer: MutationObserver | null = null;
  private currentSettings: CavemanSettings = DEFAULT_CAVEMAN_SETTINGS;
  private alignScheduled = false;

  constructor(private readonly callbacks: AiToolkitComposerViewCallbacks) {}

  public mount(initialSettings?: CavemanSettings): void {
    if (initialSettings) {
      this.currentSettings = initialSettings;
    }
    this.loadFont();
    this.renderToolbar();
    this.startComposerWatcher();
  }

  /** Ensures an isolated Shadow Root host exists for zero-leakage styling. */
  private ensureShadowHost(): ShadowRoot {
    if (this.shadow && this.hostEl && document.body.contains(this.hostEl)) {
      return this.shadow;
    }
    let host = document.getElementById("aio-composer-overlay-host");
    if (host) {
      host.remove();
    }
    host = document.createElement("div");
    host.id = "aio-composer-overlay-host";
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.width = "100vw";
    host.style.height = "100vh";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483640";
    document.body.appendChild(host);

    this.hostEl = host;
    this.shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        font-family: 'Space Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #1A1A1A;
        box-sizing: border-box;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      button {
        font-family: inherit;
        font-size: inherit;
        line-height: inherit;
        color: inherit;
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
      }
      ${globalCss}
    `;
    this.shadow.appendChild(style);
    return this.shadow;
  }

  /** Load Space Grotesk (Bauhaus typeface) into the host page — scoped to AI chat pages. */
  private loadFont(): void {
    if (document.getElementById("aio-space-grotesk-font")) return;
    const link = document.createElement("link");
    link.id = "aio-space-grotesk-font";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }

  public updateSettings(settings: CavemanSettings): void {
    this.currentSettings = settings;
    updateCavemanButtonUi(this.container, settings);
  }

  private renderToolbar(): void {
    const shadow = this.ensureShadowHost();
    const existing = shadow.querySelector("#aio-composer-bar-root");
    if (existing) existing.remove();

    this.container = document.createElement("div");
    this.container.id = "aio-composer-bar-root";
    this.container.className = "aio-composer-bar-root";
    this.container.style.pointerEvents = "auto";
    this.container.innerHTML = buildToolbarHtml(this.currentSettings);

    this.positionDock();
    this.renderMenu();
    this.bindEvents();
  }

  private renderMenu(): void {
    const shadow = this.ensureShadowHost();
    const existing = shadow.querySelector("#aio-composer-menu-root");
    if (existing) existing.remove();
    const existingBackdrop = shadow.querySelector("#aio-composer-backdrop-root");
    if (existingBackdrop) existingBackdrop.remove();

    this.backdropEl = document.createElement("div");
    this.backdropEl.id = "aio-composer-backdrop-root";
    this.backdropEl.className = "aio-menu-backdrop";
    this.backdropEl.style.position = "fixed";
    this.backdropEl.style.inset = "0";
    this.backdropEl.style.zIndex = "2147483642";
    this.backdropEl.style.pointerEvents = "auto";
    this.backdropEl.style.display = "none";
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
    shadow.appendChild(this.backdropEl);

    this.menuEl = document.createElement("div");
    this.menuEl.id = "aio-composer-menu-root";
    this.menuEl.className =
      "aio-composer-menu fixed z-2147483647 flex-col overflow-hidden rounded-lg border-[1.5px] border-solid border-[#2B2B2B] bg-[#FFFDF7] p-1.5 shadow-[3px_3px_0_#1A1A1A]";
    this.menuEl.style.position = "fixed";
    this.menuEl.style.zIndex = "2147483643";
    this.menuEl.style.pointerEvents = "auto";
    this.menuEl.style.display = "none";
    this.menuEl.innerHTML = buildMenuHtml();
    shadow.appendChild(this.menuEl);
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
    this.container.style.pointerEvents = "auto";
    const shadow = this.ensureShadowHost();
    if (!shadow.contains(this.container)) {
      shadow.appendChild(this.container);
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
    const { left, top } = computeDockPlacement(rect, width, height);

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  private applyFallbackDock(): void {
    if (!this.container) return;
    this.container.classList.remove("aio-composer-floating");
    this.container.classList.add("aio-fallback-dock");
    this.container.style.position = "fixed";
    this.container.style.zIndex = "2147483640";
    this.container.style.pointerEvents = "auto";
    this.container.style.bottom = "80px";
    this.container.style.right = "24px";
    this.container.style.left = "";
    this.container.style.top = "";
    const shadow = this.ensureShadowHost();
    if (!shadow.contains(this.container)) {
      shadow.appendChild(this.container);
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
          } catch (err) {
            console.warn("[AiToolkit] Export failed:", err);
            this.showToast(formatExportError(err), true);
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
      } catch (err) {
        console.warn("[AiToolkit] Copy failed:", err);
        this.showToast(
          err instanceof Error && err.message ? `Copy failed: ${err.message}` : "Copy failed",
          true
        );
      }
    });
  }

  private onDocPointerDown = (e: Event): void => {
    if (!this.isOpen) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (this.menuEl && path.includes(this.menuEl)) return;
    const trigger = this.container?.querySelector(".aio-export-trigger-btn");
    if (trigger && path.includes(trigger)) return;

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

  public toggleMenu(): void {
    this.isOpen ? this.closeMenu() : this.openMenu();
  }

  public openMenu(): void {
    const shadow = this.ensureShadowHost();
    if (!this.menuEl || !shadow.contains(this.menuEl) || !this.backdropEl) {
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
      this.backdropEl.style.zIndex = "2147483642";
      this.backdropEl.style.display = "block";
    }
    this.menuEl.style.display = "flex";

    const menuHeight = this.menuEl.offsetHeight || 220;
    const menuWidth = this.menuEl.offsetWidth || 185;
    const { top, left } = computeMenuPlacement(rect, menuWidth, menuHeight);

    this.menuEl.style.top = `${top}px`;
    this.menuEl.style.left = `${left}px`;
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
    showComposerToast(this.container, message, isError);
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
    document.getElementById("aio-space-grotesk-font")?.remove();
    this.hostEl?.remove();
    this.hostEl = null;
    this.shadow = null;
    this.container?.remove();
    this.container = null;
    this.menuEl?.remove();
    this.menuEl = null;
    this.isOpen = false;
  }
}
