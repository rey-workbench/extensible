import { browser } from "wxt/browser";
import { onMessage } from "@/lib/messaging";
import { createUniqueId } from "@/lib/utils";
import { AI_EXPORTER_ACTIONS } from "./constants/ai-exporter.constants";
import { AiExporterService } from "./services/ai-exporter.service";
import type {
  ChatConversation,
  ExportFormat,
  ExportHistoryItem,
  ExportResult,
} from "./types/ai-exporter.types";

/** AI Exporter background handlers: file export (download / printable tab) + history. */
export function setupAiExporterBackground(): void {
  const service = new AiExporterService();

  onMessage<
    { conversation: ChatConversation; format: ExportFormat; filename?: string },
    ExportResult
  >(AI_EXPORTER_ACTIONS.EXPORT_FILE, async (payload) => {
    if (!payload?.conversation || !payload?.format) {
      throw new Error("Missing conversation or format");
    }
    const formatted = service.formatConversation(payload.conversation, payload.format);
    const filename =
      payload.filename || service.generateFilename(payload.conversation, formatted.extension);

    // PDF opens as a printable tab; everything else downloads directly
    if (payload.format === "pdf") {
      await openAsTab(formatted.content);
    } else {
      await downloadAsFile(formatted.content, filename, formatted.mimeType);
    }

    // Record in history (cached content enables re-download / copy)
    const historyItem: ExportHistoryItem = {
      id: createUniqueId("hist", 6),
      title: payload.conversation.title,
      platform: payload.conversation.platform,
      messageCount: payload.conversation.messages.length,
      exportedAt: Date.now(),
      format: payload.format,
      url: payload.conversation.url,
      content: formatted.content,
    };
    await service.recordHistory(historyItem);

    return { success: true, filename, format: payload.format };
  });

  onMessage<{ content: string; filename: string; mimeType?: string }, { success: boolean }>(
    AI_EXPORTER_ACTIONS.DOWNLOAD_CONTENT,
    async (payload) => {
      if (!payload?.content || !payload?.filename) {
        throw new Error("Missing content or filename");
      }
      await downloadAsFile(payload.content, payload.filename, payload.mimeType || "text/plain");
      return { success: true };
    }
  );
}

/** Creates a blob: URL for text content (no 2 MB data-URL limit, no deprecated btoa/unescape). */
function toObjectUrl(content: string, mimeType: string): string {
  const blob = new Blob([content], { type: mimeType });
  return URL.createObjectURL(blob);
}

/** Revokes an object URL after the browser has had time to consume it. */
function revokeLater(url: string, ms = 60_000): void {
  setTimeout(() => URL.revokeObjectURL(url), ms);
}

/** Downloads text content as a file via the Chrome Downloads API (no-op when unavailable). */
async function downloadAsFile(content: string, filename: string, mimeType: string): Promise<void> {
  if (!browser.downloads?.download) return;
  const url = toObjectUrl(content, mimeType);
  try {
    await browser.downloads.download({ url, filename, saveAs: false });
  } finally {
    revokeLater(url);
  }
}

/** Opens HTML content in a new tab (no-op when tabs API unavailable). */
async function openAsTab(html: string): Promise<void> {
  if (!browser.tabs?.create) return;
  const url = toObjectUrl(html, "text/html");
  await browser.tabs.create({ url });
  revokeLater(url);
}
