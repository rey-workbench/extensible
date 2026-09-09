import { MessageRouterService, slugify } from "@/core/index";
import { AiExporterService } from "../ai-exporter.service";
import {
  AI_EXPORTER_ACTIONS,
  type CavemanLevel,
  DEFAULT_CAVEMAN_SETTINGS,
} from "../constants/ai-exporter.constants";
import type {
  CavemanSettings,
  ChatConversation,
  ExportFormat,
  ExportHistoryItem,
} from "../types/ai-exporter.types";
import { ChatParserUtils } from "../utils/chat-parser.utils";
import { MarkdownFormatterUtils } from "../utils/markdown-formatter.utils";
import { AiExporterPopupView } from "../views/ai-exporter-popup.view";

export class AiExporterPopupController {
  public static readonly contextType = "popup" as const;
  public static readonly inject = [MessageRouterService, AiExporterService] as const;

  private view: AiExporterPopupView | null = null;
  private currentConvo: ChatConversation | null = null;
  private history: ExportHistoryItem[] = [];
  private cavemanSettings: CavemanSettings = DEFAULT_CAVEMAN_SETTINGS;

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
    // 1. If running inside web page (e.g. Side Notch Drawer in Content Script context)
    const isExtensionPopup =
      typeof location !== "undefined" && location.protocol === "chrome-extension:";

    if (!isExtensionPopup && typeof document !== "undefined") {
      try {
        if (deepHydrate) {
          await ChatParserUtils.hydrateVirtualizedChat(document);
        }
        const convo = ChatParserUtils.parseActivePage(document);
        this.currentConvo = convo;
        this.view?.updateState(this.currentConvo, this.history, this.cavemanSettings);
        return;
      } catch (err) {
        console.warn("[AiExporterPopupController] Direct DOM scrape error:", err);
      }
    }

    // 2. If running inside extension popup window (chrome-extension://)
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return;

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) return;

      let convo: ChatConversation | null = null;

      try {
        convo = await this.requestConvo(activeTab.id, deepHydrate);
      } catch {
        // Content script might not be injected yet or was disconnected on reload.
        // Try injecting dist/content.js via chrome.scripting if available
        if (chrome.scripting?.executeScript && activeTab.id) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["dist/content.js"],
            });
            await new Promise((r) => setTimeout(r, 200));
            convo = await this.requestConvo(activeTab.id, deepHydrate);
          } catch {
            // Restricted tab (e.g. chrome://)
          }
        }
      }

      this.currentConvo = convo;
      this.view?.updateState(this.currentConvo, this.history, this.cavemanSettings);
    } catch {
      this.currentConvo = null;
      this.view?.updateState(null, this.history, this.cavemanSettings);
    }
  }

  /** Sends SCRAPE_DOM to a tab and normalizes bare vs ApiResponse-wrapped responses. */
  private async requestConvo(
    tabId: number,
    deepHydrate: boolean
  ): Promise<ChatConversation | null> {
    const res = await this.router.sendToTab<unknown>(tabId, AI_EXPORTER_ACTIONS.SCRAPE_DOM, {
      hydrate: deepHydrate,
    });
    // SAFETY: res might be the data object itself or ApiResponse-wrapped
    const r = res as {
      conversation?: ChatConversation | null;
      data?: { conversation?: ChatConversation | null };
    } | null;
    return r?.conversation ?? r?.data?.conversation ?? null;
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

    // Mime/extension come from the canonical FORMAT_META table on the service
    const { mimeType, extension } = AiExporterService.formatMeta(item.format);
    const filename = `${item.platform}_${slugify(item.title).slice(0, 40) || "chat"}_${item.exportedAt}${extension}`;

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
