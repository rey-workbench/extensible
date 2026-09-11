import { browser } from "wxt/browser";
import { onMessage } from "@/lib/messaging";
import { createUniqueId } from "@/lib/utils";
import { AI_TOOLKIT_ACTIONS } from "./constants/ai-toolkit.constants";
import { AiToolkitService } from "./services/ai-toolkit.service";
import type {
  ChatConversation,
  ExportFormat,
  ExportHistoryItem,
  ExportResult,
} from "./types/ai-toolkit.types";

export function setupAiToolkitBackground(): void {
  const service = new AiToolkitService();

  onMessage<
    { conversation: ChatConversation; format: ExportFormat; filename?: string },
    ExportResult
  >(AI_TOOLKIT_ACTIONS.EXPORT_FILE, async (payload) => {
    if (!payload?.conversation || !payload?.format) {
      throw new Error("Missing conversation or format");
    }
    const formatted = service.formatConversation(payload.conversation, payload.format);
    const filename =
      payload.filename || service.generateFilename(payload.conversation, formatted.extension);

    if (payload.format === "pdf") {
      await openAsTab(formatted.content);
    } else {
      await downloadAsFile(formatted.content, filename, formatted.mimeType);
    }

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
    AI_TOOLKIT_ACTIONS.DOWNLOAD_CONTENT,
    async (payload) => {
      if (!payload?.content || !payload?.filename) {
        throw new Error("Missing content or filename");
      }
      await downloadAsFile(payload.content, payload.filename, payload.mimeType || "text/plain");
      return { success: true };
    },
  );
}

function toObjectUrl(content: string, mimeType: string): string {
  if (typeof URL.createObjectURL === "function") {
    const blob = new Blob([content], { type: mimeType });
    return URL.createObjectURL(blob);
  }
  return `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
}

function revokeLater(url: string, ms = 60_000): void {
  setTimeout(() => URL.revokeObjectURL(url), ms);
}

async function downloadAsFile(content: string, filename: string, mimeType: string): Promise<void> {
  if (!browser.downloads?.download) return;
  const url = toObjectUrl(content, mimeType);
  try {
    await browser.downloads.download({ url, filename, saveAs: false });
  } finally {
    revokeLater(url);
  }
}

async function openAsTab(html: string): Promise<void> {
  if (!browser.tabs?.create) return;
  const url = toObjectUrl(html, "text/html");
  await browser.tabs.create({ url });
  revokeLater(url);
}
