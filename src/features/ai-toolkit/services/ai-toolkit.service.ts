import { storage } from "wxt/utils/storage";
import { slugify } from "@/lib/browser";
import { mergeSettings, readSettings } from "@/lib/utils";
import {
  AI_TOOLKIT_STORAGE_KEYS,
  DEFAULT_CAVEMAN_SETTINGS,
  isValidCavemanLevel,
} from "../constants/ai-toolkit.constants";
import type {
  CavemanSettings,
  ChatConversation,
  ExportFormat,
  ExportHistoryItem,
} from "../types/ai-toolkit.types";
import {
  formatHtml,
  formatJson,
  formatMarkdown,
  formatPlainText,
} from "../utils/export-formatters";

const historyItem = storage.defineItem<ExportHistoryItem[]>(AI_TOOLKIT_STORAGE_KEYS.HISTORY, {
  defaultValue: [],
});

export const cavemanSettingsItem = storage.defineItem<CavemanSettings>(
  AI_TOOLKIT_STORAGE_KEYS.CAVEMAN_SETTINGS,
  { defaultValue: DEFAULT_CAVEMAN_SETTINGS },
);

export async function getHistory(): Promise<ExportHistoryItem[]> {
  const list = await historyItem.getValue();
  return Array.isArray(list) ? list : [];
}

export async function recordHistory(item: ExportHistoryItem): Promise<void> {
  const list = await getHistory();
  const updated = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 50);
  await historyItem.setValue(updated);
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const list = await getHistory();
  await historyItem.setValue(list.filter((x) => x.id !== id));
}

export async function clearHistory(): Promise<void> {
  await historyItem.setValue([]);
}

export async function getCavemanSettings(): Promise<CavemanSettings> {
  return readSettings(await cavemanSettingsItem.getValue(), DEFAULT_CAVEMAN_SETTINGS);
}

export async function updateCavemanSettings(
  partial: Partial<CavemanSettings>,
): Promise<CavemanSettings> {
  if (partial.level !== undefined && !isValidCavemanLevel(partial.level)) {
    throw new Error(`Invalid caveman level: '${String(partial.level)}'`);
  }
  const current = await getCavemanSettings();
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

const FORMAT_META: Record<
  ExportFormat,
  { mimeType: string; extension: string; build: (convo: ChatConversation) => string }
> = {
  markdown: {
    mimeType: "text/markdown",
    extension: ".md",
    build: (c) => formatMarkdown(c),
  },
  json: {
    mimeType: "application/json",
    extension: ".json",
    build: (c) => formatJson(c),
  },
  html: {
    mimeType: "text/html",
    extension: ".html",
    build: (c) => formatHtml(c),
  },
  pdf: {
    mimeType: "text/html",
    extension: ".html",
    build: (c) => formatHtml(c, { autoPrint: true }),
  },
  text: {
    mimeType: "text/plain",
    extension: ".txt",
    build: (c) => formatPlainText(c),
  },
};

export function formatMeta(format: ExportFormat): { mimeType: string; extension: string } {
  const meta = FORMAT_META[format] ?? FORMAT_META.markdown;
  return { mimeType: meta.mimeType, extension: meta.extension };
}

export function formatConversation(
  convo: ChatConversation,
  format: ExportFormat,
): { content: string; mimeType: string; extension: string } {
  const meta = FORMAT_META[format] ?? FORMAT_META.markdown;
  return { content: meta.build(convo), mimeType: meta.mimeType, extension: meta.extension };
}

export function generateFilename(convo: ChatConversation, extension: string): string {
  const dateStr = new Date(convo.createdAt).toISOString().slice(0, 10).replace(/-/g, "");
  const cleanTitle = slugify(convo.title).slice(0, 40) || "ai-chat";
  return `${convo.platform}_${cleanTitle}_${dateStr}${extension}`;
}
