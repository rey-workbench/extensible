import { storage } from "wxt/utils/storage";
import { slugify } from "@/lib/browser";
import { mergeSettings, readSettings } from "@/lib/utils";
import {
  AI_EXPORTER_STORAGE_KEYS,
  DEFAULT_CAVEMAN_SETTINGS,
  isValidCavemanLevel,
} from "../constants/ai-exporter.constants";
import type {
  CavemanSettings,
  ChatConversation,
  ExportFormat,
  ExportHistoryItem,
} from "../types/ai-exporter.types";
import { HtmlFormatterUtils } from "../utils/html-formatter.utils";
import { JsonFormatterUtils } from "../utils/json-formatter.utils";
import { MarkdownFormatterUtils } from "../utils/markdown-formatter.utils";

const historyItem = storage.defineItem<ExportHistoryItem[]>(AI_EXPORTER_STORAGE_KEYS.HISTORY, {
  defaultValue: [],
});

export const cavemanSettingsItem = storage.defineItem<CavemanSettings>(
  AI_EXPORTER_STORAGE_KEYS.CAVEMAN_SETTINGS,
  { defaultValue: DEFAULT_CAVEMAN_SETTINGS }
);

export class AiExporterService {
  /**
   * Retrieves recorded export history.
   */
  public async getHistory(): Promise<ExportHistoryItem[]> {
    const list = await historyItem.getValue();
    return Array.isArray(list) ? list : [];
  }

  /**
   * Appends an export record to history (capped at 50 recent items).
   */
  public async recordHistory(item: ExportHistoryItem): Promise<void> {
    const list = await this.getHistory();
    const updated = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 50);
    await historyItem.setValue(updated);
  }

  /**
   * Removes a specific item from history.
   */
  public async deleteHistoryItem(id: string): Promise<void> {
    const list = await this.getHistory();
    await historyItem.setValue(list.filter((x) => x.id !== id));
  }

  /**
   * Clears all export history.
   */
  public async clearHistory(): Promise<void> {
    await historyItem.setValue([]);
  }

  /**
   * Retrieves Caveman mode configuration.
   */
  public async getCavemanSettings(): Promise<CavemanSettings> {
    return readSettings(await cavemanSettingsItem.getValue(), DEFAULT_CAVEMAN_SETTINGS);
  }

  /**
   * Updates Caveman mode configuration.
   */
  public async updateCavemanSettings(partial: Partial<CavemanSettings>): Promise<CavemanSettings> {
    if (partial.level !== undefined && !isValidCavemanLevel(partial.level)) {
      throw new Error(`Invalid caveman level: '${String(partial.level)}'`);
    }
    const current = await this.getCavemanSettings();
    const updated: CavemanSettings = {
      ...mergeSettings(current, partial),
      sites: {
        ...current.sites,
        ...(partial.sites || {}),
      },
    };
    await cavemanSettingsItem.setValue(updated);
    return updated;
  }

  /**
   * Single mapping format → (mime, extension, content builder). Export filename/mime
   * decisions elsewhere must read from here instead of re-implementing the table.
   */
  private static readonly FORMAT_META: Record<
    ExportFormat,
    { mimeType: string; extension: string; build: (convo: ChatConversation) => string }
  > = {
    markdown: {
      mimeType: "text/markdown",
      extension: ".md",
      build: (c) => MarkdownFormatterUtils.format(c),
    },
    json: {
      mimeType: "application/json",
      extension: ".json",
      build: (c) => JsonFormatterUtils.format(c),
    },
    html: {
      mimeType: "text/html",
      extension: ".html",
      build: (c) => HtmlFormatterUtils.format(c),
    },
    pdf: {
      mimeType: "text/html",
      extension: ".html",
      build: (c) => HtmlFormatterUtils.format(c, { autoPrint: true }),
    },
    text: {
      mimeType: "text/plain",
      extension: ".txt",
      build: (c) => MarkdownFormatterUtils.formatPlainText(c),
    },
  };

  /** Metadata lookup for a format (mime type + file extension) without building content. */
  public static formatMeta(format: ExportFormat): { mimeType: string; extension: string } {
    const meta = AiExporterService.FORMAT_META[format] ?? AiExporterService.FORMAT_META.markdown;
    return { mimeType: meta.mimeType, extension: meta.extension };
  }

  /**
   * Formats the conversation into requested string representation along with metadata.
   */
  public formatConversation(
    convo: ChatConversation,
    format: ExportFormat
  ): { content: string; mimeType: string; extension: string } {
    const meta = AiExporterService.FORMAT_META[format] ?? AiExporterService.FORMAT_META.markdown;
    return { content: meta.build(convo), mimeType: meta.mimeType, extension: meta.extension };
  }

  /**
   * Generates a safe and informative filename for saving.
   */
  public generateFilename(convo: ChatConversation, extension: string): string {
    const dateStr = new Date(convo.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
    const cleanTitle = slugify(convo.title).slice(0, 40) || "ai-chat";
    return `${convo.platform}_${cleanTitle}_${dateStr}${extension}`;
  }
}
