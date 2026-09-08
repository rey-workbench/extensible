import {
  escapeHtml,
  type NestApplicationContext,
  type PopupViewController,
  type RegisteredModule,
} from "@/core/index";

/**
 * Extensity-Style Popup Shell.
 * Provides dynamic registered module discovery, high-density listing,
 * real-time search filtering, master toggle, and drill-down into module views.
 */
export class PopupShell {
  private readonly root: Document | ShadowRoot | HTMLElement;
  private readonly listView: HTMLElement | null;
  private readonly detailView: HTMLElement | null;
  private readonly moduleListContainer: HTMLElement | null;
  private readonly mountContainer: HTMLElement | null;
  private readonly searchInput: HTMLInputElement | null;
  private readonly clearSearchBtn: HTMLElement | null;
  private readonly backBtn: HTMLElement | null;
  private readonly detailTitle: HTMLElement | null;
  private readonly masterToggle: HTMLInputElement | null;

  private modules: RegisteredModule[] = [];
  private enabledMap: Map<string, boolean> = new Map();
  public activeModule: RegisteredModule | null = null;
  public activeController: PopupViewController | null = null;

  constructor(
    public readonly app: NestApplicationContext,
    rootElement: Document | ShadowRoot | HTMLElement = document
  ) {
    this.root = rootElement;
    this.listView = this._query("#extListView");
    this.detailView = this._query("#extDetailView");
    this.moduleListContainer = this._query("#moduleList");
    this.mountContainer = this._query("#moduleMount");
    this.searchInput = this._query<HTMLInputElement>("#extSearchInput");
    this.clearSearchBtn = this._query("#extClearSearch");
    this.backBtn = this._query("#backToListBtn");
    this.detailTitle = this._query("#detailTitle");
    this.masterToggle = this._query<HTMLInputElement>("#masterToggle");
  }

  private _query<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    return this.root.querySelector(selector) as T | null;
  }

  init(): void {
    const allModules = this.app.getModules();
    this.modules = allModules.filter(
      (m) =>
        m.controllers &&
        m.controllers.length > 0 &&
        m.controllers.some(
          (c) => c.constructor.contextType === "popup" || typeof c.mount === "function"
        )
    );

    // Initialize all modules as enabled by default
    for (const mod of this.modules) {
      this.enabledMap.set(mod.id, true);
    }

    this._bindEvents();
    this.renderList();
  }

  private _bindEvents(): void {
    // Search input filtering
    if (this.searchInput) {
      this.searchInput.addEventListener("input", () => {
        const query = this.searchInput?.value.trim().toLowerCase() || "";
        if (this.clearSearchBtn) {
          this.clearSearchBtn.classList.toggle("visible", query.length > 0);
        }
        this.renderList(query);
      });
    }

    // Clear search
    if (this.clearSearchBtn) {
      this.clearSearchBtn.addEventListener("click", () => {
        if (this.searchInput) {
          this.searchInput.value = "";
        }
        this.clearSearchBtn!.classList.remove("visible");
        this.renderList("");
        this.searchInput?.focus();
      });
    }

    // Back to list navigation
    if (this.backBtn) {
      this.backBtn.addEventListener("click", () => {
        this.showListView();
      });
    }

    // Master switch
    if (this.masterToggle) {
      this.masterToggle.addEventListener("change", () => {
        const isMasterOn = this.masterToggle!.checked;
        this.modules.forEach((m) => {
          this.enabledMap.set(m.id, isMasterOn);
        });
        this.renderList(this.searchInput?.value.trim().toLowerCase() || "");
      });
    }
  }

  renderList(filterQuery = ""): void {
    if (!this.moduleListContainer) return;

    const filtered = this.modules.filter((m) => {
      const name = (m.name || m.id).toLowerCase();
      const id = m.id.toLowerCase();
      return name.includes(filterQuery) || id.includes(filterQuery);
    });

    if (filtered.length === 0) {
      this.moduleListContainer.innerHTML = `
        <div class="ext-empty">
          No extensions found matching "${escapeHtml(filterQuery)}".
        </div>
      `;
      return;
    }

    this.moduleListContainer.innerHTML = filtered
      .map((mod) => {
        const isEnabled = this.enabledMap.get(mod.id) ?? true;
        const iconSvg = this._renderModuleIcon(mod);
        const subtitle = !isEnabled ? "Disabled" : mod.description || "Active & Running";

        return `
        <div class="ext-item ${isEnabled ? "" : "disabled"}" data-module-id="${mod.id}" role="listitem">
          <div class="ext-item-icon">
            ${iconSvg}
          </div>
          <div class="ext-item-info">
            <span class="ext-item-title">${escapeHtml(mod.name)}</span>
            <span class="ext-item-subtitle" id="sub_${mod.id}">
              ${escapeHtml(subtitle)}
            </span>
          </div>
          <div class="ext-item-actions">
            <button type="button" class="ext-item-gear" data-open-id="${mod.id}" title="Open ${escapeHtml(mod.name)}" aria-label="Open ${escapeHtml(mod.name)}">
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    // Attach click listeners to rows
    this.moduleListContainer.querySelectorAll(".ext-item").forEach((item) => {
      item.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        const moduleId = (item as HTMLElement).dataset.moduleId;
        const mod = this.modules.find((m) => m.id === moduleId);
        if (!mod) return;

        // If clicking gear or clicking row, open module detail
        if (target.closest(".ext-item-gear") || !target.closest(".ext-item-toggle")) {
          await this.openModuleDetail(mod);
        }
      });
    });
  }

  async openModuleDetail(moduleInfo: RegisteredModule): Promise<void> {
    if (!this.mountContainer) return;

    if (this.activeController) {
      if (typeof this.activeController.unmount === "function") {
        this.activeController.unmount();
      } else if (typeof this.activeController.onModuleDestroy === "function") {
        this.activeController.onModuleDestroy();
      }
      this.activeController = null;
    }

    this.mountContainer.innerHTML = "";
    this.activeModule = moduleInfo;

    if (this.detailTitle) {
      this.detailTitle.textContent = moduleInfo.name || moduleInfo.id;
    }

    // Switch view to Detail View
    this.listView?.classList.remove("active");
    this.detailView?.classList.add("active");

    const ctrl =
      (moduleInfo.controllers.find(
        (c) =>
          c &&
          (c.constructor.contextType === "popup" ||
            typeof (c as PopupViewController).mount === "function")
      ) as PopupViewController | undefined) ?? null;

    if (ctrl) {
      this.activeController = ctrl;
      if (typeof ctrl.mount === "function") {
        await ctrl.mount(this.mountContainer);
      }
    } else {
      this.mountContainer.innerHTML = `
        <div class="ext-empty">
          No view renderer available for ${escapeHtml(moduleInfo.name)}.
        </div>
      `;
    }
  }

  showListView(): void {
    if (this.activeController && typeof this.activeController.unmount === "function") {
      this.activeController.unmount();
      this.activeController = null;
    }
    this.activeModule = null;

    this.detailView?.classList.remove("active");
    this.listView?.classList.add("active");
    this.renderList(this.searchInput?.value.trim().toLowerCase() || "");
  }

  suspend(): void {
    if (this.activeController && typeof this.activeController.unmount === "function") {
      this.activeController.unmount();
      this.activeController = null;
    }
  }

  async resume(): Promise<void> {
    if (this.activeModule) {
      await this.openModuleDetail(this.activeModule);
    }
  }

  private _renderModuleIcon(mod: RegisteredModule): string {
    if (mod.icon && mod.icon.trim().length > 0) {
      return mod.icon;
    }
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" style="color: #3b82f6;">
        <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    `;
  }
}
