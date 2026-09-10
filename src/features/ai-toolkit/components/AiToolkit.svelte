<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "wxt/browser";
  import { copyToClipboard, slugify } from "@/lib/browser";
  import { sendMessage, sendToTab } from "@/lib/messaging";
  import { delay } from "@/lib/utils";
  import { AI_TOOLKIT_ACTIONS } from "../constants/ai-toolkit.constants";
  import { AiToolkitService } from "../services/ai-toolkit.service";
  import type {
    CavemanSettings,
    ChatConversation,
    ExportFormat,
  } from "../types/ai-toolkit.types";
  import { ChatParserUtils } from "../utils/chat-parser.utils";
  import { MarkdownFormatterUtils } from "../utils/markdown-formatter.utils";
  import ActiveSessionCard from "./ActiveSessionCard.svelte";
  import CavemanCard from "./CavemanCard.svelte";
  import HistoryList from "./HistoryList.svelte";

  const service = new AiToolkitService();

  let convo = $state<ChatConversation | null>(null);
  let history = $state<Awaited<ReturnType<AiToolkitService["getHistory"]>>>([]);
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
            await ChatParserUtils.hydrateVirtualizedChat(document);
          convo = ChatParserUtils.parseActivePage(document);
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
            // content script not injectable — leave convo as null
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
      history = await service.getHistory();
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
      const mdText = MarkdownFormatterUtils.format(convo);
      const ok = await copyToClipboard(mdText);
      showStatus(ok ? "Copied to clipboard!" : "Copy failed", !ok);
    } catch {
      showStatus("Copy failed", true);
    } finally {
      isLoading = false;
    }
  }

  async function handleDownloadHistory(id: string): Promise<void> {
    const item = history.find((x) => x.id === id);
    if (!item?.content) return;
    const { mimeType, extension } = AiToolkitService.formatMeta(item.format);
    const filename = `${item.platform}_${slugify(item.title).slice(0, 40) || "chat"}_${item.exportedAt}${extension}`;
    try {
      await sendMessage(AI_TOOLKIT_ACTIONS.DOWNLOAD_CONTENT, {
        content: item.content,
        filename,
        mimeType,
      });
      showStatus("Re-downloaded!");
    } catch {
      showStatus("Download failed", true);
    }
  }

  async function handleCopyHistory(id: string): Promise<void> {
    const item = history.find((x) => x.id === id);
    if (!item?.content) return;
    const ok = await copyToClipboard(item.content);
    showStatus(ok ? "Copied from history!" : "Copy failed", !ok);
  }

  async function handleDeleteHistory(id: string): Promise<void> {
    await service.deleteHistoryItem(id);
    await loadHistory();
    showStatus("Item removed");
  }

  async function handleClearHistory(): Promise<void> {
    await service.clearHistory();
    await loadHistory();
    showStatus("History cleared");
  }

  async function handleToggleCaveman(enabled: boolean): Promise<void> {
    caveman = await service.updateCavemanSettings({ enabled });
    showStatus(enabled ? "Caveman Mode enabled" : "Caveman Mode disabled");
  }

  async function handleSetLevel(level: CavemanSettings["level"]): Promise<void> {
    caveman = await service.updateCavemanSettings({ level });
    showStatus(`Caveman level: ${level.toUpperCase()}`);
  }

  onMount(async () => {
    try {
      caveman = await service.getCavemanSettings();
    } catch {
      // fall back to defaults
    }
    await Promise.all([loadHistory(), detectActiveTabChat(false)]);
  });
</script>

<div class="flex flex-col gap-2.5 p-2.5">
  {#if status}
    <div
      class="rounded-md border-[1.5px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#1A1A1A]
        {status.isError
        ? 'bg-ext-danger text-white border-[#A82624]'
        : 'bg-ext-success text-white border-[#1E6B38]'}"
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