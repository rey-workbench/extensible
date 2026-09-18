import { storage } from "wxt/utils/storage";
import { slugify } from "@/lib/browser";
import { mergeSettings, readSettings } from "@/lib/utils";
import {
  AI_TOOLKIT_STORAGE_KEYS,
  DEFAULT_CAVEMAN_SETTINGS,
  isValidCavemanLevel,
  MAX_HISTORY_ITEMS,
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

type LegacyHistoryItem = ExportHistoryItem & { content?: string };

function historyBlobKey(id: string): `session:${string}` {
  return `${AI_TOOLKIT_STORAGE_KEYS.HISTORY_BLOB}${id}`;
}

export async function readHistoryContent(id: string): Promise<string | null> {
  try {
    return (await storage.getItem<string>(historyBlobKey(id))) ?? null;
  } catch {
    return null;
  }
}

async function removeHistoryContent(id: string): Promise<void> {
  try {
    await storage.removeItem(historyBlobKey(id));
  } catch {}
}

export async function getHistory(): Promise<ExportHistoryItem[]> {
  const stored = await historyItem.getValue();
  const list: LegacyHistoryItem[] = Array.isArray(stored) ? stored : [];

  const legacy = list.filter((item) => typeof item.content === "string");
  if (legacy.length === 0) return list;

  for (const item of legacy) {
    if (item.content) {
      await storage.setItem(historyBlobKey(item.id), item.content);
    }
  }
  const migrated = list.map(({ content, ...metadata }) => ({
    ...metadata,
    hasContent: Boolean(content),
  }));
  await historyItem.setValue(migrated);
  return migrated;
}

export async function recordHistory(item: ExportHistoryItem, content: string): Promise<void> {
  await storage.setItem(historyBlobKey(item.id), content);

  const list = await getHistory();
  const merged = [{ ...item, hasContent: true }, ...list.filter((x) => x.id !== item.id)];
  await historyItem.setValue(merged.slice(0, MAX_HISTORY_ITEMS));

  const evicted = merged.slice(MAX_HISTORY_ITEMS);
  await Promise.all(evicted.map((x) => removeHistoryContent(x.id)));
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const list = await getHistory();
  await historyItem.setValue(list.filter((x) => x.id !== id));
  await removeHistoryContent(id);
}

export async function clearHistory(): Promise<void> {
  const list = await getHistory();
  await historyItem.setValue([]);
  await Promise.all(list.map((x) => removeHistoryContent(x.id)));
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
