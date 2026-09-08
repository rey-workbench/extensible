import { ExtensionUtils, type NestApplicationContext } from "@/core/index";
import { PopupShell } from "@/popup/popup-shell";
import { APP_CONFIG } from "@/shared/index";

declare const __POPUP_CSS__: string;

/**
 * Floating Right-Side Notch and Slideout Drawer using isolated Shadow DOM.
 * Always accessible on every webpage.
 */
export class SideNotchView {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private isOpen = false;
  private popupShell: PopupShell | null = null;

  constructor(private readonly app: NestApplicationContext) {}

  init(): void {
    if (document.getElementById("aio-side-notch-host")) return;

    this.host = document.createElement("div");
    this.host.id = "aio-side-notch-host";
    this.host.style.all = "initial";
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: "open" });
    this._render();
    this._bind();
  }

  private _render(): void {
    if (!this.shadow) return;

    const popupStyles = typeof __POPUP_CSS__ !== "undefined" ? __POPUP_CSS__ : "";

    this.shadow.innerHTML = `
      <style>
        ${popupStyles}

        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 2147483645;
          position: fixed;
        }

        /* Floating Notch Handle */
        .notch-handle {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 38px;
          height: 52px;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-right: none;
          border-radius: 12px 0 0 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: -4px 0 16px rgba(0, 0, 0, 0.35);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2147483646;
          user-select: none;
        }

        .notch-handle:hover {
          width: 46px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
          box-shadow: -6px 0 20px rgba(59, 130, 246, 0.5);
        }

        .notch-icon {
          width: 18px;
          height: 18px;
          fill: none;
          stroke: #f8fafc;
          transition: transform 0.2s;
        }

        .notch-handle:hover .notch-icon {
          transform: scale(1.15);
        }

        .notch-dot {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 7px;
          height: 7px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 6px #10b981;
        }

        /* Backdrop */
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(3px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          z-index: 2147483646;
        }

        .backdrop.visible {
          opacity: 1;
          pointer-events: auto;
        }

        /* Slideout Drawer */
        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          width: 320px;
          max-width: 90vw;
          height: 100vh;
          background: #ffffff;
          border-left: 1px solid #e2e8f0;
          box-shadow: -8px 0 25px rgba(0, 0, 0, 0.15);
          transform: translateX(100%);
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #202124;
          overflow: hidden;
        }

        .drawer.open {
          transform: translateX(0);
        }

        /* Drawer Header */
        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: rgba(15, 23, 42, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .drawer-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-logo {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brand-logo svg {
          width: 14px;
          height: 14px;
          fill: #ffffff;
        }

        .brand-name {
          font-size: 14px;
          font-weight: 700;
          color: #f8fafc;
        }

        .btn-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.15s;
        }

        .btn-close:hover {
          color: #f8fafc;
        }

        .drawer .ext-shell {
          height: 100%;
        }
      </style>

      <!-- Notch Handle -->
      <div class="notch-handle" id="notchBtn" title="${APP_CONFIG.EXTENSION_NAME} - Click to open">
        <span class="notch-dot"></span>
        <svg class="notch-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f8fafc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 12h7a3.5 3.5 0 10-1.2 2.6"/>
          <path d="M14 8.5l6 7M14 15.5l6-7"/>
        </svg>
      </div>

      <!-- Backdrop Overlay -->
      <div class="backdrop" id="drawerBackdrop"></div>

      <!-- Slideout Drawer Panel -->
      <div class="drawer" id="sideDrawer">
        <div class="ext-shell">
          <!-- Top Header Bar -->
          <header class="ext-header">
            <div class="ext-brand">
              <div class="ext-logo">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="6" fill="#0f172a"/>
                  <path d="M4.5 12h6.5a3.2 3.2 0 10-1 2.4" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M13.5 9l5.5 6M13.5 15l5.5-6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1 class="ext-title">Extensible</h1>
            </div>

            <div class="ext-actions">
              <label class="ext-switch" for="masterToggle" title="Toggle all extensions">
                <input type="checkbox" id="masterToggle" title="Toggle all extensions" aria-label="Toggle all extensions" checked>
                <span class="ext-slider"></span>
              </label>
              <button type="button" class="btn-close" id="drawerCloseBtn" title="Close panel">&times;</button>
            </div>
          </header>

          <!-- Inset Search Input -->
          <div class="ext-search-bar">
            <span class="ext-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </span>
            <input type="text" id="extSearchInput" class="ext-search-input" placeholder="Search extensions..." autocomplete="off" spellcheck="false">
            <button type="button" id="extClearSearch" class="ext-clear-btn" title="Clear search" aria-label="Clear search">&times;</button>
          </div>

          <!-- Main View 1: Extensity List View -->
          <div id="extListView" class="ext-view active">
            <div class="ext-section-header">
              <span>Extensions</span>
            </div>
            <div id="moduleList" class="ext-list" role="list"></div>
          </div>

          <!-- Main View 2: Module Detail View -->
          <div id="extDetailView" class="ext-view">
            <div class="ext-nav-bar">
              <button type="button" id="backToListBtn" class="ext-back-btn">
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                <span>Back to Extensions</span>
              </button>
              <span id="detailTitle" class="ext-detail-title">Extension</span>
            </div>
            <main class="ext-mount-container" id="moduleMount"></main>
          </div>
        </div>
      </div>
    `;
  }

  private _bind(): void {
    if (!this.shadow) return;

    const notchBtn = this.shadow.getElementById("notchBtn");
    const closeBtn = this.shadow.getElementById("drawerCloseBtn");
    const backdrop = this.shadow.getElementById("drawerBackdrop");
    const _drawer = this.shadow.getElementById("sideDrawer");

    notchBtn?.addEventListener("click", () => {
      this.toggleDrawer();
    });

    closeBtn?.addEventListener("click", () => {
      this.closeDrawer();
    });

    backdrop?.addEventListener("click", () => {
      this.closeDrawer();
    });

    // Initialize Extensity PopupShell inside Shadow DOM drawer!
    this.popupShell = new PopupShell(this.app, this.shadow);
    this.popupShell.init();
  }

  toggleDrawer(): void {
    if (this.isOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer(): void {
    if (!this.shadow) return;
    const drawer = this.shadow.getElementById("sideDrawer");
    const backdrop = this.shadow.getElementById("drawerBackdrop");
    const notch = this.shadow.getElementById("notchBtn");

    drawer?.classList.add("open");
    backdrop?.classList.add("visible");
    if (notch) notch.style.opacity = "0";
    this.isOpen = true;
    this.popupShell?.resume().catch((err) => {
      if (ExtensionUtils.isContextInvalidated(err)) return;
      console.error("[SideNotchView] Resume error:", err);
    });
  }

  closeDrawer(): void {
    if (!this.shadow) return;
    const drawer = this.shadow.getElementById("sideDrawer");
    const backdrop = this.shadow.getElementById("drawerBackdrop");
    const notch = this.shadow.getElementById("notchBtn");

    drawer?.classList.remove("open");
    backdrop?.classList.remove("visible");
    if (notch) notch.style.opacity = "1";
    this.isOpen = false;
    this.popupShell?.suspend();
  }
}
