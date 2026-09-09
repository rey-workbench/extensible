import { MessageRouterService } from "@/core/index";
import { AiExporterService } from "../ai-exporter.service";
import { AI_EXPORTER_ACTIONS } from "../constants/ai-exporter.constants";
import { ExportChatDto, type ExportPayload } from "../dto/export-chat.dto";
import type { CavemanSettings, ExportHistoryItem, ExportResult } from "../types/ai-exporter.types";

export class AiExporterBackgroundController {
  public static readonly contextType = "background" as const;
  public static readonly inject = [MessageRouterService, AiExporterService] as const;

  constructor(
    private readonly router: MessageRouterService,
    private readonly service: AiExporterService
  ) {}

  public onModuleInit(): void {
    this.router.subscribe(
      AI_EXPORTER_ACTIONS.EXPORT_FILE,
      async (payload: ExportPayload): Promise<ExportResult> => {
        const dto = new ExportChatDto(payload);
        const formatted = this.service.formatConversation(dto.conversation, dto.format);
        const filename =
          dto.filename || this.service.generateFilename(dto.conversation, formatted.extension);

        // PDF goes to a printable tab; everything else downloads directly
        if (dto.format === "pdf") {
          await this.openAsTab(formatted.content);
        } else {
          await this.downloadAsFile(formatted.content, filename, formatted.mimeType);
        }

        // Record in history (including cached content for re-download / copy)
        const historyItem: ExportHistoryItem = {
          id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: dto.conversation.title,
          platform: dto.conversation.platform,
          messageCount: dto.conversation.messages.length,
          exportedAt: Date.now(),
          format: dto.format,
          url: dto.conversation.url,
          content: formatted.content,
        };
        await this.service.recordHistory(historyItem);

        return { success: true, filename, format: dto.format };
      }
    );

    this.router.subscribe(
      AI_EXPORTER_ACTIONS.DOWNLOAD_CONTENT,
      async (payload: {
        content: string;
        filename: string;
        mimeType?: string;
      }): Promise<{ success: boolean }> => {
        if (!payload?.content || !payload?.filename) {
          throw new Error("Missing content or filename");
        }
        await this.downloadAsFile(
          payload.content,
          payload.filename,
          payload.mimeType || "text/plain"
        );
        return { success: true };
      }
    );

    this.router.subscribe(AI_EXPORTER_ACTIONS.GET_HISTORY, async () => {
      return await this.service.getHistory();
    });

    this.router.subscribe(
      AI_EXPORTER_ACTIONS.DELETE_HISTORY_ITEM,
      async (payload: { id: string }) => {
        if (payload?.id) {
          await this.service.deleteHistoryItem(payload.id);
        }
        return { success: true };
      }
    );

    this.router.subscribe(AI_EXPORTER_ACTIONS.CLEAR_HISTORY, async () => {
      await this.service.clearHistory();
      return { success: true };
    });

    this.router.subscribe(AI_EXPORTER_ACTIONS.GET_CAVEMAN_SETTINGS, async () => {
      return await this.service.getCavemanSettings();
    });

    this.router.subscribe(
      AI_EXPORTER_ACTIONS.SET_CAVEMAN_SETTINGS,
      async (payload: Partial<CavemanSettings>) => {
        return await this.service.updateCavemanSettings(payload || {});
      }
    );
  }

  /** Encodes text content into a data: URL usable by chrome.downloads / chrome.tabs. */
  private toDataUrl(content: string, mimeType: string): string {
    const base64 = btoa(unescape(encodeURIComponent(content)));
    return `data:${mimeType};base64,${base64}`;
  }

  /** Downloads text content as a file via the Chrome Downloads API (no-op when unavailable). */
  private async downloadAsFile(content: string, filename: string, mimeType: string): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.downloads?.download) return;
    await new Promise<number>((resolve, reject) => {
      chrome.downloads.download(
        { url: this.toDataUrl(content, mimeType), filename, saveAs: false },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        }
      );
    });
  }

  /** Opens HTML content in a new tab (no-op when tabs API unavailable). */
  private async openAsTab(html: string): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.tabs?.create) return;
    await chrome.tabs.create({ url: this.toDataUrl(html, "text/html") });
  }
}
