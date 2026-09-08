import { MessageRouterService } from "@/core/index";
import { AiExporterService } from "../ai-exporter.service";
import { AI_EXPORTER_ACTIONS } from "../constants/ai-exporter.constants";
import { ExportChatDto } from "../dto/export-chat.dto";
import type { ExportFormat, ExportHistoryItem, ExportResult } from "../types/ai-exporter.types";

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
      async (payload: {
        conversation: any;
        format?: ExportFormat;
        filename?: string;
      }): Promise<ExportResult> => {
        const dto = new ExportChatDto(payload);
        const formatted = this.service.formatConversation(dto.conversation, dto.format);
        const filename =
          dto.filename || this.service.generateFilename(dto.conversation, formatted.extension);

        // If format is PDF, open printable tab with auto-print
        if (dto.format === "pdf") {
          if (typeof chrome !== "undefined" && chrome.tabs?.create) {
            const base64Content = btoa(unescape(encodeURIComponent(formatted.content)));
            const dataUrl = `data:text/html;base64,${base64Content}`;
            await chrome.tabs.create({ url: dataUrl });
          }
        } else if (typeof chrome !== "undefined" && chrome.downloads?.download) {
          // Download via Chrome Downloads API if available
          const base64Content = btoa(unescape(encodeURIComponent(formatted.content)));
          const dataUrl = `data:${formatted.mimeType};base64,${base64Content}`;

          await new Promise<number>((resolve, reject) => {
            chrome.downloads.download(
              {
                url: dataUrl,
                filename,
                saveAs: false,
              },
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

        return {
          success: true,
          filename,
          format: dto.format,
        };
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
        const mimeType = payload.mimeType || "text/plain";
        if (typeof chrome !== "undefined" && chrome.downloads?.download) {
          const base64Content = btoa(unescape(encodeURIComponent(payload.content)));
          const dataUrl = `data:${mimeType};base64,${base64Content}`;
          await new Promise<number>((resolve, reject) => {
            chrome.downloads.download(
              { url: dataUrl, filename: payload.filename, saveAs: false },
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
        return { success: true };
      }
    );

    this.router.subscribe(
      AI_EXPORTER_ACTIONS.OPEN_PRINT_VIEW,
      async (payload: { html: string }): Promise<{ success: boolean }> => {
        if (!payload?.html) throw new Error("Missing HTML content");
        if (typeof chrome !== "undefined" && chrome.tabs?.create) {
          const base64Content = btoa(unescape(encodeURIComponent(payload.html)));
          const dataUrl = `data:text/html;base64,${base64Content}`;
          await chrome.tabs.create({ url: dataUrl });
        }
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

    this.router.subscribe(AI_EXPORTER_ACTIONS.SET_CAVEMAN_SETTINGS, async (payload: any) => {
      return await this.service.updateCavemanSettings(payload || {});
    });
  }
}
