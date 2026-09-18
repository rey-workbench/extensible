<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "wxt/browser";
  import { COPY_MESSAGES, copyWithFeedback, slugify } from "@/lib/browser";
  import { sendMessage, sendToTab } from "@/lib/messaging";
  import { delay } from "@/lib/utils";
  import { AI_TOOLKIT_ACTIONS } from "../constants/ai-toolkit.constants";
  import {
    clearHistory,
    deleteHistoryItem,
    formatMeta,
    getCavemanSettings,
    getHistory,
    readHistoryContent,
    updateCavemanSettings,
  } from "../services/ai-toolkit.service";
  import type {
    CavemanSettings,
    ChatConversation,
    ExportFormat,
    ExportHistoryItem,
  } from "../types/ai-toolkit.types";
  import { hydrateVirtualizedChat, parseActivePage } from "../utils/chat-parser.utils";
  import { formatMarkdown } from "../utils/export-formatters";
  import ActiveSessionCard from "./ActiveSessionCard.svelte";
  import CavemanCard from "./CavemanCard.svelte";
  import HistoryList from "./HistoryList.svelte";

  let convo = $state<ChatConversation | null>(null);
  let history = $state<ExportHistoryItem[]>([]);
  let caveman = $state<CavemanSettings | null>(null);
  let isLoading = $state(false);
  let status = $state<{ text: string; isError?: boolean } | null>(null);
  let statusTimer: ReturnType<typeof setTimeout> | null = null;

  function showStatus(text: string, isError = false): void {
    status = { text, isError };
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (status?.text === text) status = null;
    }, 2500);
  }

  async function requestConvo(
    tabId: number,
    deepHydrate: boolean,
  ): Promise<ChatConversation | null> {
    const res = await sendToTab<{ conversation?: ChatConversation | null }>(
      tabId,
      AI_TOOLKIT_ACTIONS.SCRAPE_DOM,
      { hydrate: deepHydrate },
    );
    return res?.conversation ?? null;
  }

  async function detectActiveTabChat(deepHydrate = false): Promise<void> {
    isLoading = true;
    try {
      const isExtensionPopup =
        typeof location !== "undefined" &&
        location.protocol === "chrome-extension:";
      if (!isExtensionPopup && typeof document !== "undefined") {
        try {
          if (deepHydrate)
            await hydrateVirtualizedChat(document);
          convo = parseActivePage(document);
          return;
        } catch (err) {
          console.warn("[AiToolkit] Direct DOM scrape error:", err);
        }
      }
      if (!browser.tabs?.query) return;
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) return;
      let c: ChatConversation | null = null;
      try {
        c = await requestConvo(activeTab.id, deepHydrate);
      } catch {
        if (browser.scripting?.executeScript && activeTab.id) {
          try {
            await browser.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["/content-scripts/content.js"],
            });
            await delay(200);
            c = await requestConvo(activeTab.id, deepHydrate);
          } catch {
            
          }
        }
      }
      convo = c;
    } catch {
      convo = null;
    } finally {
      isLoading = false;
    }
  }

  async function loadHistory(): Promise<void> {
    try {
      history = await getHistory();
    } catch (err) {
      console.warn("[AiToolkit] Failed to load history:", err);
    }
  }

  async function handleExport(format: ExportFormat): Promise<void> {
    if (!convo) return;
    isLoading = true;
    try {
      await sendMessage(AI_TOOLKIT_ACTIONS.EXPORT_FILE, {
        conversation: convo,
        format,
      });
      await loadHistory();
      showStatus(
        format === "pdf"
          ? "Print dialog opened!"
          : `Exported as ${format.toUpperCase()}!`,
      );
    } catch (err) {
      console.warn("[AiToolkit] Export failed:", err);
      showStatus(
        err instanceof Error && err.message
          ? `Export failed: ${err.message}`
          : "Export failed",
        true,
      );
    } finally {
      isLoading = false;
    }
  }

  async function handleCopy(): Promise<void> {
    if (!convo) return;
    isLoading = true;
    try {
      const mdText = formatMarkdown(convo);
      const message = await copyWithFeedback(mdText);
      showStatus(message, message !== COPY_MESSAGES.success);
    } catch {
      showStatus(COPY_MESSAGES.failure, true);
    } finally {
      isLoading = false;
    }
  }

  async function handleDownloadHistory(id: string): Promise<void> {
    const item = history.find((x) => x.id === id);
    const content = await readHistoryContent(id);
    if (!item || !content) {
      showStatus("Transcript expired — export again", true);
      return;
    }
    const { mimeType, extension } = formatMeta(item.format);
    const filename = `${item.platform}_${slugify(item.title).slice(0, 40) || "chat"}_${item.exportedAt}${extension}`;
    try {
      await sendMessage(AI_TOOLKIT_ACTIONS.DOWNLOAD_CONTENT, {
        content,
        filename,
        mimeType,
      });
      showStatus("Re-downloaded!");
    } catch {
      showStatus("Download failed", true);
    }
  }

  async function handleCopyHistory(id: string): Promise<void> {
    const content = await readHistoryContent(id);
    if (!content) {
      showStatus("Transcript expired — export again", true);
      return;
    }
    const message = await copyWithFeedback(content);
    showStatus(message, message !== COPY_MESSAGES.success);
  }

  async function handleDeleteHistory(id: string): Promise<void> {
    await deleteHistoryItem(id);
    await loadHistory();
    showStatus("Item removed");
  }

  async function handleClearHistory(): Promise<void> {
    await clearHistory();
    await loadHistory();
    showStatus("History cleared");
  }

  async function handleToggleCaveman(enabled: boolean): Promise<void> {
    caveman = await updateCavemanSettings({ enabled });
    showStatus(enabled ? "Caveman Mode enabled" : "Caveman Mode disabled");
  }

  async function handleSetLevel(level: CavemanSettings["level"]): Promise<void> {
    caveman = await updateCavemanSettings({ level });
    showStatus(`Caveman level: ${level.toUpperCase()}`);
  }

  onMount(async () => {
    try {
      caveman = await getCavemanSettings();
    } catch {}
    await Promise.all([loadHistory(), detectActiveTabChat(false)]);
  });
</script>

<div class="flex flex-col gap-4 p-2.5 sm:p-3.5">
  {#if status}
    <div
      class="rounded-2xl border px-3.5 py-2 text-label font-bold shadow-sm
        {status.isError
        ? 'border-ext-danger-soft-border bg-ext-danger-soft text-ext-danger-ink'
        : 'border-ext-success-soft-border bg-ext-success-soft text-ext-success-ink'}"
    >
      {status.text}
    </div>
  {/if}

  {#if caveman}
    <ActiveSessionCard
      {convo}
      {isLoading}
      onInspect={(deep) => void detectActiveTabChat(deep)}
      onExport={(format) => void handleExport(format)}
      onCopy={() => void handleCopy()}
    />

    <CavemanCard
      {caveman}
      onToggle={(v) => void handleToggleCaveman(v)}
      onSetLevel={(lvl) => void handleSetLevel(lvl)}
    />
  {/if}

  <HistoryList
    {history}
    {isLoading}
    onDownload={(id) => void handleDownloadHistory(id)}
    onCopy={(id) => void handleCopyHistory(id)}
    onDelete={(id) => void handleDeleteHistory(id)}
    onClear={() => void handleClearHistory()}
  />
</div>