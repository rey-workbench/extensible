import { escapeHtml } from "@/core/index";
import {
  renderBadge,
  renderButton,
  renderCard,
  renderEmptyState,
  renderIcon,
  renderSectionHeader,
} from "@/shared/components/index";
import {
  AI_PLATFORMS,
  CAVEMAN_HINTS,
  CAVEMAN_LEVELS,
  type CavemanLevel,
} from "../constants/ai-exporter.constants";
import type {
  CavemanSettings,
  ChatConversation,
  ExportFormat,
  ExportHistoryItem,
} from "../types/ai-exporter.types";

export interface AiExporterPopupViewCallbacks {
  onExport: (format: ExportFormat) => Promise<void>;
  onCopy: () => Promise<void>;
  onRefreshActiveTab: (deepHydrate?: boolean) => Promise<void>;
  onDownloadHistoryItem: (id: string) => Promise<void>;
  onCopyHistoryItem: (id: string) => Promise<void>;
  onDeleteHistoryItem: (id: string) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onToggleCaveman: (enabled: boolean) => Promise<void>;
  onSetCavemanLevel: (level: CavemanLevel) => Promise<void>;
}

export class AiExporterPopupView {
  private root: HTMLElement | null = null;
  private currentConvo: ChatConversation | null = null;
  private history: ExportHistoryItem[] = [];
  private cavemanSettings: CavemanSettings = { enabled: false, level: "full", sites: {} };
  private isLoading = false;
  private statusMessage: { text: string; isError?: boolean } | null = null;

  constructor(private readonly callbacks: AiExporterPopupViewCallbacks) {}

  public render(
    container: HTMLElement,
    convo: ChatConversation | null,
    history: ExportHistoryItem[],
    caveman: CavemanSettings
  ): void {
    this.root = container;
    this.currentConvo = convo;
    this.history = history;
    this.cavemanSettings = caveman;
    this.updateDom();
  }

  public updateState(
    convo: ChatConversation | null,
    history: ExportHistoryItem[],
    caveman?: CavemanSettings
  ): void {
    this.currentConvo = convo;
    this.history = history;
    if (caveman) {
      this.cavemanSettings = caveman;
    }
    this.updateDom();
  }

