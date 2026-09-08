import { MessageRouterService, slugify } from "@/core/index";
import { AiExporterService } from "../ai-exporter.service";
import { AI_EXPORTER_ACTIONS, type CavemanLevel } from "../constants/ai-exporter.constants";
import type {
  CavemanSettings,
  ChatConversation,
  ExportFormat,
  ExportHistoryItem,
} from "../types/ai-exporter.types";
import { MarkdownFormatterUtils } from "../utils/markdown-formatter.utils";
import { AiExporterPopupView } from "../views/ai-exporter-popup.view";

export class AiExporterPopupController {
  public static readonly contextType = "popup" as const;
  public static readonly inject = [MessageRouterService, AiExporterService] as const;

  private view: AiExporterPopupView | null = null;
  private currentConvo: ChatConversation | null = null;
  private history: ExportHistoryItem[] = [];
  private cavemanSettings: CavemanSettings = { enabled: false, level: "full", sites: {} };

  constructor(
    private readonly router: MessageRouterService,
    private readonly service: AiExporterService
  ) {}

  public async mount(container: HTMLElement): Promise<void> {
    this.view = new AiExporterPopupView({
      onExport: async (format: ExportFormat) => {
        await this.exportCurrentChat(format);
      },
      onCopy: async () => {
        await this.copyCurrentChat();
      },
      onRefreshActiveTab: async (deepHydrate?: boolean) => {
        await this.detectActiveTabChat(deepHydrate);
      },
      onDownloadHistoryItem: async (id: string) => {
        await this.downloadHistoryItem(id);
      },
      onCopyHistoryItem: async (id: string) => {
        await this.copyHistoryItem(id);
      },
      onDeleteHistoryItem: async (id: string) => {
        await this.service.deleteHistoryItem(id);
        await this.loadHistory();
      },
      onClearHistory: async () => {
        await this.service.clearHistory();
        await this.loadHistory();
      },
      onToggleCaveman: async (enabled: boolean) => {
        this.cavemanSettings = await this.service.updateCavemanSettings({ enabled });
        this.view?.updateState(this.currentConvo, this.history, this.cavemanSettings);
      },
      onSetCavemanLevel: async (level: CavemanLevel) => {
        this.cavemanSettings = await this.service.updateCavemanSettings({ level });
        this.view?.updateState(this.currentConvo, this.history, this.cavemanSettings);
      },
    });

    try {
      this.cavemanSettings = await this.service.getCavemanSettings();
    } catch {
      // fallback to default if storage not ready
    }

    // Initial render
    this.view.render(container, this.currentConvo, this.history, this.cavemanSettings);

    // Parallel load history and detect active tab chat
    await Promise.all([this.loadHistory(), this.detectActiveTabChat(false)]);
  }

  public async detectActiveTabChat(deepHydrate = false): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return;

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) return;

      // Request content script on the active tab to scrape current DOM
      const response = await new Promise<{ conversation: ChatConversation | null }>((resolve) => {
        chrome.tabs.sendMessage(
          // SAFETY: activeTab.id is checked above
          activeTab.id as number,
          { action: AI_EXPORTER_ACTIONS.SCRAPE_DOM, payload: { hydrate: deepHydrate } },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ conversation: null });
            } else {
              resolve(res || { conversation: null });
            }
          }
        );
      });

      this.currentConvo = response?.conversation ?? null;
      this.view?.updateState(this.currentConvo, this.history, this.cavemanSettings);
    } catch {
      this.currentConvo = null;
      this.view?.updateState(null, this.history, this.cavemanSettings);
    }
  }

  public async loadHistory(): Promise<void> {
    try {
      this.history = await this.service.getHistory();
      this.view?.updateState(this.currentConvo, this.history, this.cavemanSettings);
    } catch (err) {
      console.warn("[AiExporterPopupController] Failed to load history:", err);
    }
  }

  public async exportCurrentChat(format: ExportFormat): Promise<void> {
    if (!this.currentConvo) {
      throw new Error("No active conversation to export.");
    }

    await this.router.send(AI_EXPORTER_ACTIONS.EXPORT_FILE, {
      conversation: this.currentConvo,
      format,
    });

    await this.loadHistory();
  }

  public async copyCurrentChat(): Promise<void> {
    if (!this.currentConvo) {
      throw new Error("No active conversation to copy.");
    }

    const mdText = MarkdownFormatterUtils.format(this.currentConvo);
    await navigator.clipboard.writeText(mdText);
  }

  public async downloadHistoryItem(id: string): Promise<void> {
    const item = this.history.find((x) => x.id === id);
    if (!item?.content) throw new Error("No cached content available to download.");

    const ext = item.format === "markdown" ? ".md" : item.format === "json" ? ".json" : ".html";
    const filename = `${item.platform}_${slugify(item.title).slice(0, 40) || "chat"}_${item.exportedAt}${ext}`;
    const mimeType =
      item.format === "json"
        ? "application/json"
        : item.format === "markdown"
          ? "text/markdown"
          : "text/html";

    await this.router.send(AI_EXPORTER_ACTIONS.DOWNLOAD_CONTENT, {
      content: item.content,
      filename,
      mimeType,
    });
  }

  public async copyHistoryItem(id: string): Promise<void> {
    const item = this.history.find((x) => x.id === id);
    if (!item?.content) throw new Error("No cached content available to copy.");
    await navigator.clipboard.writeText(item.content);
  }

  public unmount(): void {
    this.view = null;
  }
}