  public setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.updateDom();
  }

  public showStatus(text: string, isError = false): void {
    this.statusMessage = { text, isError };
    this.updateDom();
    setTimeout(() => {
      if (this.statusMessage?.text === text) {
        this.statusMessage = null;
        this.updateDom();
      }
    }, 2500);
  }

  private updateDom(): void {
    if (!this.root) return;

    const convo = this.currentConvo;
    const history = this.history;
    const caveman = this.cavemanSettings;

    const activeCard = this.renderActiveChatCard(convo);
    const cavemanCard = this.renderCavemanCard(caveman);
    const historySection = this.renderHistorySection(history);

    const statusHtml = this.statusMessage
      ? `
      <div class="ai-status-banner ${this.statusMessage.isError ? "error" : "success"}">
        <span>${escapeHtml(this.statusMessage.text)}</span>
      </div>`
      : "";

    this.root.innerHTML = `
      <div class="ai-exporter-container">
        ${statusHtml}
        ${activeCard}
        ${cavemanCard}
        <div class="ai-history-section">
          ${historySection}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderActiveChatCard(convo: ChatConversation | null): string {
    if (!convo) {
      const content = `
        <div class="ai-no-chat-box">
          <p class="ai-notice-text">
            Navigate to ChatGPT, Claude, Gemini, or DeepSeek to export your conversations.
          </p>
          <div class="ai-action-row">
            ${renderButton({
              id: "ai-btn-detect-tab",
              text: "Inspect Active Tab",
              variant: "secondary",
              size: "sm",
              disabled: this.isLoading,
            })}
          </div>
        </div>
      `;

      return renderCard(content, {
        title: "Active AI Session",
        headerAction: renderBadge({ text: "Not Detected", variant: "neutral" }),
      });
    }

    const platformConfig = AI_PLATFORMS[convo.platform] || AI_PLATFORMS.generic;
    const wordCountText = convo.totalWords ? `${convo.totalWords.toLocaleString()} words` : "";

    const contentHtml = `
      <div class="ai-detected-box">
        <div class="ai-chat-header-info">
          <h4 class="ai-chat-title" title="${escapeHtml(convo.title)}">${escapeHtml(convo.title)}</h4>
          <div class="ai-chat-meta">
            ${renderBadge({ text: `${convo.messages.length} messages`, variant: "primary" })}
            ${wordCountText ? `<span class="ai-meta-divider">•</span><span class="ai-meta-text">${wordCountText}</span>` : ""}
          </div>
        </div>

        <div class="ai-export-grid">
          ${renderButton({
            id: "ai-btn-export-md",
            text: "Markdown (.md)",
            variant: "primary",
            size: "sm",
            disabled: this.isLoading,
            icon: renderIcon("markdown", 14),
          })}
          ${renderButton({
            id: "ai-btn-export-pdf",
            text: "Print to PDF",
            variant: "secondary",
            size: "sm",
            disabled: this.isLoading,
            icon: renderIcon("pdf", 14),
          })}
          ${renderButton({
            id: "ai-btn-export-json",
            text: "JSON (.json)",
            variant: "secondary",
            size: "sm",
            disabled: this.isLoading,
            icon: renderIcon("json", 14),
          })}
          ${renderButton({
            id: "ai-btn-export-html",
            text: "HTML Document",
            variant: "secondary",
            size: "sm",
            disabled: this.isLoading,
            icon: renderIcon("html", 14),
          })}
          ${renderButton({
            id: "ai-btn-copy-chat",
            text: "Copy Text",
            variant: "secondary",
            size: "sm",
            disabled: this.isLoading,
            icon: renderIcon("copy", 14),
          })}
          ${renderButton({
            id: "ai-btn-hydrate-chat",
            text: "Scrape All Turns",
            variant: "secondary",
            size: "sm",
            disabled: this.isLoading,
            icon: renderIcon("refresh", 14),
          })}
        </div>
      </div>
    `;

    return renderCard(contentHtml, {
      title: "Active AI Session",
      headerAction: renderBadge({
        text: platformConfig.name,
        variant: convo.platform === "chatgpt" ? "success" : "primary",
      }),
    });
  }

  private renderCavemanCard(settings: CavemanSettings): string {
    const isEnabled = settings.enabled;
    const currentLevel = settings.level;
    const hint = CAVEMAN_HINTS[currentLevel] || "";

    const contentHtml = `
      <div class="ai-caveman-card-body">
        <div class="ai-caveman-header-row">
          <div class="ai-caveman-desc-box">
            <span class="ai-caveman-label">Terse Response Mode</span>
            <span class="ai-caveman-sub">Strip fluff, pleasantries & hedging. Retain 100% technical code & substance.</span>
          </div>
          <label class="ext-toggle ai-caveman-switch">
            <input type="checkbox" id="ai-caveman-toggle" ${isEnabled ? "checked" : ""}>
            <span class="ext-toggle-slider"></span>
          </label>
        </div>

        <div class="ai-caveman-level-row">
          <span class="ai-caveman-level-title">Intensity:</span>
          <div class="ai-caveman-pills">
            ${CAVEMAN_LEVELS.map(
              (lvl) => `
              <button type="button" class="ai-level-pill ${currentLevel === lvl ? "active" : ""}" data-level="${lvl}">
                ${lvl.toUpperCase()}
              </button>
            `
            ).join("")}
          </div>
        </div>

        <div class="ai-caveman-hint" id="ai-caveman-hint">${escapeHtml(hint)}</div>
      </div>
    `;

    return renderCard(contentHtml, {
      title: "Caveman Mode",
      headerAction: renderBadge({
        text: isEnabled ? "ON" : "OFF",
        variant: isEnabled ? "warning" : "neutral",
      }),
    });
  }

  private renderHistorySection(history: ExportHistoryItem[]): string {
    const clearBtn =
      history.length > 0
        ? renderButton({
            id: "ai-btn-clear-history",
            text: "Clear",
            variant: "ghost",
            size: "sm",
            disabled: this.isLoading,
          })
        : undefined;

    const countBadge =
      history.length > 0
        ? renderBadge({ text: `${history.length}`, variant: "neutral" })
        : undefined;

    const header = renderSectionHeader("Export History", {
      action: clearBtn,
      badge: countBadge,
    });

    if (history.length === 0) {
      return `
        ${header}
        ${renderEmptyState({
          title: "No exported chats yet",
          subtitle: "Exported sessions will be recorded here.",
        })}
      `;
    }

    const itemsHtml = history
      .map((item) => {
        const dateStr = new Date(item.exportedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const platformName = AI_PLATFORMS[item.platform]?.name || item.platform;
        const hasCachedContent = !!item.content;

        return `
        <div class="ext-item ai-history-row" data-id="${escapeHtml(item.id)}">
          <div class="ext-item-icon ai-platform-icon ai-plat-${escapeHtml(item.platform)}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </div>
          <div class="ext-item-content">
            <div class="ext-item-title">${escapeHtml(item.title)}</div>
            <div class="ext-item-subtitle">
              <span>${escapeHtml(platformName)}</span>
              <span class="ai-meta-divider">•</span>
              <span>${escapeHtml(item.format.toUpperCase())}</span>
              <span class="ai-meta-divider">•</span>
              <span>${dateStr}</span>
            </div>
          </div>
          <div class="ext-item-actions">
            ${
              hasCachedContent
                ? `
            <button type="button" class="ext-btn ext-btn-ghost ext-btn-sm ai-btn-dl-history" data-id="${escapeHtml(item.id)}" title="Re-download" aria-label="Re-download">
              <span class="ext-btn-icon">${renderIcon("download", 14)}</span>
            </button>
            <button type="button" class="ext-btn ext-btn-ghost ext-btn-sm ai-btn-copy-history" data-id="${escapeHtml(item.id)}" title="Copy Content" aria-label="Copy Content">
              <span class="ext-btn-icon">${renderIcon("copy", 14)}</span>
            </button>`
                : ""
            }
            <button type="button" class="ext-btn ext-btn-ghost ext-btn-sm ai-btn-del-history" data-id="${escapeHtml(item.id)}" title="Delete" aria-label="Delete">
              <span class="ext-btn-icon">${renderIcon("trash", 14)}</span>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    return `
      ${header}
      <div class="ext-list ai-history-list">
        ${itemsHtml}
      </div>
    `;
  }

  private bindEvents(): void {
    if (!this.root) return;

    // Detect / Refresh active tab button
    const detectBtn = this.root.querySelector("#ai-btn-detect-tab");
    detectBtn?.addEventListener("click", async () => {
      this.setLoading(true);
      try {
        await this.callbacks.onRefreshActiveTab(false);
      } finally {
        this.setLoading(false);
      }
    });

    // Hydrate & scrape all turns
    const hydrateBtn = this.root.querySelector("#ai-btn-hydrate-chat");
    hydrateBtn?.addEventListener("click", async () => {
      this.setLoading(true);
      try {
        await this.callbacks.onRefreshActiveTab(true);
        this.showStatus("Scraped all visible turns!");
      } finally {
        this.setLoading(false);
      }
    });

    // Caveman Toggle Switch
    const cavemanToggle = this.root.querySelector<HTMLInputElement>("#ai-caveman-toggle");
    cavemanToggle?.addEventListener("change", async (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      await this.callbacks.onToggleCaveman(isChecked);
      this.showStatus(isChecked ? "Caveman Mode enabled" : "Caveman Mode disabled");
    });

    // Caveman Level Pills
    const levelPills = this.root.querySelectorAll<HTMLButtonElement>(".ai-level-pill[data-level]");
    levelPills.forEach((pill) => {
      pill.addEventListener("click", async () => {
        const level = pill.getAttribute("data-level") as CavemanLevel;
        if (level) {
          await this.callbacks.onSetCavemanLevel(level);
          this.showStatus(`Caveman level: ${level.toUpperCase()}`);
        }
      });
    });

    // Markdown export
    const exportMdBtn = this.root.querySelector("#ai-btn-export-md");
    exportMdBtn?.addEventListener("click", async () => {
      await this.handleExportAction("markdown");
    });

    // PDF export
    const exportPdfBtn = this.root.querySelector("#ai-btn-export-pdf");
    exportPdfBtn?.addEventListener("click", async () => {
      await this.handleExportAction("pdf");
    });

    // JSON export
    const exportJsonBtn = this.root.querySelector("#ai-btn-export-json");
    exportJsonBtn?.addEventListener("click", async () => {
      await this.handleExportAction("json");
    });

    // HTML export
    const exportHtmlBtn = this.root.querySelector("#ai-btn-export-html");
    exportHtmlBtn?.addEventListener("click", async () => {
      await this.handleExportAction("html");
    });

    // Copy button
    const copyBtn = this.root.querySelector("#ai-btn-copy-chat");
    copyBtn?.addEventListener("click", async () => {
      this.setLoading(true);
      try {
        await this.callbacks.onCopy();
        this.showStatus("Copied to clipboard!");
      } catch (_err) {
        this.showStatus("Copy failed", true);
      } finally {
        this.setLoading(false);
      }
    });

    // Re-download from history
    const dlBtns = this.root.querySelectorAll<HTMLButtonElement>(".ai-btn-dl-history[data-id]");
    dlBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (id) {
          await this.callbacks.onDownloadHistoryItem(id);
          this.showStatus("Re-downloaded!");
        }
      });
    });

    // Copy from history
    const copyHistoryBtns = this.root.querySelectorAll<HTMLButtonElement>(
      ".ai-btn-copy-history[data-id]"
    );
    copyHistoryBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (id) {
          await this.callbacks.onCopyHistoryItem(id);
          this.showStatus("Copied from history!");
        }
      });
    });

    // Delete single history item
    const delBtns = this.root.querySelectorAll<HTMLButtonElement>(".ai-btn-del-history[data-id]");
    delBtns.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        if (id) {
          await this.callbacks.onDeleteHistoryItem(id);
          this.showStatus("Item removed");
        }
      });
    });

    // Clear all history
    const clearBtn = this.root.querySelector("#ai-btn-clear-history");
    clearBtn?.addEventListener("click", async () => {
      await this.callbacks.onClearHistory();
      this.showStatus("History cleared");
    });
  }

  private async handleExportAction(format: ExportFormat): Promise<void> {
    this.setLoading(true);
    try {
      await this.callbacks.onExport(format);
      this.showStatus(
        format === "pdf" ? "Print dialog opened!" : `Exported as ${format.toUpperCase()}!`
      );
    } catch (_err) {
      this.showStatus("Export failed", true);
    } finally {
      this.setLoading(false);
    }
  }
}
